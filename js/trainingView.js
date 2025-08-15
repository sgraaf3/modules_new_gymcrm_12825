import { putData, getData, getAllData, getOrCreateUserId } from '../database.js';
import { showNotification } from './notifications.js';

// Chart instances
let hrCombinedChart; // Nieuwe naam voor de gecombineerde HR/RR/Breath grafiek
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

export async function initTrainingView(showView) {
    console.log("Training View geïnitialiseerd.");

    const savedSchedulesList = document.getElementById('saved-schedules-list');

    async function loadSavedSchedules() {
        try {
            // Fetch blocks and weeks from IndexedDB
            const blocks = await getAllData('trainingBlocks');
            const weeks = await getAllData('trainingWeeks');

            savedSchedulesList.innerHTML = ''; // Clear existing list

            if (blocks.length === 0 && weeks.length === 0) {
                savedSchedulesList.innerHTML = '<p class="text-gray-400">Geen opgeslagen schema\'s gevonden.</p>';
                return;
            }

            // Display Blocks
            blocks.forEach(block => {
                const blockCard = document.createElement('div');
                blockCard.className = 'bg-gray-700 p-4 rounded-lg mb-4';
                blockCard.innerHTML = `
                    <h3 class="text-lg font-bold">${block.name} (Blok)</h3>
                    <p class="text-sm text-gray-400">${block.notes || 'Geen notities'}</p>
                    <button class="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md" data-type="block" data-id="${block.id}">Start Blok</button>
                `;
                savedSchedulesList.appendChild(blockCard);
            });

            // Display Weeks
            weeks.forEach(week => {
                const weekCard = document.createElement('div');
                weekCard.className = 'bg-gray-700 p-4 rounded-lg mb-4';
                weekCard.innerHTML = `
                    <h3 class="text-lg font-bold">${week.name} (Week)</h3>
                    <button class="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md" data-type="week" data-id="${week.id}">Start Week</button>
                `;
                savedSchedulesList.appendChild(weekCard);
            });

            // Add event listeners to "Start" buttons
            savedSchedulesList.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', () => {
                    const type = button.dataset.type;
                    const id = button.dataset.id;
                    // Navigate to liveTrainingView and pass the schedule details
                    showView('liveTrainingView', { scheduleType: type, scheduleId: id });
                });
            });

        } catch (error) {
            console.error("Error loading saved schedules:", error);
            savedSchedulesList.innerHTML = '<p class="text-red-400">Fout bij het laden van schema\'s.</p>';
        }
    }

    await loadSavedSchedules();
}
