// Bestand: js/restMeasurementLiveView_2.js
// Dit bestand is een gecorrigeerde en geconsolideerde versie die de functionaliteit van concept.txt
// overneemt om een tweede, meer geavanceerde meetoptie te bieden.

// Removed direct import of BluetoothController, will be passed or accessed globally
import { putData, getData, getOrCreateUserId } from '../database.js';
import { showNotification } from './notifications.js';
// Import Bodystandard, VO2, RuntimesVo2, HRVAnalyzer, BreathManager, generateMeasurementReport, getHrZone, simulateBreathingFromRr, smooth, getBreathRateColorClass, calculateRpe
// from the new consolidated measurement_utils.js
import { Bodystandard, VO2, RuntimesVo2 } from './body_metrics_utils.js';
import { HRVAnalyzer, BreathManager, generateMeasurementReport, getHrZone, simulateBreathingFromRr, smooth, getBreathRateColorClass, calculateRpe } from './measurement_utils.js';

// Globale variabelen voor de grafieken en data
let hrChart, rrHistogramChart, poincarePlotChart, powerSpectrumChart; // rrChart is removed from HTML
let hrData = [];
let rrData = []; // Filtered RR intervals
let rawRrData = []; // Unfiltered/raw RR intervals for background plot
let selectedMeasurementType = 'resting';
let hrvAnalyzer;
let breathManager;
let hrZoneInterval; // Interval for updating HR zone times

