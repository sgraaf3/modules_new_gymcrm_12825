// Bestand: js/gymSectionsView.js
// Bevat logica voor het beheren van gymsecties.

import { getData, putData, deleteData, getAllData } from '../database.js';
import { showNotification } from './notifications.js';

export async function initGymSectionsView() {
    console.log("Gymsecties Beheer View geïnitialiseerd.");

    const gymSectionsList = document.getElementById('gymSectionsList');
    const gymSectionForm = document.getElementById('gymSectionForm');
    const gymSectionIdInput = document.getElementById('gymSectionId');
    const gymSectionNameInput = document.getElementById('gymSectionName');
    const gymSectionManagerInput = document.getElementById('gymSectionManager');
    const clearGymSectionFormBtn = document.getElementById('clearGymSectionFormBtn');

    async function populateManagers() {
        // TODO: Dynamisch laden van managers uit de user store met de juiste rol
        const managers = [
            { id: 'user1', name: 'Jan Jansen' },
            { id: 'user2', name: 'Piet Pietersen' },
            { id: 'user3', name: 'Klaas Klaassen' },
        ];

        gymSectionManagerInput.innerHTML = '<option value="">Selecteer een manager</option>';
        managers.forEach(manager => {
            const option = document.createElement('option');
            option.value = manager.id;
            option.textContent = manager.name;
            gymSectionManagerInput.appendChild(option);
        });
    }

    async function loadGymSections() {
        try {
            const sections = await getAllData('gymSections');
            gymSectionsList.innerHTML = ''; // Maak de bestaande lijst leeg

            if (sections.length === 0) {
                gymSectionsList.innerHTML = '<p class="text-gray-400">Geen gymsecties gevonden.</p>';
                return;
            }

            // TODO: Haal manager namen op basis van managerId
            const managers = {
                'user1': 'Jan Jansen',
                'user2': 'Piet Pietersen',
                'user3': 'Klaas Klaassen',
            };

            sections.forEach(section => {
                const sectionCard = document.createElement('div');
                sectionCard.className = 'data-card bg-gray-800 p-4 rounded-lg flex justify-between items-center';
                sectionCard.innerHTML = `
                    <div>
                        <h3 class="text-lg font-bold text-white">${section.name}</h3>
                        <p class="text-gray-400">Manager: ${managers[section.managerId] || 'Niet toegewezen'}</p>
                    </div>
                    <div class="flex items-center">
                        <button class="text-blue-400 hover:text-blue-300 text-sm mr-4" data-action="edit-section" data-id="${section.id}">Bewerk</button>
                        <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-section" data-id="${section.id}">Verwijder</button>
                    </div>
                `;
                gymSectionsList.appendChild(sectionCard);
            });

            // Voeg event listeners toe voor bewerk/verwijder knoppen
            gymSectionsList.querySelectorAll('[data-action="edit-section"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const sectionId = parseInt(event.target.dataset.id);
                    const section = await getData('gymSections', sectionId);
                    if (section) {
                        gymSectionIdInput.value = section.id;
                        gymSectionNameInput.value = section.name;
                        gymSectionManagerInput.value = section.managerId;
                    }
                });
            });

            gymSectionsList.querySelectorAll('[data-action="delete-section"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const sectionId = parseInt(event.target.dataset.id);
                    if (confirm('Weet u zeker dat u deze gymsectie wilt verwijderen?')) {
                        try {
                            await deleteData('gymSections', sectionId);
                            showNotification('Gymsectie verwijderd!', 'success');
                            loadGymSections(); // Herlaad de lijst
                        } catch (error) {
                            console.error("Fout bij verwijderen gymsectie:", error);
                            showNotification('Fout bij verwijderen gymsectie.', 'error');
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Fout bij laden gymsecties:", error);
            showNotification("Fout bij laden gymsecties.", "error");
        }
    }

    if (gymSectionForm) {
        gymSectionForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const sectionData = {
                name: gymSectionNameInput.value,
                managerId: gymSectionManagerInput.value
            };

            const sectionId = gymSectionIdInput.value;
            if (sectionId) {
                sectionData.id = parseInt(sectionId, 10);
            }

            try {
                await putData('gymSections', sectionData);
                showNotification('Gymsectie opgeslagen!', 'success');
                gymSectionForm.reset();
                gymSectionIdInput.value = ''; // Maak verborgen ID leeg
                loadGymSections(); // Herlaad de lijst
            } catch (error) {
                console.error("Fout bij opslaan gymsectie:", error);
                showNotification('Fout bij opslaan gymsectie.', 'error');
            }
        });
    }

    if (clearGymSectionFormBtn) {
        clearGymSectionFormBtn.addEventListener('click', () => {
            gymSectionForm.reset();
            gymSectionIdInput.value = '';
            showNotification('Formulier leeggemaakt.', 'info');
        });
    }

    populateManagers();
    loadGymSections();
}
