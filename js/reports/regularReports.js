import { getAllData } from '../../database.js';

let individualHrChart;
let individualHrvChart;
let breathRateChart;

// Helper function to get data from the last month
function filterDataLastMonth(data, dateField) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return data.filter(item => {
        const itemDate = new Date(item[dateField]);
        return itemDate >= oneMonthAgo && !isNaN(itemDate.getTime());
    });
}

// Functie om de individuele hartslag trendgrafiek te initialiseren/updaten
export async function initIndividualHrChart() {
    if (individualHrChart) individualHrChart.destroy();
    const individualHrChartCtx = document.getElementById('individualHrChart')?.getContext('2d');
    if (individualHrChartCtx) {
        const trainingSessions = await getAllData('trainingSessions');
        const hrDataFiltered = filterDataLastMonth(trainingSessions, 'date')
            .filter(session => typeof parseFloat(session.avgHr) === 'number' && !isNaN(parseFloat(session.avgHr)));

        const labels = hrDataFiltered.map(session => new Date(session.date).toLocaleDateString());
        const avgHrValues = hrDataFiltered.map(session => parseFloat(session.avgHr));

        individualHrChart = new Chart(individualHrChartCtx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['Geen data'],
                datasets: [{
                    label: 'Gemiddelde Hartslag (BPM)',
                    data: avgHrValues.length > 0 ? avgHrValues : [0],
                    borderColor: '#facc15',
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
                        title: {
                            display: true,
                            text: 'Hartslag (BPM)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        });
    }
}

// Functie om de individuele HRV trendgrafiek te initialiseren/updaten
export async function initIndividualHrvChart() {
    if (individualHrvChart) individualHrvChart.destroy();
    const individualHrvChartCtx = document.getElementById('individualHrvChart')?.getContext('2d');
    if (individualHrvChartCtx) {
        const trainingSessions = await getAllData('trainingSessions');
        const hrvDataFiltered = filterDataLastMonth(trainingSessions, 'date')
            .filter(session => typeof session.rmssd === 'number' && !isNaN(session.rmssd));

        const labels = hrvDataFiltered.map(session => new Date(session.date).toLocaleDateString());
        const rmssdValues = hrvDataFiltered.map(session => session.rmssd);

        individualHrvChart = new Chart(individualHrvChartCtx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['Geen data'],
                datasets: [{
                    label: 'RMSSD (MS)',
                    data: rmssdValues.length > 0 ? rmssdValues : [0],
                    borderColor: '#34d399',
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
                        title: {
                            display: true,
                            text: 'RMSSD (MS)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        });
    }
}

// NIEUWE FUNCTIE: Ademhaling Trendgrafiek
export async function initBreathRateChart() {
    if (breathRateChart) breathRateChart.destroy();
    const breathRateChartCtx = document.getElementById('breathRateChart')?.getContext('2d');
    if (breathRateChartCtx) {
        const trainingSessions = await getAllData('trainingSessions');
        const breathDataFiltered = filterDataLastMonth(trainingSessions, 'date')
            .filter(session => typeof session.avgBreathRate === 'number' && !isNaN(session.avgBreathRate));

        const labels = breathDataFiltered.map(session => new Date(session.date).toLocaleDateString());
        const avgBreathRates = breathDataFiltered.map(session => session.avgBreathRate);

        breathRateChart = new Chart(breathRateChartCtx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['Geen data'],
                datasets: [{
                    label: 'Gemiddelde Ademhalingsfrequentie (BPM)',
                    data: avgBreathRates.length > 0 ? avgBreathRates : [0],
                    borderColor: '#60a5fa',
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
                        title: {
                            display: true,
                            text: 'BPM'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        });
    }
}
