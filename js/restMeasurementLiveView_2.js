// Bestand: js/restMeasurementLiveView_2.js
// Dit bestand is een gecorrigeerde en geconsolideerde versie die de functionaliteit van concept.txt
// overneemt om een tweede, meer geavanceerde meetoptie te bieden.

import { BluetoothController } from '../bluetooth.js';
import { putData, getData, getOrCreateUserId } from '../database.js';
import { showNotification } from './notifications.js';
import { Bodystandard, VO2, RuntimesVo2 } from '../rr_hr_hrv_engine.js';

// ---- Geconsolideerde klassen uit concept.txt ----
// Hrv-analyse
class HRVAnalyzer {
    constructor(rrIntervals) {
        this.rrIntervals = rrIntervals.filter(n => typeof n === 'number' && !isNaN(n) && n > 0);
        this.n = this.rrIntervals.length;
        if (this.n < 2) {
            this.setDefaultValues();
            return;
        }

        this.meanRR = this.average(this.rrIntervals);
        this.avgHR = 60000 / this.meanRR;
        this.sdnn = this.standardDeviation(this.rrIntervals);
        const rmssdValues = this.rrIntervals.slice(1).map((val, i) => Math.pow(val - this.rrIntervals[i], 2));
        this.rmssd = Math.sqrt(rmssdValues.reduce((a, b) => a + b, 0) / (this.n - 1));
        const nn50Array = this.rrIntervals.slice(1).map((val, i) => Math.abs(val - this.rrIntervals[i]));
        this.nn50 = nn50Array.filter(diff => diff > 50).length;
        this.pnn50 = (this.nn50 / (this.n - 1)) * 100;
        this.frequency = this.analyzeFrequencyDomain(this.rrIntervals);
        this.sd1 = this.rmssd / Math.sqrt(2);
        const sd2_val = 2 * Math.pow(this.sdnn, 2) - 0.5 * Math.pow(this.rmssd, 2);
        this.sd2 = Math.sqrt(Math.max(0, sd2_val));
        this.sd2_sd1_ratio = this.sd1 > 0 ? this.sd2 / this.sd1 : 0;
        this.rrHistogram = this.calculateRRHistogram(30);
    }
    setDefaultValues() {
        this.avgHR = 0;
        this.meanRR = 0; this.sdnn = 0; this.rmssd = 0;
        this.nn50 = 0; this.pnn50 = 0;
        this.frequency = { vlfPower: 0, lfPower: 0, hfPower: 0, lfHfRatio: 0, freqs: [], psd: [] };
        this.sd1 = 0; this.sd2 = 0; this.sd2_sd1_ratio = 0;
        this.rrHistogram = { labels: [], counts: [] };
    }
    average(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
    standardDeviation(arr) {
        const avg = this.average(arr);
        return Math.sqrt(arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / (arr.length - 1));
    }
    calculateRRHistogram(numBins = 30) {
        if (this.rrIntervals.length === 0) return { labels: [], counts: [] };
        const minRR = Math.min(...this.rrIntervals);
        const maxRR = Math.max(...this.rrIntervals);
        const binWidth = (maxRR - minRR) / numBins || 1;
        const counts = Array(numBins).fill(0);
        this.rrIntervals.forEach(val => {
            let binIndex = Math.floor((val - minRR) / binWidth);
            if (binIndex >= numBins) binIndex = numBins - 1;
            counts[binIndex]++;
        });
        const labels = Array.from({length: numBins}, (_, i) => `${(minRR + i * binWidth).toFixed(0)}`);
        return { labels, counts };
    }
    analyzeFrequencyDomain(rr) {
        const fs = 4;
        const rrTimes = rr.reduce((acc, val) => [...acc, acc.length > 0 ? acc[acc.length - 1] + val / 1000 : val / 1000], []);
        const duration = rrTimes[rrTimes.length - 1];
        const uniformTimes = Array.from({ length: Math.floor(duration * fs) }, (_, i) => i / fs);
        const interpRRs = uniformTimes.map(t => {
            const i = rrTimes.findIndex(rt => rt >= t);
            if (i <= 0) return rr[0];
            if (i >= rrTimes.length) return rr[rr.length - 1];
            const t1 = rrTimes[i - 1], t2 = rrTimes[i], v1 = rr[i - 1], v2 = rr[i];
            return v1 + (v2 - v1) * (t - t1) / (t2 - t1);
        });
        const meanRR = this.average(interpRRs);
        const detrended = interpRRs.map(x => x - meanRR);
        const N = Math.pow(2, Math.ceil(Math.log2(detrended.length)));
        while (detrended.length < N) detrended.push(0);
        const X = Array.from({ length: N / 2 }, (_, k) => {
            let re = 0, im = 0;
            for (let n = 0; n < N; n++) {
                const angle = 2 * Math.PI * k * n / N;
                re += detrended[n] * Math.cos(angle);
                im -= detrended[n] * Math.sin(angle);
            }
            return { re, im };
        });
        const freqs = X.map((_, k) => k * fs / N);
        const psd = X.map(c => (c.re * c.re + c.im * c.im) / N);
        const bandPower = (band) => freqs.reduce((power, f, i) => (f >= band[0] && f < band[1]) ? power + psd[i] : power, 0);
        const vlfPower = bandPower([0.0033, 0.04]);
        const lfPower = bandPower([0.04, 0.15]);
        const hfPower = bandPower([0.15, 0.4]);
        return { vlfPower, lfPower, hfPower, lfHfRatio: hfPower > 0 ? lfPower / hfPower : 0, freqs, psd };
    }
}

// Ademhalingsanalyse
class BreathManager {
    constructor() {
        this.reset();
        this.cycleHistory = [];
    }
    reset() {
        this.lastHR = null;
        this.lastTimestamp = null;
        this.phase = 'Inspiration';
        this.cycles = [];
        this.currentCycle = { timeIn: 0, timeOut: 0, start: null };
        this.lastCompletedCycle = { inhaleTime: 0, exhaleTime: 0, tiTeRatio: 0, breathDepth: 'N/A' };
        this.breathRate = 0;
        this.cycleHistory = [];
    }
    update(avgHR) {
        if (typeof avgHR !== 'number' || isNaN(avgHR)) { return this.lastCompletedCycle; }
        const now = Date.now();
        if (this.lastHR !== null) {
            const dt = now - this.lastTimestamp;
            if (avgHR > this.lastHR) {
                if (this.phase !== 'Inspiration') {
                    if (this.currentCycle.timeOut > 0) {
                        this.cycles.push({ ...this.currentCycle });
                        this.lastCompletedCycle = this.getCurrentMetrics(this.currentCycle);
                        this.cycleHistory.push(this.lastCompletedCycle);
                        if (this.cycleHistory.length > 7) this.cycleHistory.shift();
                    }
                    if (this.cycles.length > 100) this.cycles.shift();
                    this.currentCycle = { timeIn: 0, timeOut: 0, start: now };
                    this.phase = 'Inspiration';
                }
                this.currentCycle.timeIn += dt;
            } else if (avgHR < this.lastHR) {
                if (this.phase !== 'Expiration') {
                    this.phase = 'Expiration';
                    if (this.currentCycle.timeIn > 0) {
                        this.cycles.push({ ...this.currentCycle });
                        this.lastCompletedCycle = this.getCurrentMetrics(this.currentCycle);
                        this.cycleHistory.push(this.lastCompletedCycle);
                        if (this.cycleHistory.length > 7) this.cycleHistory.shift();
                    }
                    if (this.cycles.length > 100) this.cycles.shift();
                    this.currentCycle = { timeIn: 0, timeOut: 0, start: now };
                }
                this.currentCycle.timeOut += dt;
            } else {
                if (this.phase === 'Inspiration') this.currentCycle.timeIn += dt;
                else this.currentCycle.timeOut += dt;
            }
        } else { this.currentCycle.start = now; }
        this.lastHR = avgHR;
        this.lastTimestamp = now;
        this.calculateBreathRate(now);
        return this.lastCompletedCycle;
    }
    calculateBreathRate(now) {
        const oneMinuteAgo = now - 60000;
        const recentCycles = this.cycles.filter(c => c.start > oneMinuteAgo);
        if (recentCycles.length > 0) { this.breathRate = recentCycles.length; }
    }
    getCurrentMetrics(cycle = this.currentCycle) {
        const { timeIn, timeOut } = cycle;
        const tiTeRatio = timeOut > 0 ? (timeIn / timeOut).toFixed(2) : 0;
        let breathDepth = 'Shallow';
        if (timeIn > 4000) breathDepth = 'Deep';
        else if (timeIn > 2000) breathDepth = 'Good';
        return { phase: this.phase, breathRate: this.breathRate, inhaleTime: timeIn, exhaleTime: timeOut, tiTeRatio: tiTeRatio, breathDepth: breathDepth };
    }
    getAverages(count = 0) {
        const data = count > 0 ? this.cycleHistory.slice(-count) : this.cycles;
        if (data.length === 0) {
            return { avgBreathRate: 0, avgTiTeRatio: 0 };
        }
        const totalBreathRate = data.reduce((sum, c) => sum + c.breathRate, 0);
        const totalTiTeRatio = data.reduce((sum, c) => sum + parseFloat(c.tiTeRatio), 0);
        return {
            avgBreathRate: totalBreathRate / data.length,
            avgTiTeRatio: totalTiTeRatio / data.length
        };
    }
}


// Functie voor rapportage, nu uitgebreid met nieuwe data
function generateReport(sessionData, measurementType, bodystandardAnalysis, vo2Analysis, runtimesVo2Analysis) {
    let reportContent = `
--- REST MEASUREMENT REPORT ---
Date: ${new Date().toLocaleDateString()}
Measurement Type: ${measurementType}

--- OVERVIEW ---
Duration: ${sessionData.totalDuration} seconds
Average Heart Rate: ${sessionData.avgHr.toFixed(0)} BPM
Calories Burned: ${sessionData.caloriesBurned} kcal

--- HRV ANALYSIS ---
RMSSD: ${sessionData.rmssd.toFixed(2)} MS
  - Explanation: RMSSD reflects the beat-to-beat variance in heart rate, primarily indicating parasympathetic nervous system activity. Higher values generally suggest better recovery and readiness.
  - Interpretation: `;
    if (sessionData.rmssd >= 70) {
        reportContent += `Excellent recovery and high parasympathetic activity. You are likely well-rested and ready for intense activity.
  - Improvement: Maintain healthy habits, ensure adequate sleep, and manage stress effectively.
`;
    } else if (sessionData.rmssd >= 50) {
        reportContent += `Good recovery. Your body is responding well to training and stress. Continue with your current recovery strategies.
  - Improvement: Focus on consistent sleep, balanced nutrition, and active recovery.
`;
    } else if (sessionData.rmssd >= 30) {
        reportContent += `Moderate recovery. You might be experiencing some fatigue or stress. Consider light activity or active recovery.
  - Improvement: Prioritize rest, reduce training intensity, and incorporate stress-reduction techniques.
`;
    } else {
        reportContent += `Low recovery. This may indicate significant fatigue, stress, or illness. Consider taking a rest day or consulting a professional.
  - Improvement: Complete rest, stress management, and re-evaluation of training load are crucial.
`;
    }
    reportContent += `SDNN: ${sessionData.sdnn.toFixed(2)} MS
  - Explanation: SDNN represents the overall variability of heart rate over a period. It reflects both sympathetic and parasympathetic nervous system activity.
  - Interpretation: `;
    if (sessionData.sdnn >= 100) {
        reportContent += `Very high overall HRV, indicating excellent adaptability and resilience.
`;
    } else if (sessionData.sdnn >= 50) {
        reportContent += `Good overall HRV, suggesting a healthy and adaptable cardiovascular system.
`;
    } else {
        reportContent += `Lower overall HRV, which can be a sign of chronic stress, overtraining, or underlying health issues.
`;
    }
    reportContent += `VLF Power: ${sessionData.vlfPower.toFixed(2)}
LF Power: ${sessionData.lfPower.toFixed(2)}
HF Power: ${sessionData.hfPower.toFixed(2)}

--- BREATHING ANALYSIS ---
Breathing Rate: ${sessionData.avgBreathRate.toFixed(1)} BPM
  - Explanation: Your breathing rate indicates how many breaths you take per minute. A lower resting breathing rate often correlates with better cardiovascular health and relaxation.
  - Interpretation: `;
    if (sessionData.avgBreathRate >= 16) {
        reportContent += `Elevated breathing rate. This could be due to stress, anxiety, or poor breathing habits.
  - Improvement: Practice diaphragmatic breathing exercises, mindfulness, and stress reduction techniques.
`;
    } else if (sessionData.avgBreathRate >= 12) {
        reportContent += `Normal breathing rate. Consistent, calm breathing is beneficial for overall health.
  - Improvement: Continue to be mindful of your breathing, especially during stressful situations.
`;
    } else if (sessionData.avgBreathRate >= 8) {
        reportContent += `Optimal breathing rate. This indicates good respiratory efficiency and a relaxed state.
  - Improvement: Maintain your current breathing patterns and consider advanced breathing techniques for performance enhancement.
`;
    } else {
        reportContent += `Very low breathing rate. While often good, extremely low rates might warrant professional consultation if accompanied by other symptoms.
  - Improvement: Ensure adequate oxygen intake and consult a specialist if concerned.
`;
    }

    if (bodystandardAnalysis && Object.keys(bodystandardAnalysis).length > 0) {
        reportContent += `
--- BODY COMPOSITION ANALYSIS ---
LBM: ${bodystandardAnalysis.LBM} kg
Fat Mass: ${bodystandardAnalysis.fatMass} kg
Muscle Mass: ${bodystandardAnalysis.muscleMass} kg
BMI: ${bodystandardAnalysis.bmi}
Ideal Weight (BMI): ${bodystandardAnalysis.idealWeightBMI} kg
Metabolic Age: ${bodystandardAnalysis.metabolicAge} years
BMR: ${bodystandardAnalysis.bmr} kcal/day
`;
    }
    if (vo2Analysis && Object.keys(vo2Analysis).length > 0) {
        reportContent += `
--- VO2 ANALYSIS ---
Maximal Oxygen Uptake: ${vo2Analysis.maximalOxygenUptake}
VO2 Standard: ${vo2Analysis.vo2Standard}
VO2 Max Potential: ${vo2Analysis.vo2MaxPotential}
Theoretical Max: ${vo2Analysis.theoreticalMax}
Warming Up HR: ${vo2Analysis.warmingUp} BPM
`;
        if (vo2Analysis.coolingDown) reportContent += `Cooling Down HR: ${vo2Analysis.coolingDown} BPM
`;
        if (vo2Analysis.endurance1) reportContent += `Endurance 1 HR: ${vo2Analysis.endurance1} BPM
`;
        if (vo2Analysis.endurance2) reportContent += `Endurance 2 HR: ${vo2Analysis.endurance2} BPM
`;
        if (vo2Analysis.endurance3) reportContent += `Endurance 3 HR: ${vo2Analysis.endurance3} BPM
`;
    }
    if (runtimesVo2Analysis && Object.keys(runtimesVo2Analysis).length > 0 && runtimesVo2Analysis.times) {
        reportContent += `
--- ESTIMATED RUN TIMES (based on VO2 Max) ---
`;
        for (const [distance, time] of Object.entries(runtimesVo2Analysis.times)) {
            const minutes = Math.floor(time / 60);
            const seconds = time % 60;
            reportContent += `${distance}: ${minutes}m ${seconds}s
`;
        }
    }
    reportContent += `
--- End of Report ---`;
    return reportContent;
}

function getHrvBasedRestZone(rmssd) {
    if (rmssd >= 70) return 'Relaxed';
    if (rmssd >= 50) return 'Rest';
    if (rmssd >= 30) return 'Active Low';
    if (rmssd >= 10) return 'Active High';
    return 'Transition to sportzones'
}

function getHrZone(currentHR, at, rmssd) {
    const warmupHrThreshold = at * 0.65;
    if (currentHR >= at * 1.06) return 'Intensive 2';
    if (currentHR >= at * 1.01) return 'Intensive 1';
    if (currentHR >= at) return 'AT';
    if (currentHR >= at * 0.90) return 'Endurance 3';
    if (currentHR >= at * 0.80) return 'Endurance 2';
    if (currentHR >= at * 0.70) return 'Endurance 1';
    if (currentHR >= warmupHrThreshold + 5) return 'Cooldown';
    if (currentHR >= warmupHrThreshold) return 'Warmup';
    return getHrvBasedRestZone(rmssd);
}

// Globale variabelen voor de grafieken en data
let hrChart, rrChart, rrHistogramChart, poincarePlotChart, powerSpectrumChart;
let hrData = [];
let rrData = [];
let selectedMeasurementType = 'resting';
let hrvAnalyzer;
let breathManager;

export async function initRestMeasurementLiveView_2(showViewCallback) {
    console.log("Geavanceerde Rustmeting View geïnitialiseerd.");
    const currentAppUserId = getOrCreateUserId();
    const bluetoothController = new BluetoothController();

    const measurementTypeSelect = document.getElementById('measurementTypeSelect');
    const liveHrDisplay = document.getElementById('liveHrDisplay');
    const liveHrZoneDisplay = document.getElementById('liveHrZoneDisplay');
    const liveAvgRrDisplay = document.getElementById('liveAvgRrDisplay');
    const liveRmssdDisplay = document.getElementById('liveRmssdDisplay');
    const liveBreathRateDisplay = document.getElementById('liveBreathRateDisplay');
    const liveTimerDisplay = document.getElementById('liveTimerDisplay');
    const startMeasurementBtnLive = document.getElementById('startMeasurementBtnLive');
    const stopMeasurementBtnLive = document.getElementById('stopMeasurementBtnLive');
    const saveMeasurementBtn = document.getElementById('saveMeasurementBtn');

    // Grafiek-contexts
    const hrChartCtx = document.getElementById('hrChart')?.getContext('2d');
    const rrChartCtx = document.getElementById('rrChart')?.getContext('2d');
    const rrHistogramChartCtx = document.getElementById('rrHistogramChart')?.getContext('2d');
    const poincarePlotChartCtx = document.getElementById('poincarePlotChart')?.getContext('2d');
    const powerSpectrumChartCtx = document.getElementById('powerSpectrumChart')?.getContext('2d');

    // UI-elementen voor de samenvattingswidgets
    const summaryAvgHr = document.getElementById('summaryAvgHr');
    const summaryMaxHr = document.getElementById('summaryMaxHr');
    const summaryMinHr = document.getElementById('summaryMinHr');
    const hrvRecoveryStatus = document.getElementById('hrvRecoveryStatus');
    const summaryRmssd = document.getElementById('summaryRmssd');
    const summarySdnn = document.getElementById('summarySdnn');
    const rpeDisplay = document.getElementById('rpeDisplay');
    const hrToMaxHr = document.getElementById('hrToMaxHr');
    const hrToAt = document.getElementById('hrToAt');
    const hrToRestHr = document.getElementById('hrToRestHr');
    const breathRateLast7 = document.getElementById('breathRateLast7');
    const breathRateTotal = document.getElementById('breathRateTotal');
    const tiTeRatioLast7 = document.getElementById('tiTeRatioLast7');
    const tiTeRatioTotal = document.getElementById('tiTeRatioTotal');
    const breathSummaryCard = document.getElementById('breathSummaryCard');
    const hrZonesVisualContainer = document.getElementById('hrZonesVisual'); // HR Zones Visual Container

    // User profile data (voor HR zones en berekeningen)
    let userProfile = await getData('userProfile', currentAppUserId);
    let userBaseAtHR = userProfile ? parseFloat(userProfile.userBaseAtHR) : 0;
    let userRestHR = userProfile ? parseFloat(userProfile.userRestHR) : 0;
    let userMaxHR = userProfile ? parseFloat(userProfile.userMaxHR) : 0;

    let measurementStartTime;
    let measurementInterval;
    let hrZoneInterval;
    let currentSessionData = {
        heartRates: [],
        rrIntervals: [],
        rawRrIntervals: [],
        timestamps: [],
        caloriesBurned: 0,
        totalDuration: 0,
        rmssd: 0,
        sdnn: 0,
        avgHr: 0,
        maxHr: 0,
        minHr: 0,
        avgBreathRate: 0,
        hrZonesTime: {
            'Resting': 0, 'Warmup': 0, 'Endurance 1': 0, 'Endurance 2': 0, 'Endurance 3': 0,
            'Intensive 1': 0, 'Intensive 2': 0, 'Cooldown': 0,
            'Relaxed': 0, 'Rest': 0, 'Active Low': 0, 'Active High': 0, 'Transition to sportzones': 0,
            'AT': 0 // Voeg AT zone toe
        },
        vlfPower: 0,
        lfPower: 0,
        hfPower: 0,
        pnn50: 0,
    };

    if (measurementTypeSelect) {
        selectedMeasurementType = measurementTypeSelect.value;
        measurementTypeSelect.addEventListener('change', (event) => {
            selectedMeasurementType = event.target.value;
            const breathDataCard = document.getElementById('breathSummaryCard');
            const breathLiveSummary = document.getElementById('breathLiveSummary');
            if (event.target.value === 'live_workout') {
                if (breathDataCard) breathDataCard.style.display = 'none';
                if (breathLiveSummary) breathLiveSummary.style.display = 'none';
            } else {
                if (breathDataCard) breathDataCard.style.display = 'block';
                if (breathLiveSummary) breathLiveSummary.style.display = 'block';
            }
            showNotification(`Metingstype ingesteld op: ${event.target.options[event.target.selectedIndex].text}`, 'info', 2000);
        });
    }

    function updateTimer() {
        if (measurementStartTime) {
            const elapsedSeconds = Math.floor((Date.now() - measurementStartTime) / 1000);
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            liveTimerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            currentSessionData.totalDuration = elapsedSeconds;
        }
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    function updateHrZoneTimes() {
        if (hrData.length > 0) {
            const currentHr = hrData[hrData.length - 1];
            const rmssd = hrvAnalyzer ? hrvAnalyzer.rmssd : 0;
            const zone = getHrZone(currentHr, userBaseAtHR, rmssd);

            if (currentSessionData.hrZonesTime[zone] !== undefined) {
                currentSessionData.hrZonesTime[zone]++;
            } else {
                currentSessionData.hrZonesTime[zone] = 1;
            }
            
            if (hrZonesVisualContainer) {
                hrZonesVisualContainer.innerHTML = ''; // Clear previous dots
                const hrZones = {
                    'Relaxed': 'bg-green-500',
                    'Rest': 'bg-lime-500',
                    'Active Low': 'bg-yellow-500',
                    'Active High': 'bg-red-500',
                    'Transition to sportzones': 'bg-orange-500',
                    'Resting': 'bg-gray-500',
                    'Warmup': 'bg-blue-500',
                    'Endurance 1': 'bg-green-600',
                    'Endurance 2': 'bg-green-700',
                    'Endurance 3': 'bg-green-800',
                    'Intensive 1': 'bg-red-600',
                    'Intensive 2': 'bg-red-700',
                    'Cooldown': 'bg-purple-500',
                    'AT': 'bg-red-900',
                };
                // Define the order of zones for display
                const orderedZones = [
                    'Intensive 2', 'Intensive 1', 'AT', 'Endurance 3', 'Endurance 2', 'Endurance 1',
                    'Cooldown', 'Warmup', 'Resting', 'Transition to sportzones', 'Active High', 'Active Low', 'Rest', 'Relaxed'
                ];
                
                // Create and append the visual elements for each zone
                orderedZones.forEach(zoneName => {
                    const timeInSeconds = currentSessionData.hrZonesTime[zoneName] || 0;
                    const formattedTime = formatTime(timeInSeconds);
                    const zoneColor = hrZones[zoneName] || 'bg-gray-500'; // Default gray if color not found

                    const zoneBar = document.createElement('div');
                    zoneBar.className = `flex flex-col items-center justify-end w-8 h-20 bg-gray-700 rounded-md relative overflow-hidden`; // Vertical bar
                    zoneBar.style.minWidth = '32px'; // Make bars twice as wide (w-8 is 32px)
                    zoneBar.style.margin = '0 2px'; // Small gap between bars

                    // Colored fill for the bar (based on time percentage)
                    const totalTime = currentSessionData.totalDuration > 0 ? currentSessionData.totalDuration : 1;
                    const fillHeight = (timeInSeconds / totalTime) * 100;
                    const fillElement = document.createElement('div');
                    fillElement.className = `w-full ${zoneColor}`;
                    fillElement.style.height = `${fillHeight}%`;
                    fillElement.style.transition = 'height 0.5s ease-out';
                    fillElement.style.position = 'absolute';
                    fillElement.style.bottom = '0';
                    zoneBar.appendChild(fillElement);

                    // Dot for the current active zone
                    if (liveHrZoneDisplay.textContent === zoneName) { // Check against the actual zone name
                        const dot = document.createElement('div');
                        dot.className = `w-3 h-3 rounded-full bg-white absolute bottom-1 left-1/2 -translate-x-1/2`; // White dot
                        dot.style.boxShadow = '0 0 5px rgba(255,255,255,0.8)';
                        zoneBar.appendChild(dot);
                    }

                    // Tooltip (label and time)
                    const tooltip = document.createElement('span');
                    tooltip.className = `tooltiptext absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-1 text-xs text-white bg-gray-700 rounded opacity-0 transition-opacity duration-300 whitespace-nowrap`;
                    tooltip.textContent = `${zoneName}: ${formattedTime}`;
                    zoneBar.appendChild(tooltip);

                    hrZonesVisualContainer.appendChild(zoneBar);
                });
            }
        }
    }

    function getHrvBasedRestZone(rmssd) {
        if (rmssd >= 70) return 'Relaxed';
        if (rmssd >= 50) return 'Rest';
        if (rmssd >= 30) return 'Active Low';
        if (rmssd >= 10) return 'Active High';
        return 'Transition to sportzones'
    }

    function getHrZone(currentHR, at, rmssd) {
        const warmupHrThreshold = at * 0.65;
        if (currentHR >= at * 1.06) return 'Intensive 2';
        if (currentHR >= at * 1.01) return 'Intensive 1';
        if (currentHR >= at) return 'AT';
        if (currentHR >= at * 0.90) return 'Endurance 3';
        if (currentHR >= at * 0.80) return 'Endurance 2';
        if (currentHR >= at * 0.70) return 'Endurance 1';
        if (currentHR >= warmupHrThreshold + 5) return 'Cooldown';
        if (currentHR >= warmupHrThreshold) return 'Warmup';
        return getHrvBasedRestZone(rmssd);
    }
    
    function calculateRpe(currentHR, maxHR) {
        if (!currentHR || !maxHR || maxHR <= 0) return '--';
        const rpe = (currentHR / maxHR) * 10;
        return rpe.toFixed(1);
    }

    function getBreathRateColorClass(bpm) {
        if (bpm >= 8 && bpm <= 12) {
            return 'text-green-400';
        } else if ((bpm >= 6 && bpm < 8) || (bpm > 12 && bpm <= 15)) {
            return 'text-orange-400';
        } else if (bpm > 15 || bpm < 6) {
            return 'text-red-400';
        }
        return '';
    }

    function updateSummaryStatistics(dataPacket, hrvAnalyzer, breathManager) {
        // HR Summary
        if (hrData.length > 0) {
            const avgHr = hrData.reduce((sum, hr) => sum + hr, 0) / hrData.length;
            const maxHr = currentSessionData.maxHr;
            const minHr = currentSessionData.minHr;
            const currentHr = dataPacket.heartRate;

            if (summaryAvgHr) summaryAvgHr.textContent = avgHr.toFixed(0);
            if (summaryMaxHr) summaryMaxHr.textContent = maxHr.toFixed(0);
            if (summaryMinHr) summaryMinHr.textContent = minHr.toFixed(0);

            if (userMaxHR > 0 && rpeDisplay) {
                const rpeScore = calculateRpe(currentHr, userMaxHR);
                rpeDisplay.textContent = rpeScore;
            }
            if (userMaxHR > 0 && hrToMaxHr) {
                const hrToMaxHrPercentage = ((currentHr / userMaxHR) * 100).toFixed(0);
                hrToMaxHr.textContent = `${hrToMaxHrPercentage}%`;
            }
            if (userBaseAtHR > 0 && hrToAt) {
                const hrToAtPercentage = ((currentHr / userBaseAtHR) * 100).toFixed(0);
                hrToAt.textContent = `${hrToAtPercentage}%`;
            }
            if (userRestHR > 0 && hrToRestHr) {
                const hrToRestHrPercentage = ((currentHr / userRestHR) * 100).toFixed(0);
                hrToRestHr.textContent = `${hrToRestHrPercentage}%`;
            }
            if (liveHrDisplay) liveHrDisplay.textContent = `${currentHr} BPM`;
        } else {
            if (summaryAvgHr) summaryAvgHr.textContent = '--';
            if (summaryMaxHr) summaryMaxHr.textContent = '--';
            if (summaryMinHr) summaryMinHr.textContent = '--';
            if (rpeDisplay) rpeDisplay.textContent = '--';
            if (hrToMaxHr) hrToMaxHr.textContent = '--';
            if (hrToAt) hrToAt.textContent = '--';
            if (hrToRestHr) hrToRestHr.textContent = '--';
            if (liveHrDisplay) liveHrDisplay.textContent = '-- BPM';
        }

        if (hrvAnalyzer && hrvAnalyzer.n >= 2) {
            if (summaryRmssd) summaryRmssd.textContent = hrvAnalyzer.rmssd.toFixed(2);
            if (summarySdnn) summarySdnn.textContent = hrvAnalyzer.sdnn.toFixed(2);
        } else {
            if (summaryRmssd) summaryRmssd.textContent = '--';
            if (summarySdnn) summarySdnn.textContent = '--';
        }
        
        if (breathManager && selectedMeasurementType !== 'live_workout') {
            const last7Avg = breathManager.getAverages(7);
            const totalAvg = breathManager.getAverages();
            
            if (breathRateLast7) breathRateLast7.textContent = last7Avg.avgBreathRate.toFixed(1);
            if (breathRateTotal) breathRateTotal.textContent = totalAvg.avgBreathRate.toFixed(1);
            if (tiTeRatioLast7) tiTeRatioLast7.textContent = last7Avg.avgTiTeRatio.toFixed(2);
            if (tiTeRatioTotal) tiTeRatioTotal.textContent = totalAvg.avgTiTeRatio.toFixed(2);

            if (liveBreathRateDisplay) {
                const colorClass = getBreathRateColorClass(totalAvg.avgBreathRate);
                liveBreathRateDisplay.className = `main-value ${colorClass}`;
                liveBreathRateDisplay.textContent = `${totalAvg.avgBreathRate.toFixed(1)} BPM`;
            }
        } else if (breathSummaryCard) {
            breathSummaryCard.style.display = 'none';
            if (liveBreathRateDisplay) liveBreathRateDisplay.textContent = '-- BPM';
        } else {
            if (breathRateLast7) breathRateLast7.textContent = '--';
            if (breathRateTotal) breathRateTotal.textContent = '--';
            if (tiTeRatioLast7) tiTeRatioLast7.textContent = '--';
            if (tiTeRatioTotal) tiTeRatioTotal.textContent = '--';
            if (liveBreathRateDisplay) liveBreathRateDisplay.textContent = '-- BPM';
        }
    }


    const initCharts = () => {
        const createChart = (ctx, type, data, options) => {
            if (ctx) {
                return new Chart(ctx, { type, data, options });
            }
            return null;
        };
        const createLineConfig = (label, color, yAxisID) => ({
            label, data: [], borderColor: color, tension: 0.4, fill: false, yAxisID
        });
        const createRawDataConfig = (label, color) => ({
            label, data: [], borderColor: color, borderWidth: 1, borderDash: [5, 5], pointRadius: 0
        });

        if (hrChart) hrChart.destroy();
        hrChart = createChart(hrChartCtx, 'line', {
            labels: [],
            datasets: [
                createLineConfig('Hartslag (BPM)', '#f87171', 'y-hr'),
                createLineConfig('RR Interval (ms / 10)', '#a78bfa', 'y-rr'),
                createLineConfig('Ademhaling (BPM)', '#4ade80', 'y-breath'),
                // Nieuwe dataset voor ruwe, ongefilterde RR data op de achtergrond
                {
                    label: 'Ruwe RR (achtergrond)',
                    data: [],
                    borderColor: 'rgba(255, 255, 255, 0.1)', // Zeer lichtgrijs
                    borderWidth: 1,
                    borderDash: [2, 2], // Gestippelde lijn
                    pointRadius: 0,
                    fill: false,
                    yAxisID: 'y-rr', // Gebruik dezelfde y-as als gefilterde RR
                    hidden: false // Standaard zichtbaar
                }
            ]
        }, {
            responsive: true, maintainAspectRatio: false,
            scales: {
                'y-hr': { type: 'linear', position: 'left', beginAtZero: true, min: 40, max: 200, title: { display: true, text: 'Hartslag (BPM)' } },
                'y-rr': { type: 'linear', position: 'right', beginAtZero: true, min: 40, max: 120, title: { display: true, text: 'RR (ms / 10)' }, grid: { drawOnChartArea: false } },
                'y-breath': { type: 'linear', position: 'right', beginAtZero: true, min: 0, max: 30, title: { display: true, text: 'Ademhaling (BPM)' }, grid: { drawOnChartArea: false } },
                x: { display: false }
            },
            animation: false
        });

        // RR Chart (deze is verwijderd uit de HTML, dus deze code wordt niet uitgevoerd)
        // if (rrChart) rrChart.destroy();
        // rrChart = createChart(rrChartCtx, 'line', {
        //     labels: [],
        //     datasets: [
        //         createRawDataConfig('Ruwe RR Interval (ms)', 'rgba(167, 139, 250, 0.3)'),
        //         createLineConfig('Gefilterde RR Interval (ms)', '#a78bfa', 'y')
        //     ]
        // }, {
        //     responsive: true, maintainAspectRatio: false,
        //     scales: { y: { beginAtZero: true, min: 400, max: 1200, title: { display: true, text: 'RR Interval (ms)' } }, x: { display: false } },
        //     animation: false
        // });

        if (rrHistogramChart) rrHistogramChart.destroy();
        rrHistogramChart = createChart(rrHistogramChartCtx, 'bar', {
            labels: [],
            datasets: [{ label: 'Frequentie', data: [], backgroundColor: '#4ade80' }]
        }, {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { title: { display: true, text: 'RR Interval (ms)' } }, y: { beginAtZero: true, title: { display: true, text: 'Aantal' } } }
        });

        if (poincarePlotChart) poincarePlotChart.destroy();
        poincarePlotChart = createChart(poincarePlotChartCtx, 'scatter', {
            datasets: [
                { label: 'Ruwe RR', data: [], backgroundColor: 'rgba(252, 211, 77, 0.5)', pointRadius: 2 },
                { label: 'Gefilterde RR', data: [], backgroundColor: '#facc15', pointRadius: 3 }
            ]
        }, {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { title: { display: true, text: 'RR(n) (ms)' } }, y: { title: { display: true, text: 'RR(n+1) (ms)' } } },
            animation: false
        });

        if (powerSpectrumChart) powerSpectrumChart.destroy();
        powerSpectrumChart = createChart(powerSpectrumChartCtx, 'bar', {
            labels: ['VLF', 'LF', 'HF'],
            datasets: [{ label: 'Relatieve Kracht', data: [0, 0, 0], backgroundColor: ['#c084fc', '#22d3ee', '#f97316'] }]
        }, {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { title: { display: true, text: 'Frequentieband' } }, y: { beginAtZero: true, title: { display: true, text: 'Relatieve Kracht' } } }
        });
    };
    initCharts();

    bluetoothController.onStateChange = (state, deviceName) => {
        if (state === 'STREAMING') {
            if (startMeasurementBtnLive) startMeasurementBtnLive.style.display = 'none';
            if (stopMeasurementBtnLive) stopMeasurementBtnLive.style.display = 'block';
            measurementStartTime = Date.now();
            measurementInterval = setInterval(updateTimer, 1000);
            hrZoneInterval = setInterval(updateHrZoneTimes, 1000);
            showNotification(`Bluetooth verbonden met ${deviceName || 'apparaat'}!`, 'success');
            if (measurementTypeSelect) measurementTypeSelect.disabled = true;
        } else if (state === 'ERROR') {
            showNotification('Bluetooth verbinding mislukt of geannuleerd.', 'error');
            if (startMeasurementBtnLive) startMeasurementBtnLive.style.display = 'block';
            if (stopMeasurementBtnLive) stopMeasurementBtnLive.style.display = 'none';
            if (measurementTypeSelect) measurementTypeSelect.disabled = false;
        } else if (state === 'STOPPED') {
            showNotification('Bluetooth meting gestopt.', 'info');
            clearInterval(measurementInterval);
            clearInterval(hrZoneInterval);
            if (startMeasurementBtnLive) startMeasurementBtnLive.style.display = 'block';
            if (stopMeasurementBtnLive) stopMeasurementBtnLive.style.display = 'none';
            if (saveMeasurementBtn) saveMeasurementBtn.style.display = 'block';
            if (measurementTypeSelect) measurementTypeSelect.disabled = false;
            updateSummaryStatistics({ heartRate: hrData[hrData.length - 1] }, hrvAnalyzer, breathManager);
        }
    };

    function simulateBreathingFromRr(rrIntervals) {
        if (!rrIntervals || rrIntervals.length === 0) return [];
        const breathingWave = [];
        for (const rr of rrIntervals) {
            const hr = 60000 / rr;
            let amplitude = hr * 4 - 200;
            amplitude = Math.min(Math.max(amplitude, 20), 120);
            breathingWave.push(amplitude);
        }
        return smooth(breathingWave, 5);
    }

    function smooth(data, windowSize = 5) {
        const smoothed = [];
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - windowSize + 1);
            const window = data.slice(start, i + 1);
            const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
            smoothed.push(avg);
        }
        return smoothed;
    }


    bluetoothController.onData = async (dataPacket) => {
        const userProfile = await getData('userProfile', currentAppUserId);
        const userBaseAtHR = userProfile ? parseFloat(userProfile.userBaseAtHR) : 0;
        const userMaxHR = userProfile ? parseFloat(userProfile.userMaxHR) : 0;
        const userRestHR = userProfile ? parseFloat(userProfile.userRestHR) : 0;

        const now = new Date().toLocaleTimeString();
        hrData.push(dataPacket.heartRate);
        currentSessionData.heartRates.push(dataPacket.heartRate);
        currentSessionData.timestamps.push(now);
        currentSessionData.maxHr = Math.max(...hrData);
        currentSessionData.minHr = Math.min(...hrData);

        let breathSignal = [];
        let scaledRr = [];
        let rrLabels = [];

        if (dataPacket.filteredRrIntervals && dataPacket.filteredRrIntervals.length > 0) {
            const avgRr = dataPacket.filteredRrIntervals.reduce((sum, val) => sum + val, 0) / dataPacket.filteredRrIntervals.length;
            if (liveAvgRrDisplay) liveAvgRrDisplay.textContent = `${avgRr.toFixed(0)} MS`;

            dataPacket.filteredRrIntervals.forEach(rr => {
                rrData.push(rr);
                currentSessionData.rrIntervals.push(rr);
            });
            
            dataPacket.rawRrIntervals.forEach(rr => {
                currentSessionData.rawRrIntervals.push(rr);
            });

            if (rrData.length >= 2) {
                hrvAnalyzer = new HRVAnalyzer(rrData);
                currentSessionData.rmssd = hrvAnalyzer.rmssd;
                currentSessionData.sdnn = hrvAnalyzer.sdnn;
                currentSessionData.vlfPower = hrvAnalyzer.frequency.vlfPower;
                currentSessionData.lfPower = hrvAnalyzer.frequency.lfPower;
                currentSessionData.hfPower = hrvAnalyzer.frequency.hfPower;
                currentSessionData.pnn50 = hrvAnalyzer.pnn50;
                if (liveRmssdDisplay) liveRmssdDisplay.textContent = `RMSSD: ${currentSessionData.rmssd.toFixed(2)} MS`;
            }

            // Only update breathManager if not in 'live_workout' mode
            if (selectedMeasurementType !== 'live_workout') {
                if (!breathManager) { // Ensure breathManager is only initialized once per measurement
                    breathManager = new BreathManager();
                }
                breathManager.update(dataPacket.heartRate);
            }
            
            breathSignal = simulateBreathingFromRr(dataPacket.filteredRrIntervals);
            scaledRr = dataPacket.filteredRrIntervals.map(rr => rr / 10);
            rrLabels = dataPacket.filteredRrIntervals.map(() => new Date().toLocaleTimeString());

            const rrChartRawData = dataPacket.rawRrIntervals || [];
            if (hrChart) { // Update hrChart with raw RR data
                const hrChartDatasetRawRR = hrChart.data.datasets[3]; // Assuming index 3 for raw RR
                if (hrChartDatasetRawRR) {
                    hrChartDatasetRawRR.data.push(rrChartRawData[0] / 10 || null); // Scale raw RR for this chart
                }
            }
            
            if (hrvAnalyzer && hrvAnalyzer.n >= 30) {
                if (rrHistogramChart) {
                    rrHistogramChart.data.labels = hrvAnalyzer.rrHistogram.labels;
                    rrHistogramChart.data.datasets[0].data = hrvAnalyzer.rrHistogram.counts;
                    rrHistogramChart.update();
                }
                if (poincarePlotChart) {
                    const poincareDataFiltered = rrData.slice(0, -1).map((val, i) => ({ x: val, y: rrData[i + 1] }));
                    poincarePlotChart.data.datasets[0].data = poincareDataFiltered;
                    poincarePlotChart.update();
                }
                if (powerSpectrumChart) {
                    const { vlfPower, lfPower, hfPower } = hrvAnalyzer.frequency;
                    const totalPower = vlfPower + lfPower + hfPower;
                    if (totalPower > 0) {
                        powerSpectrumChart.data.datasets[0].data = [
                            (vlfPower / totalPower) * 100,
                            (lfPower / totalPower) * 100,
                            (hfPower / totalPower) * 100
                        ];
                        powerSpectrumChart.update();
                    }
                }
            }
        }
        
        if (hrChart) {
            hrChart.data.labels.push(now);
            hrChart.data.datasets[0].data.push(dataPacket.heartRate);
            hrChart.data.datasets[1].data.push(scaledRr[0] || null);
            hrChart.data.datasets[2].data.push(breathSignal[0] || null);

            const maxDataPoints = 100;
            if (hrChart.data.labels.length > maxDataPoints) {
                hrChart.data.labels.shift();
                hrChart.data.datasets[0].data.shift();
                hrChart.data.datasets[1].data.shift();
                hrChart.data.datasets[2].data.shift();
                if (hrChart.data.datasets[3]) hrChart.data.datasets[3].data.shift(); // Shift raw RR data too
            }
            hrChart.update();
        }
        
        if (liveHrZoneDisplay) {
            const currentHr = dataPacket.heartRate;
            const rmssd = hrvAnalyzer ? hrvAnalyzer.rmssd : 0;
            liveHrZoneDisplay.textContent = getHrZone(currentHr, userBaseAtHR, rmssd);
        }

        updateSummaryStatistics(dataPacket, hrvAnalyzer, breathManager);
    };

    if (startMeasurementBtnLive) {
        startMeasurementBtnLive.addEventListener('click', async () => {
            hrData = [];
            rrData = [];
            currentSessionData = {
                heartRates: [], rrIntervals: [], rawRrIntervals: [], timestamps: [], caloriesBurned: 0,
                totalDuration: 0, rmssd: 0, sdnn: 0, avgHr: 0, maxHr: 0, minHr: 0, avgBreathRate: 0, hrZonesTime: {
                    'Resting': 0, 'Warmup': 0, 'Endurance 1': 0, 'Endurance 2': 0, 'Endurance 3': 0,
                    'Intensive 1': 0, 'Intensive 2': 0, 'Cooldown': 0,
                },
                vlfPower: 0, lfPower: 0, hfPower: 0, pnn50: 0,
            };
            hrvAnalyzer = null; // Reset analyzer
            breathManager = new BreathManager(); // Reset manager

            userProfile = await getData('userProfile', currentAppUserId);
            userBaseAtHR = userProfile ? parseFloat(userProfile.userBaseAtHR) : 0;
            userRestHR = userProfile ? parseFloat(userProfile.userRestHR) : 0;
            userMaxHR = userProfile ? parseFloat(userProfile.userMaxHR) : 0;

            initCharts();
            if (liveTimerDisplay) liveTimerDisplay.textContent = '00:00';
            if (saveMeasurementBtn) saveMeasurementBtn.style.display = 'none';

            if (!bluetoothController.isConnected()) {
                bluetoothController.setPreset(selectedMeasurementType);
                bluetoothController.connect();
            } else {
                bluetoothController.onStateChange('STREAMING', bluetoothController.device.name);
            }
        });
    }

    if (stopMeasurementBtnLive) {
        stopMeasurementBtnLive.addEventListener('click', async () => {
            bluetoothController.disconnect();
            if (currentSessionData.heartRates.length > 0) {
                const totalHr = currentSessionData.heartRates.reduce((sum, hr) => sum + hr, 0);
                currentSessionData.avgHr = totalHr / currentSessionData.heartRates.length;
                currentSessionData.caloriesBurned = (currentSessionData.avgHr * currentSessionData.totalDuration / 60 / 10).toFixed(0);
                if (breathManager && breathManager.cycles.length > 0) {
                     currentSessionData.avgBreathRate = breathManager.getAverages().avgBreathRate;
                }

                const userProfile = await getData('userProfile', currentAppUserId);
                let bodystandardAnalysis = {}, vo2Analysis = {}, runtimesVo2Analysis = {};
                if (userProfile) {
                    const { gender, age, weight, height, fatPercentage, maxWatt, userBaseAtHR } = userProfile;
                    if (gender && age && weight && height && fatPercentage) {
                        bodystandardAnalysis = new Bodystandard({ gender, age, weight, height, fatPercentage });
                    }
                    if (age && height && weight && maxWatt && userBaseAtHR && fatPercentage && gender) {
                        vo2Analysis = new VO2({ age, height, weight, maxWatt, at: userBaseAtHR, fatPercentage, gender });
                    }
                    if (vo2Analysis.maximalOxygenUptake) {
                        runtimesVo2Analysis = new RuntimesVo2(vo2Analysis.maximalOxygenUptake);
                    }
                }
                const report = generateReport(currentSessionData, selectedMeasurementType, bodystandardAnalysis, vo2Analysis, runtimesVo2Analysis);
                console.log("Generated Report:\n", report);

                // Attempting to capture charts with html2canvas.
                const chartsToCapture = [
                    { id: 'hrChart', chart: hrChart },
                    { id: 'rrHistogramChart', chart: rrHistogramChart },
                    { id: 'poincarePlotChart', chart: poincarePlotChart },
                    { id: 'powerSpectrumChart', chart: powerSpectrumChart }
                ];

                const capturedImages = {};
                for (const { id, chart } of chartsToCapture) {
                    const canvas = document.getElementById(id);
                    if (canvas && chart) {
                        // Temporarily make chart visible for html2canvas if it's hidden
                        const originalDisplay = canvas.style.display;
                        canvas.style.display = 'block';
                        try {
                            const img = await html2canvas(canvas);
                            capturedImages[id] = img.toDataURL('image/png');
                        } catch (error) {
                            console.error(`Error capturing chart ${id}:`, error);
                        } finally {
                            canvas.style.display = originalDisplay; // Restore original display
                        }
                    }
                }

                // Generate PDF
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                let yPos = 10;

                doc.text(report, 10, yPos);
                yPos += report.split('\n').length * 5; // Estimate line height;

                for (const { id } of chartsToCapture) {
                    if (capturedImages[id]) {
                        doc.addImage(capturedImages[id], 'PNG', 10, yPos, 180, 90);
                        yPos += 100;
                    }
                }

                doc.save(`rest_measurement_report_${new Date().toISOString().split('T')[0]}.pdf`);
                showNotification('Rapport succesvol gedownload!', 'success');
            }
        });
    }

    if (saveMeasurementBtn) {
        saveMeasurementBtn.addEventListener('click', async () => {
            if (currentSessionData.totalDuration > 0) {
                const sessionToSave = {
                    userId: currentAppUserId,
                    type: selectedMeasurementType,
                    date: new Date().toISOString().split('T')[0],
                    duration: currentSessionData.totalDuration / 60,
                    avgHr: currentSessionData.avgHr.toFixed(0),
                    rmssd: currentSessionData.rmssd,
                    caloriesBurned: currentSessionData.caloriesBurned,
                    rawHrData: currentSessionData.heartRates,
                    rawRrData: currentSessionData.rrIntervals,
                    timestamps: currentSessionData.timestamps,
                    sdnn: currentSessionData.sdnn,
                    vlfPower: currentSessionData.vlfPower,
                    lfPower: currentSessionData.lfPower,
                    hfPower: currentSessionData.hfPower,
                };

                try {
                    await putData('restSessionsAdvanced', sessionToSave);
                    showNotification('Meting succesvol opgeslagen!', 'success');
                    if (showViewCallback) {
                        showViewCallback('trainingReportsView');
                    }
                } catch (error) {
                    console.error("Fout bij opslaan meting:", error);
                    showNotification('Fout bij opslaan meting.', 'error');
                }
            } else {
                showNotification('Geen metingsdata om op te slaan.', 'warning');
            }
        });
    }

    if (saveMeasurementBtn) saveMeasurementBtn.style.display = 'none';
}