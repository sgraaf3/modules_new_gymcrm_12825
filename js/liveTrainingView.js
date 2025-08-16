// Bestand: js/liveTrainingView.js
// Bevat logica voor het uitvoeren en opslaan van live trainingsmetingen, inclusief uitgebreide statistieken en grafieken.

import { putData, getData, getOrCreateUserId } from '../database.js';
import { showNotification } from './notifications.js';
import { getHrZone } from './measurement_utils.js';


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

// Formats seconds into MM:SS
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// Determines the HR zone based on RMSSD for resting states
function getHrvBasedRestZone(rmssd) {
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


// bluetoothController is now passed in from app.js
export async function initLiveTrainingView(showViewCallback, data, bluetoothController) {
    console.log("Live Training View geïnitialiseerd.");

    const currentAppUserId = getOrCreateUserId();
    currentSessionData.userId = currentAppUserId;

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
        bluetoothErrorTooltip: document.getElementById('bluetoothErrorTooltip'),
        calculatedAtDisplay: document.getElementById('calculatedAtDisplay')
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
            if (!bluetoothController.isConnected()) {
                showNotification('Verbinden met Bluetooth-apparaat...', 'info');
                bluetoothController.setPreset(currentSessionData.type); // Use the selected measurement type
                await bluetoothController.connect();
            } else {
                showNotification('Bluetooth is al verbonden.', 'info');
            }
        });
    }

    if (uiElements.startMeasurementBtnLive) {
        // Initial button text
        uiElements.startMeasurementBtnLive.textContent = bluetoothController.isConnected() ? 'Start Meting' : 'Verbind Bluetooth om te starten';

        uiElements.startMeasurementBtnLive.addEventListener('click', async () => {
            if (!bluetoothController.isConnected()) {
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
            measurementInterval = setInterval(() => {
                if (measurementStartTime) {
                    const elapsedSeconds = Math.floor((Date.now() - measurementStartTime) / 1000);
                    currentSessionData.duration = elapsedSeconds;
                    uiElements.liveTimerDisplay.textContent = formatTime(elapsedSeconds);
                }
            }, 1000);
            hrZoneInterval = setInterval(() => updateHrZoneTimes(uiElements, userProfile.userBaseAtHR, userProfile.userRestHR), 1000);
            if (uiElements.measurementTypeSelect) uiElements.measurementTypeSelect.disabled = true;
            showNotification('Meting gestart!', 'success');
        });
    }

    if (uiElements.stopMeasurementBtnLive) {
        uiElements.stopMeasurementBtnLive.addEventListener('click', async () => {
             if (bluetoothController.isConnected()) {
                await bluetoothController.disconnect();
            }
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
                            showViewCallback('reportsView'); // Or a dedicated rest reports view
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
        const fabIcon = uiElements.bluetoothFabBtn.querySelector('i');

        if (uiElements.bluetoothStatusDisplay) {
            uiElements.bluetoothStatusDisplay.textContent = `Bluetooth: ${state}`;
        }
        
        switch(state) {
            case 'SEARCHING':
                isBluetoothConnected = false;
                fabIcon.className = 'fas fa-spinner fa-spin';
                if (uiElements.startMeasurementBtnLive) uiElements.startMeasurementBtnLive.textContent = 'Zoeken...';
                break;
            case 'CONNECTING':
                isBluetoothConnected = false;
                fabIcon.className = 'fas fa-spinner fa-spin';
                if (uiElements.startMeasurementBtnLive) uiElements.startMeasurementBtnLive.textContent = 'Verbinden...';
                break;
            case 'STREAMING':
                isBluetoothConnected = true;
                fabIcon.className = 'fas fa-check text-green-400';
                if (uiElements.startMeasurementBtnLive) {
                    uiElements.startMeasurementBtnLive.textContent = 'Start Meting';
                    uiElements.startMeasurementBtnLive.disabled = false;
                }
                showNotification(`Bluetooth verbonden met ${deviceName || 'apparaat'}!`, 'success');
                break;
            case 'ERROR':
                isBluetoothConnected = false;
                fabIcon.className = 'fas fa-times text-red-400';
                if (uiElements.startMeasurementBtnLive) {
                    uiElements.startMeasurementBtnLive.textContent = 'Verbind Bluetooth om te starten';
                    uiElements.startMeasurementBtnLive.disabled = true;
                }
                showNotification('Bluetooth verbinding mislukt.', 'error');
                break;
            case 'STOPPED':
                isBluetoothConnected = false;
                fabIcon.className = 'fas fa-bluetooth-b';
                if (uiElements.startMeasurementBtnLive) {
                    uiElements.startMeasurementBtnLive.textContent = 'Verbind Bluetooth om te starten';
                    uiElements.startMeasurementBtnLive.disabled = true;
                }
                if (uiElements.stopMeasurementBtnLive) uiElements.stopMeasurementBtnLive.style.display = 'none';
                if (uiElements.saveMeasurementBtn) uiElements.saveMeasurementBtn.style.display = 'block';
                if (uiElements.measurementTypeSelect) uiElements.measurementTypeSelect.disabled = false;
                clearInterval(measurementInterval);
                clearInterval(hrZoneInterval);
                measurementInterval = null;
                hrZoneInterval = null;
                showNotification('Meting gestopt.', 'info');
                break;
        }
    };

    bluetoothController.onData = (dataPacket) => {
        if (!measurementInterval) return; // Don't process data if measurement hasn't started

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
                    uiElements.liveHrZoneDisplay.textContent = getHrZone(currentHr, userBaseAtHR, 0);
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
                const hrvMetrics = new HRVAnalyzer(rrIntervalsBuffer);
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


// Updates time spent in each HR zone
function updateHrZoneTimes(uiElements, userBaseAtHR, userRestHR) {
    if (hrDataBuffer.length > 0) {
        const currentHr = hrDataBuffer[hrDataBuffer.length - 1];
        let zone;

        // Logica: Als HR onder 65% van AT valt, gebruik RMSSD-gebaseerde zones
        if (userBaseAtHR > 0 && currentHr < (userBaseAtHR * 0.65)) {
            zone = getHrvBasedRestZone(currentSessionData.rmssd); // Gebruik de berekende RMSSD
        } else if (userBaseAtHR > 0) {
            zone = getHrZone(currentHr, userBaseAtHR, 0); // Gebruik bestaande AT-gebaseerde zones
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
        const hrvMetrics = new HRVAnalyzer(rrIntervalsBuffer);
        if (uiElements.summaryRmssd) uiElements.summaryRmssd.textContent = hrvMetrics.rmssd.toFixed(2);
        if (uiElements.summarySdnn) uiElements.summarySdnn.textContent = hrvMetrics.sdnn.toFixed(2);
        if (uiElements.summaryPnn50) uiElements.summaryPnn50.textContent = hrvMetrics.pnn50.toFixed(2);
        if (uiElements.hrvRecoveryStatus) uiElements.hrvRecoveryStatus.textContent = getHrvRecoveryStatus(hrvMetrics.rmssd);

        currentSessionData.rmssd = hrvMetrics.rmssd;
        currentSessionData.sdnn = hrvMetrics.sdnn;
        currentSessionData.pnn50 = hrvMetrics.pnn50;

        // Wellness Scores
        if(uiElements.scoreRecovery && hrvMetrics.recoveryScore) uiElements.scoreRecovery.textContent = hrvMetrics.recoveryScore.toFixed(1);
        if(uiElements.scoreStrain && hrvMetrics.strainScore) uiElements.scoreStrain.textContent = hrvMetrics.strainScore.toFixed(1);
        if(uiElements.scoreSleep && hrvMetrics.sleepQualityScore) uiElements.scoreSleep.textContent = hrvMetrics.sleepQualityScore.toFixed(1);
        if(uiElements.scoreConditioning && hrvMetrics.conditioningScore) uiElements.scoreConditioning.textContent = hrvMetrics.conditioningScore.toFixed(1);
        currentSessionData.wellnessScores = {
            recovery: hrvMetrics.recoveryScore,
            strain: hrvMetrics.strainScore,
            sleep: hrvMetrics.sleepQualityScore,
            conditioning: hrvMetrics.conditioningScore
        };

        // Intensity Score
        const { rpe, intensity } = estimateRpe({ currentHR: hrDataBuffer[hrDataBuffer.length - 1], anaerobicThresholdHR: userProfile.userBaseAtHR, durationMinutes: currentSessionData.duration / 60 });
        if(uiElements.inputRpe) uiElements.inputRpe.value = rpe || '';
        if(uiElements.scoreIntensity) uiElements.scoreIntensity.textContent = intensity;
        currentSessionData.rpe = rpe;
        currentSessionData.intensityScore = intensity;


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

    // Breath Data
    if (breathRateBuffer.length >= 6) {
        const lastSixCycles = breathRateBuffer.slice(-6);
        const avgLastSix = lastSixCycles.reduce((sum, val) => sum + val, 0) / lastSixCycles.length;
        if (uiElements.breathLastCycle) uiElements.breathLastCycle.textContent = `${avgLastSix.toFixed(1)} BPM`;
    } else if (uiElements.breathLastCycle) {
        uiElements.breathLastCycle.textContent = '-- BPM';
    }

    // Simulate Ti/Te ratio for display
    const simulatedTi = (Math.random() * 1.5 + 1.5).toFixed(2); // e.g., 1.5-3.0s
    const simulatedTe = (Math.random() * 1.5 + 2.0).toFixed(2); // e.g., 2.0-3.5s
    const simulatedRatio = (simulatedTi / simulatedTe).toFixed(2);

    if (uiElements.breathAvgTotalCycles) uiElements.breathAvgTotalCycles.textContent = `${simulatedTi}s / ${simulatedTe}s`;
    if (uiElements.breathCurrentBf) uiElements.breathCurrentBf.textContent = simulatedRatio;
    
    currentSessionData.breathData = {
        lastCycle: uiElements.breathLastCycle ? uiElements.breathLastCycle.textContent : '--',
        avgTiTeRatio: simulatedRatio,
        avgTi: simulatedTi,
        avgTe: simulatedTe
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

// --- Option 2: Additional Calculation Functions ---

// This is a helper function used only by simulateBreathingFromRr, so it is not exported.
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

function getPredictedRunTimes(vo2max) {
    const vo2ToRunTimesMap = new Map([
        [36,{"3k":1143,"5k":2039,"10k":4514,"21k":10785,"42k":24674}],
        [40,{"3k":1026,"5k":1819,"10k":3988,"21k":9399,"42k":21133}],
        [50,{"3k":810,"5k":1420,"10k":3058,"21k":7036,"42k":15380}],
        [60,{"3k":662,"5k":1152,"10k":2451,"21k":5555,"42k":11938}],
        [70,{"3k":555,"5k":961,"10k":2027,"21k":4545,"42k":9656}],
        [85,{"3k":441,"5k":759,"10k":1587,"21k":3521,"42k":7397}]
    ]);
    const vo2Keys = Array.from(vo2ToRunTimesMap.keys());
    const closestVo2 = vo2Keys.reduce((prev, curr) => Math.abs(curr - vo2max) < Math.abs(prev - vo2max) ? curr : prev);
    return vo2ToRunTimesMap.get(closestVo2) || { note: "No data for this VO2max level." };
}

function estimateVo2max(hr) {
    if (!hr || hr < 40) return null;
    const vo2max = 30 + (hr - 60) * (30 / 130);
    return Math.max(30, Math.min(60, vo2max));
}

function calculateFitnessScore(currentVo2, potentialVo2, theoreticalMaxVo2) {
    if (!currentVo2 || !potentialVo2 || !theoreticalMaxVo2 || potentialVo2 <= 0 || theoreticalMaxVo2 <= 0) return null;
    const ratio1 = currentVo2 / potentialVo2;
    const ratio2 = potentialVo2 / theoreticalMaxVo2;
    return (ratio1 + ratio2) / 2;
}

function getVo2maxRating(vo2max, age, gender) {
    const scoreData = {
        male: { "20-29": [[31,"Poor"],[35,"Fair"],[42,"Average"],[48,"Good"],[53,"Excellent"]], "30-39": [[29,"Poor"],[34,"Fair"],[40,"Average"],[45,"Good"],[51,"Excellent"]], "40-49": [[26,"Poor"],[31,"Fair"],[36,"Average"],[41,"Good"],[48,"Excellent"]], "50-99": [[24,"Poor"],[29,"Fair"],[34,"Average"],[39,"Good"],[45,"Excellent"]] },
        female: { "20-29": [[26,"Poor"],[30,"Fair"],[35,"Average"],[40,"Good"],[44,"Excellent"]], "30-39": [[24,"Poor"],[28,"Fair"],[33,"Average"],[37,"Good"],[41,"Excellent"]], "40-49": [[21,"Poor"],[25,"Fair"],[30,"Average"],[34,"Good"],[38,"Excellent"]], "50-99": [[19,"Poor"],[23,"Fair"],[28,"Average"],[32,"Good"],[36,"Excellent"]] }
    };
    const genderKey = gender.toLowerCase();
    const ageBrackets = Object.keys(scoreData[genderKey]);
    let selectedBracketKey = ageBrackets[ageBrackets.length - 1];
    for (const bracket of ageBrackets) {
        const [minAge, maxAge] = bracket.split('-').map(Number);
        if (age >= minAge && age <= maxAge) {
            selectedBracketKey = bracket;
            break;
        }
    }
    const standards = scoreData[genderKey][selectedBracketKey];
    for (const [maxScore, rating] of standards) {
        if (vo2max <= maxScore) return rating;
    }
    return "Superior";
}

function getFitnessNote(score) {
    if (score < 0.50) return "Not fit at all. Start training.";
    if (score < 0.65) return "The minimum is there. Go/continue training.";
    if (score < 0.75) return "You are pretty fit!";
    if (score < 0.85) return "You are better than just fit!";
    if (score < 0.95) return "You are an advanced athlete!";
    return "You are the best you can be!";
}

function calculateVo2MaxPotential({ maxOxygenUptake, weightKg, fatPercentage }) {
    if (weightKg <= 0) return 0;
    return (2 * maxOxygenUptake * 1000 / weightKg) * (1 - (fatPercentage / 100));
}

function calculateVo2TheoreticalMax({ maxOxygenUptake, heightCm, gender }) {
    const idealBmi = gender === 'male' ? 20.5 : 22.5;
    const idealWeight = idealBmi * Math.pow(heightCm / 100, 2);
    if (idealWeight <= 0) return 0;
    return (2 * maxOxygenUptake * 1000) / idealWeight;
}

function calculateRespiratoryRate(durationSeconds, breaths) {
    if (durationSeconds <= 0) {
        return { bpm: 0, interpretation: 'Invalid duration' };
    }
    const bpm = (breaths / durationSeconds) * 60;
    let interpretation = 'N/A';
    if (bpm > 20) interpretation = 'Fast (potential stress/exertion)';
    else if (bpm >= 12) interpretation = 'Normal (12-20 breaths/min)';
    else if (bpm >= 8) interpretation = 'Slow (relaxed/trained)';
    else interpretation = 'Very Slow (may indicate sleep/deep relaxation)';
    return { bpm, interpretation };
}

function simulateBreathingFromRr(rrIntervals) {
    if (!rrIntervals || rrIntervals.length === 0) {
        return [];
    }
    const breathingWave = [];
    for (const rr of rrIntervals) {
        const hr = 60000 / rr;
        let amplitude = hr * 4 - 200;
        amplitude = Math.min(Math.max(amplitude, 20), 120);
        breathingWave.push(amplitude);
    }
    return smooth(breathingWave, 5);
}

function estimateRpe({ currentHR, anaerobicThresholdHR, durationMinutes }) {
    if (!currentHR || !anaerobicThresholdHR || !durationMinutes || anaerobicThresholdHR <= 0) {
        return { rpe: null, intensity: 'Invalid input', percentAT: null };
    }
    const percentAT = (currentHR / anaerobicThresholdHR) * 100;
    let baseRPE = 0, intensity = '';
    if (percentAT < 50) { baseRPE = 1; intensity = "Very Light"; }
    else if (percentAT < 60) { baseRPE = 2; intensity = "Light"; }
    else if (percentAT < 70) { baseRPE = 4; intensity = "Moderate"; }
    else if (percentAT < 80) { baseRPE = 6; intensity = "Vigorous"; }
    else if (percentAT < 90) { baseRPE = 8; intensity = "Hard"; }
    else { baseRPE = 10; intensity = "Maximal Effort"; }
    let timeAdjustment = 0;
    if (percentAT >= 90 && durationMinutes > 10) timeAdjustment = 2;
    else if (percentAT >= 80 && durationMinutes > 20) timeAdjustment = 1;
    else if (percentAT >= 70 && durationMinutes > 30) timeAdjustment = 1;
    const rpe = Math.min(baseRPE + timeAdjustment, 10);
    return { rpe, intensity, percentAT: parseFloat(percentAT.toFixed(1)) };
}
