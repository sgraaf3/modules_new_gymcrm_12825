// Bestand: js/liveTrainingView.js
// Bevat logica voor het uitvoeren en opslaan van live trainingsmetingen, inclusief uitgebreide statistieken en grafieken.

import { BluetoothController } from '../bluetooth.js';
import { putData, getData, getOrCreateUserId } from '../database.js';
import { showNotification } from './notifications.js';

// Chart instances
let hrCombinedChart; // Nieuwe naam voor de gecombineerde HR/RR/Breath grafiek
let rrChart; // Dit blijft een aparte RR grafiek (ongeschaald)
let rrHistogramChart;
let poincarePlotChart;
let powerSpectrumChart;

// Data buffers for charts and calculations
let hrDataBuffer = [];
let rrIntervalsBuffer = []; // Stores all filtered RR intervals for analysis
let breathRateBuffer = []; // Buffer for breath rate data
let timestampsBuffer = [];

// Session data for saving
let currentSessionData = {
    userId: '',
    type: 'training', // Default, will be set by selection
    date: '',
    duration: 0, // in seconds
    avgHr: 0,
    maxHr: 0,
    minHr: 0,
    rmssd: 0,
    sdnn: 0,
    pnn50: 0,
    lfHfRatio: 0,
    vlfPower: 0, // Nieuw
    lfPower: 0,  // Nieuw
    hfPower: 0,  // Nieuw
    caloriesBurned: 0,
    hrZonesTime: { // Time spent in each HR zone (in seconds)
        'Resting': 0,
        'Warmup': 0,
        'Endurance 1': 0,
        'Endurance 2': 0,
        'Endurance 3': 0,
        'Intensive 1': 0,
        'Intensive 2': 0,
        'Cooldown': 0,
        // Nieuwe zones voor HRV-gebaseerde rust
        'Relaxed': 0,
        'Rest': 0,
        'Active Low': 0,
        'Active High': 0,
        'Transition Zone': 0,
        'AT': 0 // Add AT zone
    },
    rpe: null, // Rate of Perceived Exertion
    wellnessScores: { recovery: '--', strain: '--', sleep: '--', conditioning: '--' }, // Placeholders
    intensityScore: '--', // Placeholder
    breathData: { lastCycle: '--', avgTotalCycles: '--', currentBf: '--' }, // Placeholders
    rawHrData: [], // Full HR data for session
    rawRrData: [], // Full filtered RR data for session
    rawBreathData: [], // Full breath data for session
    timestamps: [] // Full timestamps for session
};

let measurementStartTime;
let measurementInterval;
let hrZoneInterval; // Interval to update HR zone times

let isBluetoothConnected = false; // New variable to track Bluetooth connection status

// showViewCallback is passed from app.js for navigation
export async function initLiveTrainingView(showViewCallback) {
    console.log("Live Training View geïnitialiseerd.");

    const currentAppUserId = getOrCreateUserId();
    currentSessionData.userId = currentAppUserId;

    const bluetoothController = new BluetoothController();

    // Initialize UI elements and charts
    const uiElements = initUIElements();
    const charts = initCharts(); // Call initCharts here

    // Load user profile for HR zones
    let userProfile = await getData('userProfile', currentAppUserId);
    let userBaseAtHR = userProfile ? parseFloat(userProfile.userBaseAtHR) : 0;
    let userRestHR = userProfile ? parseFloat(userProfile.userRestHR) : 0;
    let userMaxHR = userProfile ? parseFloat(userProfile.userMaxHR) : 0;


    // Setup event listeners
    setupEventListeners(uiElements, bluetoothController, showViewCallback, userProfile);

    // Setup Bluetooth callbacks
    setupBluetoothCallbacks(uiElements, charts, bluetoothController, userBaseAtHR, userRestHR, userMaxHR);

    // Initial state
    uiElements.saveMeasurementBtn.style.display = 'none';
}

