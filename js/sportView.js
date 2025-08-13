// Bestand: js/views/sportView.js
// Bevat logica voor het beheren en analyseren van sportgegevens.

import { getData, putData, deleteData, getAllData } from '../database.js';
import { showNotification } from './notifications.js'; // Importeer notificatiesysteem

export async function initSportView() {
    console.log("Sport View geïnitialiseerd.");

    const sportActivitiesList = document.getElementById('sportActivitiesList');
    const sportActivityForm = document.getElementById('sportActivityForm');
    const sportActivityIdInput = document.getElementById('sportActivityId');
    const sportNameInput = document.getElementById('sportName');
    const sportTypeInput = document.getElementById('sportType');
    const sportDurationInput = document.getElementById('sportDuration');
    const sportDateInput = document.getElementById('sportDate');
    const sportNotesInput = document.getElementById('sportNotes');
    const clearSportActivityFormBtn = document.getElementById('clearSportActivityFormBtn');

    async function loadSportActivities() {
        try {
            const activities = await getAllData('sportData'); // 'sportData' is de store voor sportactiviteiten
            sportActivitiesList.innerHTML = ''; // Maak de bestaande lijst leeg

            if (activities.length === 0) {
                sportActivitiesList.innerHTML = '<p class="text-gray-400">Geen sportactiviteiten gevonden.</p>';
                return;
            }

            // Sorteer activiteiten van nieuw naar oud
            activities.sort((a, b) => new Date(b.sportDate) - new Date(a.sportDate));

            activities.forEach(activity => {
                const activityCard = document.createElement('div');
                activityCard.className = 'data-card';
                activityCard.innerHTML = `
                    <div class="card-header"><h3>${activity.sportName} (${activity.sportType})</h3></div>
                    <div class="sub-value">Datum: ${activity.sportDate || 'N.v.t.'}</div>
                    <div class="sub-value">Duur: ${activity.sportDuration || '--'} minuten</div>
                    <div class="sub-value">Notities: ${activity.sportNotes || 'Geen'}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-blue-400 hover:text-blue-300 text-sm mr-2" data-action="edit-sport-activity" data-id="${activity.id}">Bewerk</button>
                        <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-sport-activity" data-id="${activity.id}">Verwijder</button>
                    </div>
                `;
                sportActivitiesList.appendChild(activityCard);
            });

            // Voeg event listeners toe voor bewerk/verwijder knoppen
            sportActivitiesList.querySelectorAll('[data-action="edit-sport-activity"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const activityId = parseInt(event.target.dataset.id);
                    const activity = await getData('sportData', activityId);
                    if (activity) {
                        sportActivityIdInput.value = activity.id;
                        sportNameInput.value = activity.sportName;
                        sportTypeInput.value = activity.sportType;
                        sportDurationInput.value = activity.sportDuration;
                        sportDateInput.value = activity.sportDate;
                        sportNotesInput.value = activity.sportNotes;
                    }
                });
            });

            sportActivitiesList.querySelectorAll('[data-action="delete-sport-activity"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const activityId = parseInt(event.target.dataset.id);
                    // Vervang confirm() door een custom modal of notificatie met actie
                    if (confirm('Weet u zeker dat u deze sportactiviteit wilt verwijderen?')) { // Voor nu nog confirm
                        try {
                            await deleteData('sportData', activityId);
                            showNotification('Sportactiviteit verwijderd!', 'success');
                            loadSportActivities(); // Herlaad de lijst
                        } catch (error) {
                            console.error("Fout bij verwijderen sportactiviteit:", error);
                            showNotification('Fout bij verwijderen sportactiviteit.', 'error');
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Fout bij laden sportactiviteiten:", error);
            showNotification("Fout bij laden sportactiviteiten.", "error");
        }
    }

    if (sportActivityForm) {
        sportActivityForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const activity = {
                id: sportActivityIdInput.value ? parseInt(sportActivityIdInput.value) : undefined, // Gebruik undefined voor autoIncrement
                sportName: sportNameInput.value,
                sportType: sportTypeInput.value,
                sportDuration: parseFloat(sportDurationInput.value),
                sportDate: sportDateInput.value,
                sportNotes: sportNotesInput.value
            };
            try {
                await putData('sportData', activity);
                showNotification('Sportactiviteit opgeslagen!', 'success');
                sportActivityForm.reset();
                sportActivityIdInput.value = ''; // Maak verborgen ID leeg
                loadSportActivities(); // Herlaad de lijst
            } catch (error) {
                console.error("Fout bij opslaan sportactiviteit:", error);
                showNotification('Fout bij opslaan sportactiviteit.', 'error');
            }
        });
    }

    if (clearSportActivityFormBtn) {
        clearSportActivityFormBtn.addEventListener('click', () => {
            sportActivityForm.reset();
            sportActivityIdInput.value = '';
            showNotification('Formulier leeggemaakt.', 'info');
        });
    }

    await loadSportActivities(); // Laad sportactiviteiten bij initialisatie van de view
}
