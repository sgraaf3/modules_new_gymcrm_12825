import { getAllData } from '../../database.js';

let sleepTrendChart;
let sportActivitiesTrendChart;

// Helper function to get data from the last month
function filterDataLastMonth(data, dateField) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return data.filter(item => {
        const itemDate = new Date(item[dateField]);
        return itemDate >= oneMonthAgo && !isNaN(itemDate.getTime());
    });
}

// NIEUWE FUNCTIE: Slaap Trendgrafiek
export async function initSleepTrendChart() {
    if (sleepTrendChart) sleepTrendChart.destroy();
    const sleepChartCtx = document.getElementById('sleepTrendChart')?.getContext('2d');
    if (sleepChartCtx) {
        const sleepData = await getAllData('sleepData');
        const sleepDataFiltered = filterDataLastMonth(sleepData, 'date')
            .filter(item => typeof item.score === 'number' && !isNaN(item.score));

        const labels = sleepDataFiltered.map(item => new Date(item.date).toLocaleDateString());
        const sleepScores = sleepDataFiltered.map(item => item.score);

        sleepTrendChart = new Chart(sleepChartCtx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['Geen data'],
                datasets: [{
                    label: 'Slaap Score',
                    data: sleepScores.length > 0 ? sleepScores : [0],
                    borderColor: '#8b5cf6',
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
                            text: 'Score'
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

// NIEUWE FUNCTIE: Sportactiviteiten Trendgrafiek
export async function initSportActivitiesTrendChart() {
    if (sportActivitiesTrendChart) sportActivitiesTrendChart.destroy();
    const sportActivitiesChartCtx = document.getElementById('sportActivitiesTrendChart')?.getContext('2d');
    if (sportActivitiesChartCtx) {
        const sportData = await getAllData('sportData');
        const sportDataFiltered = filterDataLastMonth(sportData, 'sportDate')
            .filter(item => typeof item.sportDuration === 'number' && !isNaN(item.sportDuration));

        const labels = sportDataFiltered.map(item => new Date(item.sportDate).toLocaleDateString());
        const sportDurations = sportDataFiltered.map(item => item.sportDuration);

        sportActivitiesTrendChart = new Chart(sportActivitiesChartCtx, {
            type: 'bar',
            data: {
                labels: labels.length > 0 ? labels : ['Geen data'],
                datasets: [{
                    label: 'Duur Sportactiviteiten (minuten)',
                    data: sportDurations.length > 0 ? sportDurations : [0],
                    backgroundColor: '#ef4444',
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
                            text: 'Duur (minuten)'
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