function initUIElements() {
    return {
        measurementTypeSelect: document.getElementById('measurementTypeSelect'),
        liveHrDisplay: document.getElementById('liveHrDisplay'),
        liveHrZoneDisplay: document.getElementById('liveHrZoneDisplay'),
        liveAvgRrDisplay: document.getElementById('liveAvgRrDisplay'),
        liveRmssdDisplay: document.getElementById('liveRmssdDisplay'),
        liveBreathRateDisplay: document.getElementById('liveBreathRateDisplay'),
        liveTimerDisplay: document.getElementById('liveTimerDisplay'),
        startMeasurementBtnLive: document.getElementById('startMeasurementBtnLive'),
        stopMeasurementBtnLive: document.getElementById('stopMeasurementBtnLive'),
        saveMeasurementBtn: document.getElementById('saveMeasurementBtn'),
        inputRpe: document.getElementById('inputRpe'),
        summaryAvgHr: document.getElementById('summaryAvgHr'),
        summaryMaxHr: document.getElementById('summaryMaxHr'),
        summaryMinHr: document.getElementById('summaryMinHr'),
        summaryCurrentHr: document.getElementById('summaryCurrentHr'),
        hrvRecoveryStatus: document.getElementById('hrvRecoveryStatus'),
        summaryRmssd: document.getElementById('summaryRmssd'),
        summarySdnn: document.getElementById('summarySdnn'),
        summaryPnn50: document.getElementById('summaryPnn50'),
        summaryLfHf: document.getElementById('summaryLfHf'),
        scoreRecovery: document.getElementById('scoreRecovery'),
        scoreStrain: document.getElementById('scoreStrain'),
        scoreSleep: document.getElementById('scoreSleep'),
        scoreConditioning: document.getElementById('scoreConditioning'),
        scoreIntensity: document.getElementById('scoreIntensity'),
        hrToAt: document.getElementById('hrToAt'),
        hrToRestHr: document.getElementById('hrToRestHr'),
        breathLastCycle: document.getElementById('breathLastCycle'),
        breathAvgTotalCycles: document.getElementById('breathAvgTotalCycles'),
        breathCurrentBf: document.getElementById('breathCurrentBf'),
        // HR Zone Time Displays
        zoneTimeResting: document.getElementById('zoneTimeResting'),
        zoneTimeWarmup: document.getElementById('zoneTimeWarmup'),
        zoneTimeEndurance1: document.getElementById('zoneTimeEndurance1'),
        zoneTimeEndurance2: document.getElementById('zoneTimeEndurance2'),
        zoneTimeEndurance3: document.getElementById('zoneTimeEndurance3'),
        zoneTimeIntensive1: document.getElementById('zoneTimeIntensive1'),
        zoneTimeIntensive2: document.getElementById('zoneTimeIntensive2'),
        zoneTimeCooldown: document.getElementById('zoneTimeCooldown'),
        zoneTimeRelaxed: document.getElementById('zoneTimeRelaxed'),
        zoneTimeRest: document.getElementById('zoneTimeRest'),
        zoneTimeActiveLow: document.getElementById('zoneTimeActiveLow'),
        zoneTimeActiveHigh: document.getElementById('zoneTimeActiveHigh'),
        zoneTimeTransitionZone: document.getElementById('zoneTimeTransitionZone'),
        zoneTimeAT: document.getElementById('zoneTimeAT'), // Added AT zone display
        bluetoothFabBtn: document.getElementById('bluetoothFabBtn'),
        bluetoothStatusDisplay: document.getElementById('bluetoothStatusDisplay'),
        bluetoothErrorTooltip: document.getElementById('bluetoothErrorTooltip')
    };
}

function initCharts() {
    const charts = {};
    const hrCombinedChartCtx = document.getElementById('hrChart')?.getContext('2d');
    if (hrCombinedChartCtx) {
        if (hrCombinedChart) hrCombinedChart.destroy();
        hrCombinedChart = new Chart(hrCombinedChartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Hartslag (BPM)',
                        data: [],
                        borderColor: '#f87171', // Rood
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y-hr-breath' // Linker Y-as
                    },
                    {
                        label: 'RR Interval (ms / 100)', // Geschaald label
                        data: [],
                        borderColor: '#a78bfa', // Paars
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y-rr' // Rechter Y-as
                    },
                    {
                        label: 'Ademhaling (BPM)',
                        data: [],
                        borderColor: '#4ade80', // Groen
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y-hr-breath' // Linker Y-as
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    'y-hr-breath': { // Linker Y-as voor HR en Ademhaling
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        min: 0,
                        max: 200, // Max voor HR/Ademhaling
                        title: { display: true, text: 'HR / Ademhaling (BPM)' }
                    },
                    'y-rr': { // Rechter Y-as voor geschaalde RR
                        type: 'linear',
                        position: 'right',
                        beginAtZero: false, // RR hoeft niet bij 0 te beginnen
                        min: 4, // 400ms / 100
                        max: 12, // 1200ms / 100
                        title: { display: true, text: 'RR (ms / 100)' },
                        grid: {
                            drawOnChartArea: false // Teken geen gridlijnen voor deze as om overlap te voorkomen
                        }
                    },
                    x: { display: false }
                },
                animation: false,
                plugins: { legend: { display: true } }
            }
        });
        charts.hrCombinedChart = hrCombinedChart;
    }

    const rrChartCtx = document.getElementById('rrChart')?.getContext('2d');
    if (rrChartCtx) {
        if (rrChart) rrChart.destroy();
        rrChart = new Chart(rrChartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'RR Interval (ms)',
                    data: [],
                    borderColor: '#a78bfa', // Paars
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        min: 400, // Vaste schaal voor RR
                        max: 1200, // Vaste schaal voor RR
                        title: { display: true, text: 'RR Interval (ms)' }
                    },
                    x: { display: false }
                },
                animation: false,
                plugins: { legend: { display: true } }
            }
        });
        charts.rrChart = rrChart;
    }

    const rrHistogramChartCtx = document.getElementById('rrHistogramChart')?.getContext('2d');
    if (rrHistogramChartCtx) {
        if (rrHistogramChart) rrHistogramChart.destroy();
        rrHistogramChart = new Chart(rrHistogramChartCtx, {
            type: 'bar',
            data: {
                labels: [], // RR interval ranges
                datasets: [{
                    label: 'Frequentie',
                    data: [],
                    backgroundColor: '#4ade80', // Green
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'RR Interval (ms)' }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Aantal' },
                        min: 0,
                        max: 50
                    }
                },
                plugins: { legend: { display: true } }
            }
        });
        charts.rrHistogramChart = rrHistogramChart;
    }

    const poincarePlotChartCtx = document.getElementById('poincarePlotChart')?.getContext('2d');
    if (poincarePlotChartCtx) {
        if (poincarePlotChart) poincarePlotChart.destroy();
        poincarePlotChart = new Chart(poincarePlotChartCtx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Poincaré Plot',
                    data: [], // { x: RR(n), y: RR(n+1) }
                    backgroundColor: '#facc15', // Yellow
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'RR(n) (ms)' },
                        min: 400,
                        max: 1200
                    },
                    y: {
                        title: { display: true, text: 'RR(n+1) (ms)' },
                        min: 400,
                        max: 1200
                    }
                },
                plugins: { legend: { display: true } }
            }
        });
        charts.poincarePlotChart = poincarePlotChart;
    }

    const powerSpectrumChartCtx = document.getElementById('powerSpectrumChart')?.getContext('2d');
    if (powerSpectrumChartCtx) {
        if (powerSpectrumChart) powerSpectrumChart.destroy();
        powerSpectrumChart = new Chart(powerSpectrumChartCtx, {
            type: 'bar',
            data: {
                labels: ['VLF (Very Low Freq)', 'LF (Low Freq)', 'HF (High Freq)'], // Drie frequentiebanden
                datasets: [{
                    label: 'Relatieve Kracht',
                    data: [0, 0, 0], // Placeholder data voor VLF, LF, HF
                    backgroundColor: ['#c084fc', '#22d3ee', '#f97316'] // Kleuren voor VLF, LF, HF
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Frequentieband' }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Relatieve Kracht' },
                        min: 0,
                        max: 100 // Vaste max voor relatieve kracht
                    }
                },
                plugins: { legend: { display: true } }
            }
        });
        charts.powerSpectrumChart = powerSpectrumChart;
    }
    return charts;
}

