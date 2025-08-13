// Bestand: js/views/activitiesView.js
// Bevat logica voor het beheren van algemene activiteiten.

import { getData, putData, deleteData, getAllData } from '../database.js';
import { showNotification } from './notifications.js'; // Importeer notificatiesysteem

export async function initActivitiesView() {
    console.log("Activiteiten View geïnitialiseerd.");

    const generalActivitiesList = document.getElementById('generalActivitiesList');
    const generalActivityForm = document.getElementById('generalActivityForm');
    const generalActivityIdInput = document.getElementById('generalActivityId');
    const activityNameInput = document.getElementById('activityName');
    const activityDateInput = document.getElementById('activityDate');
    const activityDescriptionInput = document.getElementById('activityDescription');
    const clearGeneralActivityFormBtn = document.getElementById('clearGeneralActivityFormBtn');

    async function loadGeneralActivities() {
        try {
            const activities = await getAllData('activitiesData'); // 'activitiesData' is de store voor algemene activiteiten
            generalActivitiesList.innerHTML = ''; // Maak de bestaande lijst leeg

            if (activities.length === 0) {
                generalActivitiesList.innerHTML = '<p class="text-gray-400">Geen activiteiten gevonden.</p>';
                return;
            }

            // Sorteer activiteiten van nieuw naar oud
            activities.sort((a, b) => new Date(b.activityDate) - new Date(a.activityDate));

            activities.forEach(activity => {
                const activityCard = document.createElement('div');
                activityCard.className = 'data-card';
                activityCard.innerHTML = `
                    <div class="card-header"><h3>${activity.name}</h3></div>
                    <div class="sub-value">Datum: ${activity.date || 'N.v.t.'}</div>
                    <div class="sub-value">Beschrijving: ${activity.description || 'Geen'}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-blue-400 hover:text-blue-300 text-sm mr-2" data-action="edit-general-activity" data-id="${activity.id}">Bewerk</button>
                        <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-general-activity" data-id="${activity.id}">Verwijder</button>
                    </div>
                `;
                generalActivitiesList.appendChild(activityCard);
            });

            // Voeg event listeners toe voor bewerk/verwijder knoppen
            generalActivitiesList.querySelectorAll('[data-action="edit-general-activity"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const activityId = parseInt(event.target.dataset.id);
                    const activity = await getData('activitiesData', activityId);
                    if (activity) {
                        generalActivityIdInput.value = activity.id;
                        activityNameInput.value = activity.name;
                        activityDateInput.value = activity.date;
                        activityDescriptionInput.value = activity.description;
                    }
                });
            });

            generalActivitiesList.querySelectorAll('[data-action="delete-general-activity"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const activityId = parseInt(event.target.dataset.id);
                    // Vervang confirm() door een custom modal of notificatie met actie
                    if (confirm('Weet u zeker dat u deze activiteit wilt verwijderen?')) { // Voor nu nog confirm
                        try {
                            await deleteData('activitiesData', activityId);
                            showNotification('Activiteit verwijderd!', 'success');
                            loadGeneralActivities(); // Herlaad de lijst
                        } catch (error) {
                            console.error("Fout bij verwijderen activiteit:", error);
                            showNotification('Fout bij verwijderen activiteit.', 'error');
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Fout bij laden activiteiten:", error);
            showNotification("Fout bij laden activiteiten.", "error");
        }
    }

    if (generalActivityForm) {
        generalActivityForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const activity = {
                id: generalActivityIdInput.value ? parseInt(generalActivityIdInput.value) : undefined, // Gebruik undefined voor autoIncrement
                name: activityNameInput.value,
                date: activityDateInput.value,
                description: activityDescriptionInput.value,
                timestamp: new Date().toISOString() // Voeg een tijdstempel toe
            };
            try {
                await putData('activitiesData', activity);
                showNotification('Activiteit opgeslagen!', 'success');
                generalActivityForm.reset();
                generalActivityIdInput.value = ''; // Maak verborgen ID leeg
                loadGeneralActivities(); // Herlaad de lijst
            } catch (error) {
                console.error("Fout bij opslaan activiteit:", error);
                showNotification('Fout bij opslaan activiteit.', 'error');
            }
        });
    }

    if (clearGeneralActivityFormBtn) {
        clearGeneralActivityFormBtn.addEventListener('click', () => {
            generalActivityForm.reset();
            generalActivityIdInput.value = '';
            showNotification('Formulier leeggemaakt.', 'info');
        });
    }

    await loadGeneralActivities(); // Laad activiteiten bij initialisatie van de view
}
