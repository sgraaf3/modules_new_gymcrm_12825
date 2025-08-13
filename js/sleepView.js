// Bestand: js/views/sleepView.js
// Bevat logica voor het weergeven van slaapgegevens.

import { putData, getAllData, deleteData } from '../database.js';
import { showNotification } from './notifications.js';

let sleepChartInstance; // Chart.js instance

export async function initSleepView() {
    console.log("Slaap View geïnitialiseerd.");

    const sleepLogForm = document.getElementById('sleepLogForm');
    const sleepDateInput = document.getElementById('sleepDate');
    const sleepDurationInput = document.getElementById('sleepDuration');
    const sleepQualityInput = document.getElementById('sleepQuality');
    const sleepNotesInput = document.getElementById('sleepNotes');
    const recentSleepLogsContainer = document.getElementById('recentSleepLogs');
    const sleepChartCtx = document.getElementById('sleepChart')?.getContext('2d');

    // Set today's date as default for the date input
    sleepDateInput.value = new Date().toISOString().split('T')[0];

    async function loadSleepLogs() {
        try {
            const sleepLogs = await getAllData('sleepData');
            recentSleepLogsContainer.innerHTML = '';

            if (sleepLogs.length === 0) {
                recentSleepLogsContainer.innerHTML = '<p class="text-gray-400">Geen slaap logs gevonden.</p>';
                if (sleepChartInstance) {
                    sleepChartInstance.destroy(); // Destroy chart if no data
                    sleepChartInstance = null;
                }
                return;
            }

            // Sort logs by date descending
            sleepLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Display recent logs
            sleepLogs.forEach(log => {
                const logCard = document.createElement('div');
                logCard.className = 'data-card';
                logCard.innerHTML = `
                    <div class="card-header"><h3>${new Date(log.date).toLocaleDateString()}</h3></div>
                    <div class="sub-value">Duur: ${log.duration} uur | Kwaliteit: ${log.quality}/10</div>
                    <div class="sub-value">Notities: ${log.notes || 'Geen'}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-sleep-log" data-id="${log.id}">Verwijder</button>
                    </div>
                `;
                recentSleepLogsContainer.appendChild(logCard);
            });

            recentSleepLogsContainer.querySelectorAll('[data-action="delete-sleep-log"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const logId = parseInt(event.target.dataset.id);
                    // Using confirm() as per existing code, but ideally replaced by custom modal
                    if (confirm('Weet u zeker dat u dit slaaplog wilt verwijderen?')) {
                        try {
                            await deleteData('sleepData', logId);
                            showNotification('Slaaplog verwijderd!', 'success');
                            loadSleepLogs(); // Reload the list and chart
                        } catch (error) {
                            console.error("Fout bij verwijderen slaaplog:", error);
                            showNotification('Fout bij verwijderen slaaplog.', 'error');
                        }
                    }
                });
            });

            // Render chart
            renderSleepChart(sleepLogs);

        } catch (error) {
            console.error("Fout bij laden slaaplogs:", error);
            showNotification("Fout bij laden slaaplogs.", "error");
        }
    }

    function renderSleepChart(sleepLogs) {
        if (!sleepChartCtx) return;

        // Destroy existing chart instance to prevent duplicates and memory leaks
        if (sleepChartInstance) {
            sleepChartInstance.destroy();
        }

        // Prepare data for chart (last 30 days, or all if less than 30)
        // Sort logs by date ascending for chart display
        const sortedLogs = sleepLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
        const labels = sortedLogs.map(log => new Date(log.date).toLocaleDateString());
        const durationData = sortedLogs.map(log => log.duration);
        const qualityData = sortedLogs.map(log => log.quality);

        sleepChartInstance = new Chart(sleepChartCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Slaapduur (uren)',
                        data: durationData,
                        borderColor: '#34d399', // Green
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y-duration'
                    },
                    {
                        label: 'Slaapkwaliteit (1-10)',
                        data: qualityData,
                        borderColor: '#60a5fa', // Blue
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y-quality'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    'y-duration': {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        title: { display: true, text: 'Slaapduur (uren)' }
                    },
                    'y-quality': {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        max: 10, // Quality is 1-10
                        title: { display: true, text: 'Slaapkwaliteit (1-10)' },
                        grid: { drawOnChartArea: false } // Prevent grid lines from overlapping
                    }
                },
                plugins: { legend: { display: true } }
            }
        });
    }

    if (sleepLogForm) {
        sleepLogForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const newLog = {
                date: sleepDateInput.value,
                duration: parseFloat(sleepDurationInput.value),
                quality: parseInt(sleepQualityInput.value),
                notes: sleepNotesInput.value.trim()
            };

            try {
                await putData('sleepData', newLog);
                showNotification('Slaaplog opgeslagen!', 'success');
                sleepLogForm.reset();
                sleepDateInput.value = new Date().toISOString().split('T')[0]; // Reset date to today
                loadSleepLogs(); // Reload the list and chart
            } catch (error) {
                console.error("Fout bij opslaan slaaplog:", error);
                showNotification('Fout bij opslaan slaaplog.', 'error');
            }
        });
    }

    await loadSleepLogs(); // Initial load of sleep logs when the view is initialized
}