function setupEventListeners(uiElements, bluetoothController, showViewCallback, userProfile) {
    // Set initial measurement type
    if (uiElements.measurementTypeSelect) {
        currentSessionData.type = uiElements.measurementTypeSelect.value;
        uiElements.measurementTypeSelect.addEventListener('change', (event) => {
            currentSessionData.type = event.target.value;
            showNotification(`Metingstype ingesteld op: ${event.target.options[event.target.selectedIndex].text}`, 'info', 2000);
        });
    }

    // Floating Bluetooth Button
    if (uiElements.bluetoothFabBtn) {
        uiElements.bluetoothFabBtn.addEventListener('click', async () => {
            if (!isBluetoothConnected) {
                showNotification('Verbinden met Bluetooth-apparaat...', 'info');
                bluetoothController.setPreset(currentSessionData.type); // Use the selected measurement type
                bluetoothController.connect();
            } else {
                showNotification('Bluetooth is al verbonden.', 'info');
            }
        });
    }

    if (uiElements.startMeasurementBtnLive) {
        // Initial button text
        uiElements.startMeasurementBtnLive.textContent = isBluetoothConnected ? 'Start Meting' : 'Verbind Bluetooth om te starten';

        uiElements.startMeasurementBtnLive.addEventListener('click', async () => {
            if (!isBluetoothConnected) {
                showNotification('Verbind eerst met een Bluetooth-apparaat via de Bluetooth knop.', 'warning');
                if (uiElements.bluetoothErrorTooltip) {
                    uiElements.bluetoothErrorTooltip.classList.remove('hidden');
                    setTimeout(() => {
                        uiElements.bluetoothErrorTooltip.classList.add('hidden');
                    }, 3000);
                }
                return; // Stop execution if not connected
            }

            // Reset all data buffers and session data
            hrDataBuffer = [];
            rrIntervalsBuffer = [];
            breathRateBuffer = [];
            timestampsBuffer = [];
            currentSessionData = {
                userId: currentSessionData.userId, // Keep existing user ID
                type: uiElements.measurementTypeSelect.value, // Get selected type
                date: '',
                duration: 0,
                avgHr: 0,
                maxHr: 0,
                minHr: 0,
                rmssd: 0,
                sdnn: 0,
                pnn50: 0,
                lfHfRatio: 0,
                vlfPower: 0,
                lfPower: 0,
                hfPower: 0,
                caloriesBurned: 0,
                hrZonesTime: {
                    'Resting': 0, 'Warmup': 0, 'Endurance 1': 0, 'Endurance 2': 0, 'Endurance 3': 0,
                    'Intensive 1': 0, 'Intensive 2': 0, 'Cooldown': 0,
                    'Relaxed': 0, 'Rest': 0, 'Active Low': 0, 'Active High': 0, 'Transition Zone': 0, 'AT': 0
                },
                rpe: null,
                wellnessScores: { recovery: '--', strain: '--', sleep: '--', conditioning: '--' },
                intensityScore: '--',
                breathData: { lastCycle: '--', avgTotalCycles: '--', currentBf: '--' },
                rawHrData: [],
                rawRrData: [],
                rawBreathData: [],
                timestamps: []
            };

            // Reset UI elements
            if (uiElements.liveTimerDisplay) uiElements.liveTimerDisplay.textContent = '00:00';
            if (uiElements.saveMeasurementBtn) uiElements.saveMeasurementBtn.style.display = 'none';
            if (uiElements.inputRpe) uiElements.inputRpe.value = ''; // Clear RPE input
            updateSummaryStatistics(uiElements, userProfile); // Clear summary displays

            // Reset charts
            if (hrCombinedChart) { hrCombinedChart.data.labels = []; hrCombinedChart.data.datasets[0].data = []; hrCombinedChart.data.datasets[1].data = []; hrCombinedChart.data.datasets[2].data = []; hrCombinedChart.update(); }
            if (rrChart) { rrChart.data.labels = []; rrChart.data.datasets[0].data = []; rrChart.update(); }
            if (rrHistogramChart) { rrHistogramChart.data.labels = []; rrHistogramChart.data.datasets[0].data = []; rrHistogramChart.update(); }
            if (poincarePlotChart) { poincarePlotChart.data.datasets[0].data = []; poincarePlotChart.update(); }
            if (powerSpectrumChart) { powerSpectrumChart.data.datasets[0].data = [0,0,0]; powerSpectrumChart.update(); }

            // Start measurement (assuming Bluetooth is already connected)
            // The actual streaming starts when BluetoothController.onData is called
            uiElements.startMeasurementBtnLive.style.display = 'none';
            uiElements.stopMeasurementBtnLive.style.display = 'block';
            measurementStartTime = Date.now();
            measurementInterval = setInterval(updateTimer, 1000);
            hrZoneInterval = setInterval(() => updateHrZoneTimes(uiElements, userProfile.userBaseAtHR, userProfile.userRestHR), 1000);
            if (uiElements.measurementTypeSelect) uiElements.measurementTypeSelect.disabled = true;
            showNotification('Meting gestart!', 'success');
        });
    }

    if (uiElements.stopMeasurementBtnLive) {
        uiElements.stopMeasurementBtnLive.addEventListener('click', async () => {
            bluetoothController.disconnect();
            // Finalize calculations after stopping
            if (hrDataBuffer.length > 0) {
                currentSessionData.avgHr = hrDataBuffer.reduce((sum, hr) => sum + hr, 0) / hrDataBuffer.length;
                currentSessionData.maxHr = Math.max(...hrDataBuffer);
                currentSessionData.minHr = Math.min(...hrDataBuffer);
                // Calorie calculation based on average HR, duration, and assumed weight/gender from userProfile
                if (userProfile && userProfile.userWeight && userProfile.userGender) {
                    const weight = parseFloat(userProfile.userWeight);
                    const genderFactor = userProfile.userGender === 'male' ? 0.2017 : 0.1492; // Example factors
                    const ageFactor = userProfile.userAge ? (0.074 * parseFloat(userProfile.userAge)) : 0; // Example factor
                    const durationInMinutes = currentSessionData.duration / 60;
                    currentSessionData.caloriesBurned = ((currentSessionData.avgHr * genderFactor + ageFactor) * durationInMinutes).toFixed(0);
                } else {
                    currentSessionData.caloriesBurned = (currentSessionData.avgHr * currentSessionData.duration / 60 / 10).toFixed(0); // Fallback example
                }
            }
            // Populate raw data for saving
            currentSessionData.rawHrData = [...hrDataBuffer];
            currentSessionData.rawRrData = [...rrIntervalsBuffer];
            currentSessionData.rawBreathData = [...breathRateBuffer]; // Opslaan van ademhalingsdata
            currentSessionData.timestamps = [...timestampsBuffer];

            updateSummaryStatistics(uiElements, userProfile); // Final update of summaries
            updateHrvCharts(); // Final update of HRV charts
            updatePowerSpectrumChart(); // Final update of power spectrum
        });
    }

    if (uiElements.saveMeasurementBtn) {
        uiElements.saveMeasurementBtn.addEventListener('click', async () => {
            if (currentSessionData.duration > 0 && hrDataBuffer.length > 0) {
                // Capture RPE
                currentSessionData.rpe = uiElements.inputRpe && uiElements.inputRpe.value ? parseInt(uiElements.inputRpe.value) : null;

                // Set date
                currentSessionData.date = new Date().toISOString().split('T')[0];

                let storeToSave = '';
                if (currentSessionData.type === 'resting') {
                    storeToSave = 'restSessionsAdvanced'; // Assuming advanced for resting
                } else if (currentSessionData.type === 'free') {
                    storeToSave = 'restSessionsFree';
                } else if (currentSessionData.type === 'live_workout') { // Correctly handle live_workout
                    storeToSave = 'trainingSessions';
                }

                try {
                    await putData(storeToSave, currentSessionData);
                    showNotification('Meting succesvol opgeslagen!', 'success');
                    if (showViewCallback) {
                        if (storeToSave === 'trainingSessions') {
                            showViewCallback('trainingReportsView');
                        } else if (storeToSave === 'restSessionsAdvanced' || storeToSave === 'restSessionsFree') {
                            showViewCallback('restReportsView');
                        }
                    }
                } catch (error) {
                    console.error("Fout bij opslaan meting:", error);
                    showNotification('Fout bij opslaan meting.', 'error');
                }
            } else {
                showNotification('Geen metingsdata om op te slagen. Start en stop een meting.', 'warning');
            }
        });
    }
}

