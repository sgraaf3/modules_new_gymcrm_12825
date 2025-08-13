// Bestand: js/measurement_utils.js
// Bevat gedeelde logica en klassen voor metingen en rapportgeneratie.

import { Bodystandard, VO2, RuntimesVo2 } from './rr_hr_hrv_engine.js'; // Assuming these are still needed and correctly imported

// HRV-analyse (moved from restMeasurementLiveView_2.js)
export class HRVAnalyzer {
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
        // Simplified FFT placeholder for frequency domain analysis
        // In a real scenario, you'd use a dedicated library (e.g., 'fft.js')
        const fs = 4; // Sampling frequency (Hz), assuming 4Hz for interpolation
        const rrTimes = rr.reduce((acc, val) => [...acc, acc.length > 0 ? acc[acc.length - 1] + val / 1000 : val / 1000], []);
        const duration = rrTimes[rrTimes.length - 1];

        if (duration === 0 || isNaN(duration)) { // Handle cases with insufficient data for duration
            return { vlfPower: 0, lfPower: 0, hfPower: 0, lfHfRatio: 0, freqs: [], psd: [] };
        }

        const uniformTimes = Array.from({ length: Math.floor(duration * fs) }, (_, i) => i / fs);
        
        // Simple linear interpolation
        const interpRRs = uniformTimes.map(t => {
            const i = rrTimes.findIndex(rt => rt >= t);
            if (i <= 0) return rr[0]; // Before first point
            if (i >= rrTimes.length) return rr[rr.length - 1]; // After last point
            
            const t1 = rrTimes[i - 1];
            const t2 = rrTimes[i];
            const v1 = rr[i - 1];
            const v2 = rr[i];

            // Avoid division by zero if t1 === t2
            if (t2 - t1 === 0) return v1;

            return v1 + (v2 - v1) * (t - t1) / (t2 - t1);
        });

        if (interpRRs.length === 0) {
            return { vlfPower: 0, lfPower: 0, hfPower: 0, lfHfRatio: 0, freqs: [], psd: [] };
        }

        const meanRR = this.average(interpRRs);
        const detrended = interpRRs.map(x => x - meanRR);

        // Pad with zeros to the next power of 2 for FFT
        const N = Math.pow(2, Math.ceil(Math.log2(detrended.length)));
        while (detrended.length < N) detrended.push(0);

        // Basic FFT (simplified, not a full optimized FFT algorithm)
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
        const psd = X.map(c => (c.re * c.re + c.im * c.im) / N); // Power Spectral Density

        // Band power calculation
        const bandPower = (band) => freqs.reduce((power, f, i) => (f >= band[0] && f < band[1]) ? power + psd[i] : power, 0);

        const vlfPower = bandPower([0.0033, 0.04]);
        const lfPower = bandPower([0.04, 0.15]);
        const hfPower = bandPower([0.15, 0.4]);

        return { vlfPower, lfPower, hfPower, lfHfRatio: hfPower > 0 ? lfPower / hfPower : 0, freqs, psd };
    }
}

// Ademhalingsanalyse (moved from restMeasurementLiveView_2.js)
export class BreathManager {
    constructor() {
        this.reset();
        this.cycleHistory = []; // Stores recent cycle metrics for averages
    }

    reset() {
        this.lastHR = null;
        this.lastTimestamp = null;
        this.phase = 'Inspiration'; // Current breathing phase
        this.cycles = []; // Stores completed breathing cycles
        this.currentCycle = { timeIn: 0, timeOut: 0, start: null }; // Data for the current incomplete cycle
        this.lastCompletedCycle = { inhaleTime: 0, exhaleTime: 0, tiTeRatio: 0, breathDepth: 'N/A' };
        this.breathRate = 0; // Instantaneous breath rate
        this.cycleHistory = [];
    }

