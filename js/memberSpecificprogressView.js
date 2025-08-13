// Bestand: js/views/memberSpecificprogressView.js
// Bevat logica voor het weergeven van gebruikersprogressie en gedetailleerde grafieken.

import { getData, getAllData, getUserRole } from '../database.js'; // Let op het relatieve pad

let userProgressMainChart;
let currentDetailedChart; // Houd de gedetailleerde grafiek bij

export async function initMemberSpecificprogressView(showView, data) {
    const userId = data && data.userId ? data.userId : getOrCreateUserId();
    console.log(`Initializing User Progress View for user ${userId}`);

    const user = await getData('registry', userId);
    if (user) {
        document.getElementById('member-progress-title').textContent = `Voortgang voor ${user.name}`;
    }

    const keyMetricsContainer = document.getElementById('keyMetrics');
    if (keyMetricsContainer) {
        await loadKeyMetrics(userId, keyMetricsContainer);
    }

    // Main progress chart
    const userProgressMainCtx = document.getElementById('userProgressMainChart')?.getContext('2d');
    if (userProgressMainCtx) {
        const trainingSessions = await getAllData('trainingSessions');
        const userSessions = trainingSessions.filter(s => s.userId === userId);

        if (window.userProgressMainChart) {
            window.userProgressMainChart.destroy();
        }

        window.userProgressMainChart = new Chart(userProgressMainCtx, {
            type: 'line',
            data: {
                labels: userSessions.map(s => new Date(s.date).toLocaleDateString()),
                datasets: [{
                    label: 'Training Duur (min)',
                    data: userSessions.map(s => s.duration),
                    borderColor: '#34d399',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Detailed stats widgets
    document.querySelectorAll('.dashboard-widget-card').forEach(card => {
        card.addEventListener('click', () => {
            const graphType = card.dataset.graphType;
            showView('webGraphsView', { userId, graphType });
        });
    });
}

async function loadKeyMetrics(userId, container) {
    container.innerHTML = ''; // Clear previous content

    const trainingSessions = await getAllData('trainingSessions');
    const userTrainingSessions = trainingSessions.filter(s => s.userId === userId);
    const latestTraining = userTrainingSessions.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    const restSessions = await getAllData('restSessionsAdvanced');
    const userRestSessions = restSessions.filter(s => s.userId === userId);
    const latestRestMeasurement = userRestSessions.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    const metrics = [
        {
            title: "Laatste Training Duur",
            value: latestTraining ? `${latestTraining.duration} min` : "N/A",
            icon: "fas fa-running",
            color: "text-blue-400"
        },
        {
            title: "Gemiddelde HR (Laatste Training)",
            value: latestTraining ? `${latestTraining.avgHr} bpm` : "N/A",
            icon: "fas fa-heartbeat",
            color: "text-red-400"
        },
        {
            title: "Laatste HRV (RMSSD)",
            value: latestRestMeasurement ? `${latestRestMeasurement.rmssd} ms` : "N/A",
            icon: "fas fa-wave-square",
            color: "text-green-400"
        }
    ];

    metrics.forEach(metric => {
        const metricCard = document.createElement('div');
        metricCard.className = 'bg-gray-800 p-4 rounded-lg shadow-md flex items-center';
        metricCard.innerHTML = `
            <div class="text-2xl mr-4 ${metric.color}">
                <i class="${metric.icon}"></i>
            </div>
            <div>
                <h4 class="text-gray-300 text-sm">${metric.title}</h4>
                <p class="text-white text-lg font-bold">${metric.value}</p>
            </div>
        `;
        container.appendChild(metricCard);
    });
}

// Deze functie is geëxporteerd zodat app.js deze kan aanroepen bij het laden van webGraphsView
export async function showDetailedGraph(showView, data) { 
    const { userId, graphType } = data;
    console.log(`Gedetailleerde Grafiek View geïnitialiseerd voor user ${userId} en type: ${graphType}`);

    const detailedGraphChartCtx = document.getElementById('detailedGraphChart')?.getContext('2d');
    const webGraphsTitle = document.getElementById('webGraphsTitle');

    if (!detailedGraphChartCtx) return;

    if (window.currentDetailedChart) {
        window.currentDetailedChart.destroy();
    }

    let chartData = {};
    let title = '';

    const trainingSessions = await getAllData('trainingSessions');
    const userSessions = trainingSessions.filter(s => s.userId === userId);

    switch (graphType) {
        case 'hr':
            title = 'Hartslag (HR) Progressie';
            chartData = {
                labels: userSessions.map(s => new Date(s.date).toLocaleDateString()),
                datasets: [{
                    label: 'Gemiddelde HR',
                    data: userSessions.map(s => s.avgHr),
                    borderColor: '#60a5fa',
                    tension: 0.4,
                    fill: false
                }]
            };
            break;
        case 'hrv':
            title = 'HRV Progressie';
            const restSessions = await getAllData('restSessionsAdvanced');
            const userRestSessions = restSessions.filter(s => s.userId === userId);
            chartData = {
                labels: userRestSessions.map(s => new Date(s.date).toLocaleDateString()),
                datasets: [{
                    label: 'RMSSD',
                    data: userRestSessions.map(s => s.rmssd),
                    borderColor: '#4ade80',
                    tension: 0.4,
                    fill: false
                }]
            };
            break;
        // Add more cases for other graph types here...
        default:
            title = 'Gedetailleerde Grafieken';
            chartData = {
                labels: [],
                datasets: []
            };
    }

    webGraphsTitle.textContent = title;
    window.currentDetailedChart = new Chart(detailedGraphChartCtx, {
        type: 'line',
        data: chartData,
        options: { responsive: true, maintainAspectRatio: false }
    });
}