function setupBluetoothCallbacks(uiElements, charts, bluetoothController, userBaseAtHR, userRestHR, userMaxHR) {
    bluetoothController.onStateChange = (state, deviceName) => {
        if (uiElements.bluetoothStatusDisplay) {
            uiElements.bluetoothStatusDisplay.textContent = `Bluetooth: ${state === 'STREAMING' ? 'Connected' : 'Disconnected'}`; // Update status display
        }

        if (state === 'STREAMING') {
            isBluetoothConnected = true;
            if (uiElements.startMeasurementBtnLive) {
                uiElements.startMeasurementBtnLive.textContent = 'Start Meting';
                uiElements.startMeasurementBtnLive.style.display = 'block'; // Ensure it's visible when connected
            }
            if (uiElements.stopMeasurementBtnLive) uiElements.stopMeasurementBtnLive.style.display = 'none'; // Hide stop button until measurement starts
            measurementStartTime = Date.now();
            measurementInterval = setInterval(updateTimer, 1000);
            hrZoneInterval = setInterval(() => updateHrZoneTimes(uiElements, userBaseAtHR, userRestHR), 1000); // Pass uiElements and user data
            showNotification(`Bluetooth verbonden met ${deviceName || 'apparaat'}!`, 'success');
            if (uiElements.measurementTypeSelect) uiElements.measurementTypeSelect.disabled = true;
        } else if (state === 'ERROR') {
            isBluetoothConnected = false;
            showNotification('Bluetooth verbinding mislukt of geannuleerd.', 'error');
            clearInterval(measurementInterval);
            clearInterval(hrZoneInterval);
            if (uiElements.startMeasurementBtnLive) {
                uiElements.startMeasurementBtnLive.textContent = 'Verbind Bluetooth om te starten';
                uiElements.startMeasurementBtnLive.style.display = 'block';
            }
            if (uiElements.stopMeasurementBtnLive) uiElements.stopMeasurementBtnLive.style.display = 'none';
            if (uiElements.measurementTypeSelect) uiElements.measurementTypeSelect.disabled = false;
        } else if (state === 'STOPPED') {
            isBluetoothConnected = false;
            showNotification('Bluetooth meting gestopt.', 'info');
            clearInterval(measurementInterval);
            clearInterval(hrZoneInterval);
            if (uiElements.startMeasurementBtnLive) {
                uiElements.startMeasurementBtnLive.textContent = 'Verbind Bluetooth om te starten';
                uiElements.startMeasurementBtnLive.style.display = 'block';
            }
            if (uiElements.stopMeasurementBtnLive) uiElements.stopMeasurementBtnLive.style.display = 'none';
            if (uiElements.saveMeasurementBtn) uiElements.saveMeasurementBtn.style.display = 'block';
            if (uiElements.measurementTypeSelect) uiElements.measurementTypeSelect.disabled = false;
            updateSummaryStatistics(uiElements, { userBaseAtHR, userRestHR, userMaxHR }); // Pass user data for calculations
            updateHrvCharts();
            updatePowerSpectrumChart(); // Update power spectrum on stop
        }
    };

    bluetoothController.onData = async (dataPacket) => {
        const now = new Date().toLocaleTimeString();

        // Update HR data and charts
        if (dataPacket.heartRate) {
            if (uiElements.liveHrDisplay) uiElements.liveHrDisplay.textContent = `${dataPacket.heartRate} BPM`;
            hrDataBuffer.push(dataPacket.heartRate);
            timestampsBuffer.push(now);

            // Update HR zone display (live)
            if (userBaseAtHR > 0 && uiElements.liveHrZoneDisplay) {
                const currentHr = dataPacket.heartRate;
                if (currentHr < (userBaseAtHR * 0.65)) {
                    // Use RMSSD-based zone if HR is below 65% of AT
                    uiElements.liveHrZoneDisplay.textContent = getHrvBasedRestZone(currentSessionData.rmssd);
                } else {
                    // Use AT-based zone otherwise
                    uiElements.liveHrZoneDisplay.textContent = getHrZone(currentHr, userBaseAtHR);
                }
            } else if (uiElements.liveHrZoneDisplay) {
                uiElements.liveHrZoneDisplay.textContent = '-- Zone';
            }
        }

        // Simulate breath rate if not from sensor (or use actual if available)
        const simulatedBreathRate = parseFloat((Math.random() * 10 + 12).toFixed(1));
        if (uiElements.liveBreathRateDisplay) uiElements.liveBreathRateDisplay.textContent = `${simulatedBreathRate} BPM`;
        breathRateBuffer.push(simulatedBreathRate);


        // Update RR data and HRV charts
        if (dataPacket.filteredRrIntervals && dataPacket.filteredRrIntervals.length > 0) {
            const avgRr = dataPacket.filteredRrIntervals.reduce((sum, val) => sum + val, 0) / dataPacket.filteredRrIntervals.length;
            if (uiElements.liveAvgRrDisplay) uiElements.liveAvgRrDisplay.textContent = `${avgRr.toFixed(0)} MS`;

            dataPacket.filteredRrIntervals.forEach(rr => {
                rrIntervalsBuffer.push(rr);
            });

            // Calculate and update RMSSD live
            if (rrIntervalsBuffer.length >= 2) {
                const hrvMetrics = calculateHrvMetrics(rrIntervalsBuffer);
                currentSessionData.rmssd = hrvMetrics.rmssd;
                currentSessionData.sdnn = hrvMetrics.sdnn;
                currentSessionData.pnn50 = hrvMetrics.pnn50;
                if (uiElements.liveRmssdDisplay) uiElements.liveRmssdDisplay.textContent = `RMSSD: ${currentSessionData.rmssd.toFixed(2)} MS`;
            } else {
                if (uiElements.liveRmssdDisplay) uiElements.liveRmssdDisplay.textContent = `RMSSD: -- MS`;
                currentSessionData.rmssd = 0;
            }

            // Update HRV charts (Histogram, Poincaré) live
            updateHrvCharts();
        }

        // Update Combined HR/RR/Breath chart
        if (hrCombinedChart) {
            hrCombinedChart.data.labels.push(now);
            hrCombinedChart.data.datasets[0].data.push(dataPacket.heartRate); // HR
            hrCombinedChart.data.datasets[1].data.push(dataPacket.filteredRrIntervals[0] ? dataPacket.filteredRrIntervals[0] / 100 : null); // Geschaalde RR
            hrCombinedChart.data.datasets[2].data.push(simulatedBreathRate); // Ademhaling
            const maxDataPoints = 100;
            if (hrCombinedChart.data.labels.length > maxDataPoints) {
                hrCombinedChart.data.labels.shift();
                hrCombinedChart.data.datasets[0].data.shift();
                hrCombinedChart.data.datasets[1].data.shift();
                hrCombinedChart.data.datasets[2].data.shift();
            }
            hrCombinedChart.update();
        }

        // Update separate RR chart (ongeschaald)
        if (rrChart && dataPacket.filteredRrIntervals && dataPacket.filteredRrIntervals.length > 0) {
            dataPacket.filteredRrIntervals.forEach(rr => {
                rrChart.data.labels.push(new Date().toLocaleTimeString());
                rrChart.data.datasets[0].data.push(rr);
            });
            const maxDataPoints = 100;
            if (rrChart.data.labels.length > maxDataPoints) {
                rrChart.data.labels = rrChart.data.labels.slice(-maxDataPoints);
                rrChart.data.datasets[0].data = rrChart.data.datasets[0].data.slice(-maxDataPoints);
            }
            rrChart.update();
        }

        // Update summary statistics live
        updateSummaryStatistics(uiElements, { userBaseAtHR, userRestHR, userMaxHR });
    };
}