    /**
     * Updates the breathing analysis with a new average heart rate.
     * This is a simplified model based on HR changes.
     * @param {number} avgHR - The current average heart rate.
     * @returns {object} Metrics of the last completed breathing cycle.
     */
    update(avgHR) {
        if (typeof avgHR !== 'number' || isNaN(avgHR)) { return this.lastCompletedCycle; } // Ensure valid input

        const now = Date.now();
        if (this.lastHR !== null) {
            const dt = now - this.lastTimestamp;

            if (avgHR > this.lastHR) { // Heart rate increasing - likely inspiration
                if (this.phase !== 'Inspiration') {
                    // Phase change from expiration to inspiration, means a cycle just completed
                    if (this.currentCycle.timeOut > 0) { // Ensure there was an exhale phase
                        this.cycles.push({ ...this.currentCycle }); // Save completed cycle
                        this.lastCompletedCycle = this.getCurrentMetrics(this.currentCycle);
                        this.cycleHistory.push(this.lastCompletedCycle);
                        if (this.cycleHistory.length > 7) this.cycleHistory.shift(); // Keep last 7 cycles for short-term average
                    }
                    // Reset for new inspiration phase
                    this.currentCycle = { timeIn: 0, timeOut: 0, start: now };
                    this.phase = 'Inspiration';
                }
                this.currentCycle.timeIn += dt;
            } else if (avgHR < this.lastHR) { // Heart rate decreasing - likely expiration
                if (this.phase !== 'Expiration') {
                    // Phase change from inspiration to expiration
                    if (this.currentCycle.timeIn > 0) { // Ensure there was an inhale phase
                        this.cycles.push({ ...this.currentCycle }); // Save completed cycle
                        this.lastCompletedCycle = this.getCurrentMetrics(this.currentCycle);
                        this.cycleHistory.push(this.lastCompletedCycle);
                        if (this.cycleHistory.length > 7) this.cycleHistory.shift();
                    }
                    // Reset for new expiration phase
                    this.currentCycle = { timeIn: 0, timeOut: 0, start: now };
                    this.phase = 'Expiration';
                }
                this.currentCycle.timeOut += dt;
            } else {
                // Heart rate stable, continue current phase
                if (this.phase === 'Inspiration') this.currentCycle.timeIn += dt;
                else this.currentCycle.timeOut += dt;
            }
        } else {
            // First data point
            this.currentCycle.start = now;
        }

        this.lastHR = avgHR;
        this.lastTimestamp = now;
        this.calculateBreathRate(now); // Update instantaneous breath rate
        return this.lastCompletedCycle;
    }

    /**
     * Calculates the instantaneous breathing rate based on recent cycles.
     * @param {number} now - Current timestamp.
     */
    calculateBreathRate(now) {
        const oneMinuteAgo = now - 60000; // 60 seconds in milliseconds
        const recentCycles = this.cycles.filter(c => c.start > oneMinuteAgo);
        if (recentCycles.length > 0) {
            this.breathRate = recentCycles.length;
        } else if (this.currentCycle.start && (now - this.currentCycle.start) < 60000) {
            // If no full cycles in last minute, estimate based on current partial cycle
            const elapsedSeconds = (now - this.currentCycle.start) / 1000;
            if (elapsedSeconds > 0) {
                this.breathRate = (1 / elapsedSeconds) * 60; // Approximate rate if only one cycle
            }
        } else {
            this.breathRate = 0; // No recent activity
        }
    }

    /**
     * Gets metrics for a specific cycle or the current incomplete cycle.
     * @param {object} [cycle=this.currentCycle] - The cycle object.
     * @returns {object} Calculated metrics for the cycle.
     */
    getCurrentMetrics(cycle = this.currentCycle) {
        const { timeIn, timeOut } = cycle;
        const tiTeRatio = timeOut > 0 ? (timeIn / timeOut) : 0; // Calculate Ti/Te ratio
        
        let breathDepth = 'N/A'; // Placeholder for breath depth interpretation
        if (timeIn + timeOut > 5000) breathDepth = 'Deep'; // Example thresholds
        else if (timeIn + timeOut > 2000) breathDepth = 'Normal';
        else breathDepth = 'Shallow';

        return {
            phase: this.phase,
            breathRate: this.breathRate, // Instantaneous rate when this cycle completed
            inhaleTime: timeIn,
            exhaleTime: timeOut,
            tiTeRatio: tiTeRatio.toFixed(2),
            breathDepth: breathDepth
        };
    }

    /**
     * Calculates average breathing rate and Ti/Te ratio over a specified number of recent cycles.
     * @param {number} [count=0] - Number of recent cycles to average. If 0, averages all stored cycles.
     * @returns {object} Object containing average breath rate and Ti/Te ratio.
     */
    getAverages(count = 0) {
        const data = count > 0 ? this.cycleHistory.slice(-count) : this.cycleHistory; // Use cycleHistory for averages
        if (data.length === 0) {
            return { avgBreathRate: 0, avgTiTeRatio: 0 };
        }
        const totalBreathRate = data.reduce((sum, c) => sum + c.breathRate, 0);
        const totalTiTeRatio = data.reduce((sum, c) => sum + parseFloat(c.tiTeRatio), 0); // Parse float as it's stringified
        return {
            avgBreathRate: totalBreathRate / data.length,
            avgTiTeRatio: totalTiTeRatio / data.length
        };
    }
}

