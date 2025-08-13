// Bestand: js/views/hrDataView.js
// Bevat logica voor het weergeven van HR- en HRV-gegevens, inclusief grafieken en drempelwaarden.

import { getData } from '../database.js'; // Let op het relatieve pad

let hrBreathChart;
let historicalHrChart, historicalRmssdChart, historicalSdnnChart, historicalBreathRateChart;

export function initHrDataView() {
    console.log("HR & HRV Gegevens View geïnitialiseerd.");
    const hrDataView = document.getElementById('hrDataView');
    // Voorkom dubbele initialisatie van grafieken als de view opnieuw wordt geladen zonder refresh
    if (hrDataView.dataset.chartsInitialized) {
        // Indien al geïnitialiseerd, update dan alleen de data indien nodig
        (async () => {
            const userId = window.getUserId();
            const profileData = await getData('userProfile', userId);
            if (profileData) {
                document.getElementById('hrDataPredictedAt').textContent = `${profileData.calculatedEffectiveEffectiveAt || '--'} bpm`;
                document.getElementById('hrDataRestingHr').textContent = `${profileData.userRestHR || '--'} bpm`;
                document.getElementById('hrDataMaxHr').textContent = `${profileData.userMaxHR || '--'} bpm`;
                document.getElementById('hrDataSleepHr').textContent = `${profileData.userSleepHR || '--'} bpm`;
                document.getElementById('hrDataAvgDailyHr').textContent = `${profileData.userAvgDailyHr || '--'} bpm`;
            }
        })();
        return;
    }

    const hrBreathCtx = document.getElementById('hrBreathChart')?.getContext('2d');
    if (hrBreathCtx) {
        hrBreathChart = new Chart(hrBreathCtx, {
            type: 'line',
            data: {
                labels: ['0s', '10s', '20s', '30s', '40s', '50s', '60s'],
                datasets: [
                    {
                        label: 'Hartslag (BPM)',
                        data: [60, 62, 61, 63, 65, 64, 66],
                        borderColor: '#60a5fa',
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: 'Ademhalingsfrequentie (BPM)',
                        data: [12, 13, 12.5, 13.5, 14, 13, 12],
                        borderColor: '#4ade80',
                        tension: 0.4,
                        fill: false
                    }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const historicalHrCtx = document.getElementById('historicalHrChart')?.getContext('2d');
    if (historicalHrCtx) {
        historicalHrChart = new Chart(historicalHrCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Gemiddelde HR',
                    data: [70, 72, 68, 75, 71, 69],
                    borderColor: '#60a5fa',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const historicalRmssdCtx = document.getElementById('historicalRmssdChart')?.getContext('2d');
    if (historicalRmssdCtx) {
        historicalRmssdChart = new Chart(historicalRmssdCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'RMSSD',
                    data: [40, 42, 38, 45, 41, 39],
                    borderColor: '#4ade80',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const historicalSdnnCtx = document.getElementById('historicalSdnnChart')?.getContext('2d');
    if (historicalSdnnCtx) {
        historicalSdnnChart = new Chart(historicalSdnnCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'SDNN',
                    data: [50, 55, 48, 58, 52, 50],
                    borderColor: '#facc15',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const historicalBreathRateCtx = document.getElementById('historicalBreathRateChart')?.getContext('2d');
    if (historicalBreathRateCtx) {
        historicalBreathRateChart = new Chart(historicalBreathRateCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Ademhalingsfrequentie',
                    data: [14, 13.5, 14.2, 13.8, 14.5, 13.9],
                    borderColor: '#c084fc',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    hrDataView.dataset.chartsInitialized = true; // Markeer als geïnitialiseerd

    // Vul fysiologische drempelwaarden in vanuit gebruikersprofiel indien beschikbaar
    (async () => {
        const userId = window.getUserId();
        const profileData = await getData('userProfile', userId);
        if (profileData) {
            document.getElementById('hrDataPredictedAt').textContent = `${profileData.calculatedEffectiveEffectiveAt || '--'} bpm`;
            document.getElementById('hrDataRestingHr').textContent = `${profileData.userRestHR || '--'} bpm`;
            document.getElementById('hrDataMaxHr').textContent = `${profileData.userMaxHR || '--'} bpm`;
            document.getElementById('hrDataSleepHr').textContent = `${profileData.userSleepHR || '--'} bpm`;
            document.getElementById('hrDataAvgDailyHr').textContent = `${profileData.userAvgDailyHr || '--'} bpm`;
        }
    })();
}