// Formats seconds into MM:SS
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// Updates time spent in each HR zone
function updateHrZoneTimes(uiElements, userBaseAtHR, userRestHR) {
    if (hrDataBuffer.length > 0) {
        const currentHr = hrDataBuffer[hrDataBuffer.length - 1];
        let zone;

        // Logica: Als HR onder 65% van AT valt, gebruik RMSSD-gebaseerde zones
        if (userBaseAtHR > 0 && currentHr < (userBaseAtHR * 0.65)) {
            zone = getHrvBasedRestZone(currentSessionData.rmssd); // Gebruik de berekende RMSSD
        } else if (userBaseAtHR > 0) {
            zone = getHrZone(currentHr, userBaseAtHR); // Gebruik bestaande AT-gebaseerde zones
        } else {
            zone = 'Resting'; // Fallback als AT niet beschikbaar is
        }

        // Update de teller voor de huidige zone
        if (currentSessionData.hrZonesTime[zone] !== undefined) {
            currentSessionData.hrZonesTime[zone]++; // Increment by 1 second
        }

        // Update UI met null checks voor alle zones
        if (uiElements.zoneTimeResting) uiElements.zoneTimeResting.textContent = formatTime(currentSessionData.hrZonesTime['Resting']);
        if (uiElements.zoneTimeWarmup) uiElements.zoneTimeWarmup.textContent = formatTime(currentSessionData.hrZonesTime['Warmup']);
        if (uiElements.zoneTimeEndurance1) uiElements.zoneTimeEndurance1.textContent = formatTime(currentSessionData.hrZonesTime['Endurance 1']);
        if (uiElements.zoneTimeEndurance2) uiElements.zoneTimeEndurance2.textContent = formatTime(currentSessionData.hrZonesTime['Endurance 2']);
        if (uiElements.zoneTimeEndurance3) uiElements.zoneTimeEndurance3.textContent = formatTime(currentSessionData.hrZonesTime['Endurance 3']);
        if (uiElements.zoneTimeIntensive1) uiElements.zoneTimeIntensive1.textContent = formatTime(currentSessionData.hrZonesTime['Intensive 1']);
        if (uiElements.zoneTimeIntensive2) uiElements.zoneTimeIntensive2.textContent = formatTime(currentSessionData.hrZonesTime['Intensive 2']);
        if (uiElements.zoneTimeCooldown) uiElements.zoneTimeCooldown.textContent = formatTime(currentSessionData.hrZonesTime['Cooldown']);
        if (uiElements.zoneTimeAT) uiElements.zoneTimeAT.textContent = formatTime(currentSessionData.hrZonesTime['AT']);
        // Update UI voor de nieuwe HRV-gebaseerde zones
        if (uiElements.zoneTimeRelaxed) uiElements.zoneTimeRelaxed.textContent = formatTime(currentSessionData.hrZonesTime['Relaxed'] || 0);
        if (uiElements.zoneTimeRest) uiElements.zoneTimeRest.textContent = formatTime(currentSessionData.hrZonesTime['Rest'] || 0);
        if (uiElements.zoneTimeActiveLow) uiElements.zoneTimeActiveLow.textContent = formatTime(currentSessionData.hrZonesTime['Active Low'] || 0);
        if (uiElements.zoneTimeActiveHigh) uiElements.zoneTimeActiveHigh.textContent = formatTime(currentSessionData.hrZonesTime['Active High'] || 0);
        if (uiElements.zoneTimeTransitionZone) uiElements.zoneTimeTransitionZone.textContent = formatTime(currentSessionData.hrZonesTime['Transition Zone'] || 0);
    }
}