export async function initRestMeasurementLiveView_2(showViewCallback, bluetoothController) {
    console.log("Geavanceerde Rustmeting View geïnitialiseerd.");
    const currentAppUserId = getOrCreateUserId();

    // DOM elementen lokaal ophalen, aangezien de HTML dynamisch geladen wordt
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
    const rrHistogramChartCtx = document.getElementById('rrHistogramChart')?.getContext('2d');
    const poincarePlotChartCtx = document.getElementById('poincarePlotChart')?.getContext('2d');
    const powerSpectrumChartCtx = document.getElementById('powerSpectrumChart')?.getContext('2d');

    // UI-elementen voor de samenvattingswidgets
    const summaryAvgHr = document.getElementById('summaryAvgHr');
    const summaryMaxHr = document.getElementById('summaryMaxHr');
    const summaryMinHr = document.getElementById('summaryMinHr');
    const hrvRecoveryStatus = document.getElementById('hrvRecoveryStatus'); // This element doesn't exist in HTML, remove or add
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
    
    let currentSessionData = {
        heartRates: [],
        rrIntervals: [], // Filtered RR intervals
        rawRrIntervals: [], // Unfiltered RR intervals
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
    
    function updateSummaryStatistics(dataPacket, hrvAnalyzer, breathManager) {
        // HR Summary
        if (hrData.length > 0) {
            const avgHr = hrData.reduce((sum, hr) => sum + hr, 0) / hrData.length;
            const maxHr = currentSessionData.maxHr;
            const minHr = currentSessionData.minHr;
            const currentHr = dataPacket.heartRate; // Use current HR for RPE/HR_to_X calculations

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
            breathSummaryCard.style.display = 'none'; // Hide breathing card if workout mode
            if (liveBreathRateDisplay) liveBreathRateDisplay.textContent = '-- BPM';
        } else { // Fallback if breathManager is null or not in workout mode
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
    initCharts(); // Initialize charts on view load

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
            
            // Save RR data to sessionStorage before navigating
            if (currentSessionData.rawRrIntervals.length > 0) {
                sessionStorage.setItem('lastMeasurementRrData', JSON.stringify(currentSessionData.rawRrIntervals.map((value, index) => ({
                    value: value,
                    timestamp: currentSessionData.timestamps[index] ? new Date(currentSessionData.timestamps[index]).getTime() : (new Date().getTime() - (currentSessionData.rawRrIntervals.length - 1 - index) * 1000), // Use actual timestamp or estimate
                    originalIndex: index
                }))));
            } else {
                sessionStorage.removeItem('lastMeasurementRrData');
            }

            // Navigate to reports page after measurement stops
            if (showViewCallback) {
                showViewCallback('reportsView');
            }
        }
    };

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
                rawRrData.push(rr); // Store raw RR data
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
            scaledRr = dataPacket.filteredRrIntervals.map(rr => rr / 10); // Scale for display on HR chart
            rrLabels = dataPacket.filteredRrIntervals.map(() => new Date().toLocaleTimeString());

            // Update hrChart with raw RR data (if it exists)
            if (hrChart && hrChart.data.datasets[3]) { // Assuming index 3 for raw RR
                hrChart.data.datasets[3].data.push(rawRrData[rawRrData.length - 1] / 10 || null); // Scale raw RR for this chart
            }
            
            if (hrvAnalyzer && hrvAnalyzer.n >= 30) { // Only update HRV charts if enough data
                if (rrHistogramChart) {
                    rrHistogramChart.data.labels = hrvAnalyzer.rrHistogram.labels;
                    rrHistogramChart.data.datasets[0].data = hrvAnalyzer.rrHistogram.counts;
                    rrHistogramChart.update();
                }
                if (poincarePlotChart) {
                    // Use rawRrData for scatter plot if available, otherwise filtered
                    const poincareData = rawRrData.slice(0, -1).map((val, i) => ({ x: val, y: rawRrData[i + 1] }));
                    const poincareDataFiltered = rrData.slice(0, -1).map((val, i) => ({ x: val, y: rrData[i + 1] }));

                    poincarePlotChart.data.datasets[0].data = poincareData; // Raw
                    poincarePlotChart.data.datasets[1].data = poincareDataFiltered; // Filtered
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
            hrChart.data.datasets[1].data.push(scaledRr[0] || null); // Add first scaled RR if available
            hrChart.data.datasets[2].data.push(breathSignal[0] || null); // Add first breath signal if available

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
            // Reset all data and charts
            hrData = [];
            rrData = [];
            rawRrData = [];
            currentSessionData = {
                heartRates: [], rrIntervals: [], rawRrIntervals: [], timestamps: [], caloriesBurned: 0,
                totalDuration: 0, rmssd: 0, sdnn: 0, avgHr: 0, maxHr: 0, minHr: 0, avgBreathRate: 0, hrZonesTime: {
                    'Resting': 0, 'Warmup': 0, 'Endurance 1': 0, 'Endurance 2': 0, 'Endurance 3': 0,
                    'Intensive 1': 0, 'Intensive 2': 0, 'Cooldown': 0,
                    'Relaxed': 0, 'Rest': 0, 'Active Low': 0, 'Active High': 0, 'Transition to sportzones': 0,
                    'AT': 0
                },
                vlfPower: 0, lfPower: 0, hfPower: 0, pnn50: 0,
            };
            hrvAnalyzer = null; // Reset analyzer
            if (breathManager) breathManager.reset(); // Reset manager, ensure it exists first

            userProfile = await getData('userProfile', currentAppUserId); // Re-fetch latest user profile
            userBaseAtHR = userProfile ? parseFloat(userProfile.userBaseAtHR) : 0;
            userRestHR = userProfile ? parseFloat(userProfile.userRestHR) : 0;
            userMaxHR = userProfile ? parseFloat(userProfile.userMaxHR) : 0;

            initCharts(); // Re-initialize charts to clear them
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
                
                // Generate PDF
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                let yPos = 10;

                // Capture charts for PDF
                const chartsToCapture = [
                    { id: 'hrChart', chart: hrChart },
                    { id: 'rrHistogramChart', chart: rrHistogramChart },
                    { id: 'poincarePlotChart', chart: poincarePlotChart },
                    { id: 'powerSpectrumChart', chart: powerSpectrumChart }
                ];

                const capturedImages = {};
                for (const { id, chart, canvas } of chartsToCapture) {
                    const canvasElement = document.getElementById(id); // Get canvas element directly
                    if (canvasElement && chart) {
                        // Temporarily make chart visible for html2canvas if it's hidden
                        const originalDisplay = canvasElement.style.display;
                        canvasElement.style.display = 'block';
                        try {
                            const img = await html2canvas(canvasElement);
                            capturedImages[id] = img.toDataURL('image/png');
                        } catch (error) {
                            console.error(`Error capturing chart ${id}:`, error);
                        } finally {
                            canvasElement.style.display = originalDisplay; // Restore original display
                        }
                    }
                }

                // Generate text report content
                const reportText = generateMeasurementReport(currentSessionData, selectedMeasurementType, bodystandardAnalysis, vo2Analysis, runtimesVo2Analysis);
                doc.text(reportText, 10, yPos);
                yPos += reportText.split('\n').length * 5; // Estimate line height;

                // Add captured images to PDF
                for (const { id } of chartsToCapture) {
                    if (capturedImages[id]) {
                        doc.addImage(capturedImages[id], 'PNG', 10, yPos, 180, 90); // Adjust size as needed
                        yPos += 100;
                    }
                }

                doc.save(`measurement_report_advanced_${new Date().toISOString().split('T')[0]}.pdf`);
                showNotification('Rapport succesvol gedownload!', 'success');

            } else {
                showNotification('Geen metingsdata om rapport te genereren.', 'warning');
            }
            // Save RR data to sessionStorage before navigating
            if (currentSessionData.rawRrIntervals.length > 0) {
                sessionStorage.setItem('lastMeasurementRrData', JSON.stringify(currentSessionData.rawRrIntervals.map((value, index) => ({
                    value: value,
                    timestamp: currentSessionData.timestamps[index] ? new Date(currentSessionData.timestamps[index]).getTime() : (new Date().getTime() - (currentSessionData.rawRrIntervals.length - 1 - index) * 1000), // Use actual timestamp or estimate
                    originalIndex: index
                }))));
            } else {
                sessionStorage.removeItem('lastMeasurementRrData');
            }

            // Navigate to reports page after measurement stops
            if (showViewCallback) {
                showViewCallback('reportsView');
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
                    rawRrData: currentSessionData.rawRrIntervals, // Save raw RR intervals
                    filteredRrData: currentSessionData.rrIntervals, // Save filtered RR intervals
                    timestamps: currentSessionData.timestamps,
                    sdnn: currentSessionData.sdnn,
                    vlfPower: currentSessionData.vlfPower,
                    lfPower: currentSessionData.lfPower,
                    hfPower: currentSessionData.hfPower,
                    pnn50: currentSessionData.pnn50,
                    avgBreathRate: currentSessionData.avgBreathRate // Save average breath rate
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

    // Remove old top-nav from the HTML as it's now handled by the unified view
    const oldTopNav = document.querySelector('.top-nav');
    if (oldTopNav) oldTopNav.remove();
}
