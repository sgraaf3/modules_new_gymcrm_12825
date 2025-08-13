// Bestand: js/views/nutritionView.js
// Bevat logica voor het beheren van voedingsprogramma's (CRUD-operaties).

import { getData, putData, deleteData, getAllData } from '../database.js';
import { showNotification } from './notifications.js'; // Importeer notificatiesysteem

export async function initNutritionView() {
    console.log("Voeding View geïnitialiseerd.");

    const nutritionProgramForm = document.getElementById('nutritionProgramForm');
    const nutritionProgramsList = document.getElementById('nutritionProgramsList');
    const programIdInput = document.getElementById('programId');
    const programNameInput = document.getElementById('programName');
    const programDescriptionInput = document.getElementById('programDescription');
    const clearNutritionFormBtn = document.getElementById('clearNutritionFormBtn'); // Corrected ID

    const assignProgramForm = document.getElementById('assignProgramForm');
    const assignMemberSelect = document.getElementById('assignMemberSelect');
    const assignProgramSelect = document.getElementById('assignProgramSelect');
    const assignedProgramsList = document.getElementById('assignedProgramsList');

    const foodLogForm = document.getElementById('foodLogForm');
    const logMemberSelect = document.getElementById('logMemberSelect');
    const logDateInput = document.getElementById('logDate');
    const foodEntryInput = document.getElementById('foodEntry');
    const foodLogsList = document.getElementById('foodLogsList');

    async function populateDropdowns() {
        try {
            const members = await getAllData('registry');
            const programs = await getAllData('nutritionPrograms');

            assignMemberSelect.innerHTML = '<option value="">Selecteer Lid</option>';
            logMemberSelect.innerHTML = '<option value="">Selecteer Lid</option>';
            members.forEach(member => {
                const option1 = document.createElement('option');
                option1.value = member.id;
                option1.textContent = member.name;
                assignMemberSelect.appendChild(option1);

                const option2 = document.createElement('option');
                option2.value = member.id;
                option2.textContent = member.name;
                logMemberSelect.appendChild(option2);
            });

            assignProgramSelect.innerHTML = '<option value="">Selecteer Programma</option>';
            programs.forEach(program => {
                const option = document.createElement('option');
                option.value = program.id;
                option.textContent = program.name;
                assignProgramSelect.appendChild(option);
            });

        } catch (error) {
            console.error("Error populating dropdowns:", error);
            showNotification('Fout bij het laden van selectieopties.', 'error');
        }
    }

    async function loadNutritionPrograms() {
        try {
            const programs = await getAllData('nutritionPrograms');
            nutritionProgramsList.innerHTML = ''; // Maak de bestaande lijst leeg

            if (programs.length === 0) {
                nutritionProgramsList.innerHTML = '<p class="text-gray-400">Geen voedingsprogrammas gevonden.</p>';
                return;
            }

            programs.forEach(program => {
                const programCard = document.createElement('div');
                programCard.className = 'data-card';
                programCard.innerHTML = `
                    <div class="card-header"><h3>Programma: ${program.name}</h3></div>
                    <div class="sub-value">${program.description}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-blue-400 hover:text-blue-300 text-sm mr-2" data-action="edit-program" data-id="${program.id}">Bewerk</button>
                        <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-program" data-id="${program.id}">Verwijder</button>
                    </div>
                `;
                nutritionProgramsList.appendChild(programCard);
            });

            // Voeg event listeners toe voor bewerk/verwijder knoppen
            nutritionProgramsList.querySelectorAll('[data-action="edit-program"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const programId = parseInt(event.target.dataset.id);
                    const program = await getData('nutritionPrograms', programId);
                    if (program) {
                        programIdInput.value = program.id;
                        programNameInput.value = program.name;
                        programDescriptionInput.value = program.description;
                    }
                });
            });

            nutritionProgramsList.querySelectorAll('[data-action="delete-program"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const programId = parseInt(event.target.dataset.id);
                    // Vervang confirm() door een custom modal of notificatie met actie
                    if (confirm('Weet u zeker dat u dit programma wilt verwijderen?')) { // Voor nu nog confirm
                        try {
                            await deleteData('nutritionPrograms', programId);
                            showNotification('Voedingsprogramma verwijderd!', 'success');
                            loadNutritionPrograms(); // Herlaad de lijst
                            populateDropdowns(); // Update dropdowns
                            loadAssignedPrograms(); // Update assigned programs
                        } catch (error) {
                            console.error("Fout bij verwijderen voedingsprogramma:", error);
                            showNotification('Fout bij verwijderen voedingsprogramma.', 'error');
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Fout bij laden voedingsprogramma's:", error);
            showNotification("Fout bij laden voedingsprogramma's.", "error");
        }
    }

    async function loadAssignedPrograms() {
        try {
            const assignedPrograms = await getAllData('assignedNutritionPrograms');
            assignedProgramsList.innerHTML = '';

            if (assignedPrograms.length === 0) {
                assignedProgramsList.innerHTML = '<p class="text-gray-400">Geen toegewezen programmas gevonden.</p>';
                return;
            }

            for (const assigned of assignedPrograms) {
                const member = await getData('registry', assigned.memberId);
                const program = await getData('nutritionPrograms', assigned.programId);

                if (member && program) {
                    const assignedCard = document.createElement('div');
                    assignedCard.className = 'data-card';
                    assignedCard.innerHTML = `
                        <div class="card-header"><h3>${member.name} - ${program.name}</h3></div>
                        <div class="sub-value">Toegewezen op: ${new Date(assigned.assignedDate).toLocaleDateString()}</div>
                        <div class="flex justify-end mt-2">
                            <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-assigned-program" data-id="${assigned.id}">Verwijder</button>
                        </div>
                    `;
                    assignedProgramsList.appendChild(assignedCard);
                }
            }

            assignedProgramsList.querySelectorAll('[data-action="delete-assigned-program"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const assignedId = parseInt(event.target.dataset.id);
                    if (confirm('Weet u zeker dat u deze toewijzing wilt verwijderen?')) {
                        try {
                            await deleteData('assignedNutritionPrograms', assignedId);
                            showNotification('Toewijzing verwijderd!', 'success');
                            loadAssignedPrograms();
                        } catch (error) {
                            console.error("Fout bij verwijderen toewijzing:", error);
                            showNotification('Fout bij verwijderen toewijzing.', 'error');
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Fout bij laden toegewezen programma's:", error);
            showNotification("Fout bij laden toegewezen programma's.", "error");
        }
    }

    async function loadFoodLogs() {
        try {
            const foodLogs = await getAllData('foodLogs');
            foodLogsList.innerHTML = '';

            if (foodLogs.length === 0) {
                foodLogsList.innerHTML = '<p class="text-gray-400">Geen voedingslogs gevonden.</p>';
                return;
            }

            foodLogs.sort((a, b) => new Date(b.logDate) - new Date(a.logDate));

            for (const log of foodLogs) {
                const member = await getData('registry', log.memberId);
                if (member) {
                    const logCard = document.createElement('div');
                    logCard.className = 'data-card';
                    logCard.innerHTML = `
                        <div class="card-header"><h3>${member.name} - ${new Date(log.logDate).toLocaleDateString()}</h3></div>
                        <div class="sub-value">${log.foodEntry}</div>
                        <div class="flex justify-end mt-2">
                            <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-food-log" data-id="${log.id}">Verwijder</button>
                        </div>
                    `;
                    foodLogsList.appendChild(logCard);
                }
            }

            foodLogsList.querySelectorAll('[data-action="delete-food-log"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const logId = parseInt(event.target.dataset.id);
                    if (confirm('Weet u zeker dat u dit voedingslog wilt verwijderen?')) {
                        try {
                            await deleteData('foodLogs', logId);
                            showNotification('Voedingslog verwijderd!', 'success');
                            loadFoodLogs();
                        } catch (error) {
                            console.error("Fout bij verwijderen voedingslog:", error);
                            showNotification('Fout bij verwijderen voedingslog.', 'error');
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Fout bij laden voedingslogs:", error);
            showNotification("Fout bij laden voedingslogs.", "error");
        }
    }

    if (nutritionProgramForm) {
        nutritionProgramForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const program = {
                id: programIdInput.value ? parseInt(programIdInput.value) : undefined, // Gebruik undefined voor autoIncrement
                name: programNameInput.value,
                description: programDescriptionInput.value
            };
            try {
                await putData('nutritionPrograms', program);
                showNotification('Voedingsprogramma opgeslagen!', 'success');
                nutritionProgramForm.reset();
                programIdInput.value = ''; // Maak verborgen ID leeg
                loadNutritionPrograms(); // Herlaad de lijst
                populateDropdowns(); // Update dropdowns
            } catch (error) {
                console.error("Fout bij opslaan voedingsprogramma:", error);
                showNotification('Fout bij opslaan voedingsprogramma.', 'error');
            }
        });
    }

    if (assignProgramForm) {
        assignProgramForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const assignedProgram = {
                memberId: parseInt(assignMemberSelect.value),
                programId: parseInt(assignProgramSelect.value),
                assignedDate: new Date().toISOString().split('T')[0]
            };
            try {
                await putData('assignedNutritionPrograms', assignedProgram);
                showNotification('Programma toegewezen!', 'success');
                assignProgramForm.reset();
                loadAssignedPrograms();
            } catch (error) {
                console.error("Fout bij toewijzen programma:", error);
                showNotification('Fout bij toewijzen programma.', 'error');
            }
        });
    }

    if (foodLogForm) {
        foodLogForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const foodLog = {
                memberId: parseInt(logMemberSelect.value),
                logDate: logDateInput.value,
                foodEntry: foodEntryInput.value
            };
            try {
                await putData('foodLogs', foodLog);
                showNotification('Voedingslog opgeslagen!', 'success');
                foodLogForm.reset();
                loadFoodLogs();
            } catch (error) {
                console.error("Fout bij opslaan voedingslog:", error);
                showNotification('Fout bij opslaan voedingslog.', 'error');
            }
        });
    }

    // Voeg listener toe voor de "Formulier Leegmaken" knop
    if (clearNutritionFormBtn) {
        clearNutritionFormBtn.addEventListener('click', () => {
            nutritionProgramForm.reset();
            programIdInput.value = '';
            showNotification('Formulier leeggemaakt.', 'info');
        });
    }

    await populateDropdowns();
    await loadNutritionPrograms(); // Laad programma's bij initialisatie van de view
    await loadAssignedPrograms();
    await loadFoodLogs();
}