// NIEUWE FUNCTIE: Bepaalt de HR-zone op basis van RMSSD
function getHrvBasedRestZone(rmssd) {
    // Specifieke numerieke drempelwaarden voor RMSSD
    const RMSSD_RELAXED_THRESHOLD = 70;
    const RMSSD_REST_THRESHOLD = 50;
    const RMSSD_ACTIVE_LOW_THRESHOLD = 25;
    const RMSSD_ACTIVE_HIGH_THRESHOLD = 10;

    if (rmssd >= RMSSD_RELAXED_THRESHOLD) return 'Relaxed';
    if (rmssd >= RMSSD_REST_THRESHOLD) return 'Rest';
    if (rmssd >= RMSSD_ACTIVE_LOW_THRESHOLD) return 'Active Low';
    if (rmssd >= RMSSD_ACTIVE_HIGH_THRESHOLD) return 'Active High';
    return 'Transition Zone'; // RMSSD < 10
}


// Calculates HRV metrics (SDNN, pNN50)
function calculateHrvMetrics(rrIntervals) {
    if (rrIntervals.length < 2) return { rmssd: 0, sdnn: 0, pnn50: 0 };

    let sumOfDifferencesSquared = 0;
    let nn50Count = 0; // Number of pairs of successive NNs that differ by more than 50 ms
    let previousRr = rrIntervals[0];

    for (let i = 1; i < rrIntervals.length; i++) {
        const currentRr = rrIntervals[i];
        sumOfDifferencesSquared += Math.pow(currentRr - previousRr, 2);
        if (Math.abs(currentRr - previousRr) > 50) {
            nn50Count++;
        }
        previousRr = currentRr;
    }

    const rmssd = Math.sqrt(sumOfDifferencesSquared / (rrIntervals.length - 1));
    const sdnn = Math.sqrt(rrIntervals.reduce((sum, val) => sum + Math.pow(val - (rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length), 2), 0) / (rrIntervals.length - 1));
    const pnn50 = (nn50Count / (rrIntervals.length - 1)) * 100;

    return { rmssd: rmssd, sdnn: sdnn, pnn50: pnn50 };
}