/**
 * Generates a comprehensive text-based report summary for a measurement session.
 * @param {object} sessionData - Object containing session data (heartRates, rrIntervals, etc.).
 * @param {string} measurementType - Type of measurement (e.g., 'resting', 'free', 'live_workout').
 * @param {object} bodystandardAnalysis - Results from Bodystandard analysis.
 * @param {object} vo2Analysis - Results from VO2 analysis.
 * @param {object} runtimesVo2Analysis - Results from RuntimesVo2 analysis.
 * @returns {string} The formatted report content.
 */
export function generateMeasurementReport(sessionData, measurementType, bodystandardAnalysis, vo2Analysis, runtimesVo2Analysis) {
    let reportContent = `
--- MEASUREMENT REPORT ---
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

/**
 * Helper function to determine HR Zone based on current HR, AT, and RMSSD.
 * This version is more comprehensive than the one in app.js.
 * @param {number} currentHR - Current Heart Rate.
 * @param {number} at - Anaerobic Threshold Heart Rate.
 * @param {number} rmssd - RMSSD value for rest zone determination.
 * @returns {string} The determined HR Zone.
 */
export function getHrZone(currentHR, at, rmssd) {
    // Helper for HRV-based rest zone
    const getHrvBasedRestZone = (rmssdVal) => {
        if (rmssdVal >= 70) return 'Relaxed';
        if (rmssdVal >= 50) return 'Rest';
        if (rmssdVal >= 30) return 'Active Low';
        if (rmssdVal >= 10) return 'Active High';
        return 'Transition to sportzones'; // Default for very low RMSSD
    };

    const warmupHrThreshold = at * 0.65; // Example threshold for warmup start

    if (currentHR >= at * 1.06) return 'Intensive 2';
    if (currentHR >= at * 1.01) return 'Intensive 1';
    if (currentHR >= at) return 'AT'; // Anaerobic Threshold
    if (currentHR >= at * 0.90) return 'Endurance 3';
    if (currentHR >= at * 0.80) return 'Endurance 2';
    if (currentHR >= at * 0.70) return 'Endurance 1';
    if (currentHR >= warmupHrThreshold + 5) return 'Cooldown'; // Slightly above warmup for cooldown
    if (currentHR >= warmupHrThreshold) return 'Warmup';
    
    // If HR is below warmup threshold, use HRV for more nuanced "resting" zones
    return getHrvBasedRestZone(rmssd);
}

/**
 * Simulates breathing signal from RR intervals.
 * This is a highly simplified simulation.
 * @param {number[]} rrIntervals - Array of RR intervals.
 * @returns {number[]} Simulated breathing amplitude values.
 */
export function simulateBreathingFromRr(rrIntervals) {
    if (!rrIntervals || rrIntervals.length === 0) return [];
    const breathingWave = [];
    for (const rr of rrIntervals) {
        const hr = 60000 / rr; // Convert RR to instantaneous HR
        // Simple heuristic: higher HR might correlate with higher breathing amplitude (very rough)
        let amplitude = hr * 4 - 200; // Adjust multiplier/offset as needed
        amplitude = Math.min(Math.max(amplitude, 20), 120); // Clamp values
        breathingWave.push(amplitude);
    }
    return smooth(breathingWave, 5); // Smooth the signal
}

/**
 * Smoothes data using a simple moving average.
 * @param {number[]} data - Array of numerical data.
 * @param {number} windowSize - The size of the moving average window.
 * @returns {number[]} Smoothed data array.
 */
export function smooth(data, windowSize = 5) {
    const smoothed = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = data.slice(start, i + 1);
        const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
        smoothed.push(avg);
    }
    return smoothed;
}

/**
 * Determines the color class for breathing rate display based on BPM.
 * @param {number} bpm - Breathing rate in BPM.
 * @returns {string} Tailwind CSS color class.
 */
export function getBreathRateColorClass(bpm) {
    if (bpm >= 8 && bpm <= 12) {
        return 'text-green-400'; // Optimal
    } else if ((bpm >= 6 && bpm < 8) || (bpm > 12 && bpm <= 15)) {
        return 'text-orange-400'; // Moderate deviation
    } else if (bpm > 15 || bpm < 6) {
        return 'text-red-400'; // Significant deviation
    }
    return ''; // Default
}

/**
 * Calculates RPE (Rate of Perceived Exertion) based on current HR and Max HR.
 * This is a simplified calculation.
 * @param {number} currentHR - Current Heart Rate.
 * @param {number} maxHR - Maximum Heart Rate.
 * @returns {string} RPE score formatted to one decimal place, or '--'.
 */
export function calculateRpe(currentHR, maxHR) {
    if (!currentHR || !maxHR || maxHR <= 0) return '--';
    const rpe = (currentHR / maxHR) * 10; // Scale to 1-10
    return rpe.toFixed(1);
}
