// Bestand: js/views/hrDataView.js
// Bevat logica voor het weergeven van HR- en HRV-gegevens, inclusief grafieken en drempelwaarden.

import { getData, getAllData } from '../database.js';
import { HRVAnalyzer } from './hrv_analysis_utils.js'; // Corrected import path
import { showNotification } from './notifications.js';

let hrBreathChart;
let historicalHrChart, historicalRmssdChart, historicalSdnnChart, historicalBreathRateChart;

export async function initHrDataView() {
    console.log("HR & HRV Gegevens View geïnitialiseerd.");
    const hrDataView = document.getElementById('hrDataView');

    if (hrDataView.dataset.chartsInitialized) {
        await updateDataAndCharts();
        return;
    }

    // Functie om de grafieken te initialiseren met lege datasets
    function initializeCharts() {
        if (hrBreathChart) hrBreathChart.destroy();
        const hrBreathCtx = document.getElementById('hrBreathChart')?.getContext('2d');
        if (hrBreathCtx) {
            hrBreathChart = new Chart(hrBreathCtx, {
                type: 'line',
                data: {
                    labels: [], datasets: [
                        { label: 'Hartslag (BPM)', data: [], borderColor: '#60a5fa', tension: 0.4, fill: false },
                        { label: 'Ademhalingsfrequentie (BPM)', data: [], borderColor: '#4ade80', tension: 0.4, fill: false }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        if (historicalHrChart) historicalHrChart.destroy();
        const historicalHrCtx = document.getElementById('historicalHrChart')?.getContext('2d');
        if (historicalHrCtx) {
            historicalHrChart = new Chart(historicalHrCtx, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'Gemiddelde HR', data: [], borderColor: '#60a5fa', tension: 0.4, fill: false }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        if (historicalRmssdChart) historicalRmssdChart.destroy();
        const historicalRmssdCtx = document.getElementById('historicalRmssdChart')?.getContext('2d');
        if (historicalRmssdCtx) {
            historicalRmssdChart = new Chart(historicalRmssdCtx, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'RMSSD', data: [], borderColor: '#4ade80', tension: 0.4, fill: false }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        if (historicalSdnnChart) historicalSdnnChart.destroy();
        const historicalSdnnCtx = document.getElementById('historicalSdnnChart')?.getContext('2d');
        if (historicalSdnnCtx) {
            historicalSdnnChart = new Chart(historicalSdnnCtx, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'SDNN', data: [], borderColor: '#facc15', tension: 0.4, fill: false }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        if (historicalBreathRateChart) historicalBreathRateChart.destroy();
        const historicalBreathRateCtx = document.getElementById('historicalBreathRateChart')?.getContext('2d');
        if (historicalBreathRateCtx) {
            historicalBreathRateChart = new Chart(historicalBreathRateCtx, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'Ademhalingsfrequentie', data: [], borderColor: '#c084fc', tension: 0.4, fill: false }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }

    // Functie om de grafieken en UI-elementen te vullen met echte gegevens
    async function updateDataAndCharts() {
        const userId = window.getUserId();
        const profileData = await getData('userProfile', userId);
        const trainingSessions = await getAllData('trainingSessions');
        const restSessions = await getAllData('restSessionsAdvanced');

        // Update fysiologische drempelwaarden
        if (profileData) {
            document.getElementById('hrDataPredictedAt').textContent = `${profileData.userBaseAtHR || '--'} bpm`;
            document.getElementById('hrDataRestingHr').textContent = `${profileData.userRestHR || '--'} bpm`;
            document.getElementById('hrDataMaxHr').textContent = `${profileData.userMaxHR || '--'} bpm`;
            document.getElementById('hrDataSleepHr').textContent = `${profileData.userSleepHR || '--'} bpm`;
            document.getElementById('hrDataAvgDailyHr').textContent = `${profileData.userAvgDailyHr || '--'} bpm`;
        }

        // Bereid historische gegevens voor de grafieken voor
        const historicalData = [...trainingSessions, ...restSessions].sort((a, b) => new Date(a.date) - new Date(b.date));
        const labels = historicalData.map(session => new Date(session.date).toLocaleDateString());
        const avgHrData = historicalData.map(session => session.avgHr);
        const rmssdData = historicalData.map(session => session.rmssd);
        const sdnnData = historicalData.map(session => session.sdnn);
        const breathRateData = historicalData.map(session => session.avgBreathRate);
        const rmssdValues = historicalData.map(session => session.rmssd);
        const sdnnValues = historicalData.map(session => session.sdnn);
        const breathRateValues = historicalData.map(session => session.avgBreathRate);
        
        // Update de datasets van de grafieken
        if (historicalHrChart) {
            historicalHrChart.data.labels = labels;
            historicalHrChart.data.datasets[0].data = avgHrData;
            historicalHrChart.update();
        }
        if (historicalRmssdChart) {
            historicalRmssdChart.data.labels = labels;
            historicalRmssdChart.data.datasets[0].data = rmssdData;
            historicalRmssdChart.update();
        }
        if (historicalSdnnChart) {
            historicalSdnnChart.data.labels = labels;
            historicalSdnnChart.data.datasets[0].data = sdnnData;
            historicalSdnnChart.update();
        }
        if (historicalBreathRateChart) {
            historicalBreathRateChart.data.labels = labels;
            historicalBreathRateChart.data.datasets[0].data = breathRateData;
            historicalBreathRateChart.update();
        }
    }

    initializeCharts();
    await updateDataAndCharts();
    hrDataView.dataset.chartsInitialized = true;
}