// Determines HRV Recovery Status based on RMSSD
function getHrvRecoveryStatus(rmssd) {
    if (rmssd === 0) return '--';
    // Aangepaste zones voor herstelstatus op basis van RMSSD
    if (rmssd >= 50) return 'Uitstekend Herstel (RMSSD > 50)'; // Relaxed
    if (rmssd >= 25) return 'Goed Herstel (RMSSD 25-50)';    // Rest
    if (rmssd >= 10) return 'Redelijk Herstel (RMSSD 10-25)'; // Light Active
    if (rmssd < 10) return 'Beperkt Herstel (RMSSD < 10)';  // Active
    return '--';
}

// Updates all summary statistics in the UI
function updateSummaryStatistics(uiElements, userProfile) {
    // HR Summary
    if (hrDataBuffer.length > 0) {
        const avgHr = hrDataBuffer.reduce((sum, hr) => sum + hr, 0) / hrDataBuffer.length;
        const maxHr = Math.max(...hrDataBuffer);
        const minHr = Math.min(...hrDataBuffer);
        const currentHr = hrDataBuffer[hrDataBuffer.length - 1];

        if (uiElements.summaryAvgHr) uiElements.summaryAvgHr.textContent = avgHr.toFixed(0);
        if (uiElements.summaryMaxHr) uiElements.summaryMaxHr.textContent = maxHr.toFixed(0);
        if (uiElements.summaryMinHr) uiElements.summaryMinHr.textContent = minHr.toFixed(0);
        if (uiElements.summaryCurrentHr) uiElements.summaryCurrentHr.textContent = currentHr.toFixed(0);

        currentSessionData.avgHr = avgHr;
        currentSessionData.maxHr = maxHr;
        currentSessionData.minHr = minHr;

        // Intensity Scores
        if (userProfile.userBaseAtHR > 0 && uiElements.hrToAt) {
            uiElements.hrToAt.textContent = ((currentHr / userProfile.userBaseAtHR) * 100).toFixed(0);
        } else if (uiElements.hrToAt) {
            uiElements.hrToAt.textContent = '--';
        }
        if (userProfile.userRestHR > 0 && uiElements.hrToRestHr) {
            uiElements.hrToRestHr.textContent = ((currentHr / userProfile.userRestHR) * 100).toFixed(0);
        } else if (uiElements.hrToRestHr) {
            uiElements.hrToRestHr.textContent = '--';
        }
    } else {
        if (uiElements.summaryAvgHr) uiElements.summaryAvgHr.textContent = '--';
        if (uiElements.summaryMaxHr) uiElements.summaryMaxHr.textContent = '--';
        if (uiElements.summaryMinHr) uiElements.summaryMinHr.textContent = '--';
        if (uiElements.summaryCurrentHr) uiElements.summaryCurrentHr.textContent = '--';
        if (uiElements.hrToAt) uiElements.hrToAt.textContent = '--';
        if (uiElements.hrToRestHr) uiElements.hrToRestHr.textContent = '--';
    }

    // HRV Summary
    if (rrIntervalsBuffer.length > 0) {
        const hrvMetrics = calculateHrvMetrics(rrIntervalsBuffer);
        if (uiElements.summaryRmssd) uiElements.summaryRmssd.textContent = hrvMetrics.rmssd.toFixed(2);
        if (uiElements.summarySdnn) uiElements.summarySdnn.textContent = hrvMetrics.sdnn.toFixed(2);
        if (uiElements.summaryPnn50) uiElements.summaryPnn50.textContent = hrvMetrics.pnn50.toFixed(2);
        if (uiElements.hrvRecoveryStatus) uiElements.hrvRecoveryStatus.textContent = getHrvRecoveryStatus(hrvMetrics.rmssd);

        currentSessionData.rmssd = hrvMetrics.rmssd;
        currentSessionData.sdnn = hrvMetrics.sdnn;
        currentSessionData.pnn50 = hrvMetrics.pnn50;

        // Simplified LF/HF Ratio and VLF/LF/HF Power (placeholders/heuristics)
        let vlf = 0;
        let lf = 0;
        let hf = 0;
        let lfHfRatio = 0;

        if (hrvMetrics.rmssd > 0) {
            // Heuristic for power distribution based on RMSSD
            if (hrvMetrics.rmssd > 40) { // High RMSSD, more parasympathetic activity
                vlf = 10; lf = 30; hf = 60;
            } else if (hrvMetrics.rmssd < 20) { // Low RMSSD, more sympathetic activity / stress
                vlf = 20; lf = 60; hf = 20;
            } else { // Balanced
                vlf = 15; lf = 40; hf = 45;
            }
            // Simple ratio (avoid division by zero)
            lfHfRatio = (hf > 0) ? (lf / hf).toFixed(2) : '--';
        }
        if (uiElements.summaryLfHf) uiElements.summaryLfHf.textContent = lfHfRatio;
        currentSessionData.lfHfRatio = lfHfRatio;
        currentSessionData.vlfPower = vlf;
        currentSessionData.lfPower = lf;
        currentSessionData.hfPower = hf;

    } else {
        if (uiElements.summaryRmssd) uiElements.summaryRmssd.textContent = '--';
        if (uiElements.summarySdnn) uiElements.summarySdnn.textContent = '--';
        if (uiElements.summaryPnn50) uiElements.summaryPnn50.textContent = '--';
        if (uiElements.summaryLfHf) uiElements.summaryLfHf.textContent = '--';
        if (uiElements.hrvRecoveryStatus) uiElements.hrvRecoveryStatus.textContent = '--';
        currentSessionData.vlfPower = 0;
        currentSessionData.lfPower = 0;
        currentSessionData.hfPower = 0;
    }

    // Wellness Scores (Placeholders)
    if (uiElements.scoreRecovery) uiElements.scoreRecovery.textContent = '--';
    if (uiElements.scoreStrain) uiElements.scoreStrain.textContent = '--';
    if (uiElements.scoreSleep) uiElements.scoreSleep.textContent = '--';
    if (uiElements.scoreConditioning) uiElements.scoreConditioning.textContent = '--';
    currentSessionData.wellnessScores = { recovery: '--', strain: '--', sleep: '--', conditioning: '--' };

    // Intensity Score (Placeholder)
    if (uiElements.scoreIntensity) uiElements.scoreIntensity.textContent = '--';
    currentSessionData.intensityScore = '--';

    // Breath Data (Placeholders/Basic)
    if (uiElements.breathLastCycle && uiElements.liveBreathRateDisplay) uiElements.breathLastCycle.textContent = uiElements.liveBreathRateDisplay.textContent;
    if (uiElements.breathAvgTotalCycles) uiElements.breathAvgTotalCycles.textContent = '--';
    if (uiElements.breathCurrentBf) uiElements.breathCurrentBf.textContent = '--';
    currentSessionData.breathData = {
        lastCycle: uiElements.liveBreathRateDisplay ? uiElements.liveBreathRateDisplay.textContent : '--',
        avgTotalCycles: '--',
        currentBf: '--'
    };
}


// Function to update HRV specific charts (Histogram, Poincaré)
function updateHrvCharts() {
    if (rrIntervalsBuffer.length < 2) {
        if (rrHistogramChart) { rrHistogramChart.data.datasets[0].data = []; rrHistogramChart.update(); }
        if (poincarePlotChart) { poincarePlotChart.data.datasets[0].data = []; poincarePlotChart.update(); }
        return;
    }

    // Histogram
    if (rrHistogramChart) {
        const bins = {};
        rrIntervalsBuffer.forEach(rr => {
            const bin = Math.floor(rr / 10) * 10; // Bin every 10ms
            bins[bin] = (bins[bin] || 0) + 1;
        });
        const sortedBins = Object.keys(bins).sort((a, b) => parseInt(a) - parseInt(b));
        rrHistogramChart.data.labels = sortedBins.map(bin => `${bin}-${parseInt(bin) + 9}`);
        rrHistogramChart.data.datasets[0].data = sortedBins.map(bin => bins[bin]);
        rrHistogramChart.update();
    }

    // Poincaré Plot
    if (poincarePlotChart) {
        const poincareData = [];
        for (let i = 0; i < rrIntervalsBuffer.length - 1; i++) {
            poincareData.push({ x: rrIntervalsBuffer[i], y: rrIntervalsBuffer[i + 1] });
        }
        poincarePlotChart.data.datasets[0].data = poincareData;
        poincarePlotChart.update();
    }
}

// Function to update Power Spectrum Chart
function updatePowerSpectrumChart() {
    if (powerSpectrumChart && currentSessionData.vlfPower !== undefined) {
        powerSpectrumChart.data.datasets[0].data = [
            currentSessionData.vlfPower,
            currentSessionData.lfPower,
            currentSessionData.hfPower
        ];
        powerSpectrumChart.update();
    }
}


// Helper for HR Zone Calculation (can be moved to a utility file if needed elsewhere)
function getHrZone(currentHR, at) {
    if (currentHR >= at * 1.1) return 'Intensive 2';
    if (currentHR >= at * 1.05) return 'Intensive 1';
    if (currentHR >= at * 0.95) return 'Endurance 3';
    if (currentHR >= at * 0.85) return 'Endurance 2';
    if (currentHR >= at * 0.75) return 'Endurance 1';
    if (currentHR >= at * 0.7 + 5) return 'Cooldown';
    if (currentHR >= at * 0.7) return 'Warmup';
    return 'Resting';
}
