// Bestand: js/trainerManagementView.js
// Bevat logica voor het beheer van trainers en het toewijzen van leden aan trainers.

import { getAllData, putData, deleteData, getData } from '../database.js';
import { showNotification } from './notifications.js';

let currentTrainerId = null; // Stores the ID of the trainer currently being edited
let allMembers = []; // Cache for all member data
let allTrainers = []; // Cache for all trainer userProfile data

/**
 * Initializes the Trainer Management View.
 */
export async function initTrainerManagementView() {
    console.log("Trainer Beheer View geïnitialiseerd.");

    // DOM Element References
    const trainerSelect = document.getElementById('trainerSelect');
    const trainerEmailInput = document.getElementById('trainerEmail');
    const trainerFirstNameInput = document.getElementById('trainerFirstName');
    const trainerLastNameInput = document.getElementById('trainerLastName');
    const trainerSpecialtiesInput = document.getElementById('trainerSpecialties');
    const trainerBioInput = document.getElementById('trainerBio');
    const saveTrainerBtn = document.getElementById('saveTrainerBtn');
    const deleteTrainerBtn = document.getElementById('deleteTrainerBtn');

    const memberToAssignSelect = document.getElementById('memberToAssignSelect');
    const assignTrainerToMemberSelect = document.getElementById('assignTrainerToMemberSelect');
    const assignMemberBtn = document.getElementById('assignMemberBtn');
    const assignedMembersTableBody = document.getElementById('assignedMembersTableBody');

    // Event Listeners
    trainerSelect.addEventListener('change', loadTrainerForEditing);
    saveTrainerBtn.addEventListener('click', saveTrainer);
    deleteTrainerBtn.addEventListener('click', deleteTrainer);
    assignMemberBtn.addEventListener('click', assignMemberToTrainer);

    // Initial Data Load
    await loadTrainersAndMembers();
    await loadAssignedMembers();

    /**
     * Loads all user profiles (to identify trainers) and member data,
     * then populates the respective dropdowns.
     */
    async function loadTrainersAndMembers() {
        try {
            const users = await getAllData('userProfile');
            const members = await getAllData('memberData');
            const userRoles = await getAllData('userRoles'); // Fetch roles to identify trainers

            allMembers = members; // Cache all members

            // Filter users who have the 'trainer' role
            allTrainers = users.filter(user => 
                userRoles.some(role => role.userId === user.id && role.role === 'trainer')
            );

            // Populate Trainer Select (for editing trainer profiles)
            trainerSelect.innerHTML = '<option value="">-- Nieuwe Trainer --</option>';
            allTrainers.forEach(trainer => {
                const option = document.createElement('option');
                option.value = trainer.id;
                option.textContent = `${trainer.firstName} ${trainer.lastName} (${trainer.email})`;
                trainerSelect.appendChild(option);
            });

            // Populate Member Select (for assigning members)
            memberToAssignSelect.innerHTML = '<option value="">-- Selecteer een lid --</option>';
            allMembers.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = member.name;
                memberToAssignSelect.appendChild(option);
            });

            // Populate Assign Trainer Select (for assigning members)
            assignTrainerToMemberSelect.innerHTML = '<option value="">-- Selecteer een trainer --</option>';
            allTrainers.forEach(trainer => {
                const option = document.createElement('option');
                option.value = trainer.id;
                option.textContent = `${trainer.firstName} ${trainer.lastName}`;
                assignTrainerToMemberSelect.appendChild(option);
            });

        } catch (error) {
            console.error("Fout bij laden trainers en leden:", error);
            showNotification("Fout bij laden trainers en leden.", 'error');
        }
    }

    /**
     * Loads a selected trainer's data into the form for editing.
     */
    async function loadTrainerForEditing() {
        const trainerId = trainerSelect.value;
        if (trainerId) {
            try {
                const trainer = await getData('userProfile', trainerId);
                if (trainer) {
                    currentTrainerId = trainer.id;
                    trainerEmailInput.value = trainer.email || '';
                    trainerFirstNameInput.value = trainer.firstName || '';
                    trainerLastNameInput.value = trainer.lastName || '';
                    trainerSpecialtiesInput.value = trainer.specialties ? trainer.specialties.join(', ') : '';
                    trainerBioInput.value = trainer.bio || '';
                    deleteTrainerBtn.classList.remove('hidden');
                }
            } catch (error) {
                console.error("Fout bij laden trainer voor bewerking:", error);
                showNotification("Fout bij laden trainergegevens.", 'error');
            }
        } else {
            // Reset form for new trainer
            currentTrainerId = null;
            trainerEmailInput.value = '';
            trainerFirstNameInput.value = '';
            trainerLastNameInput.value = '';
            trainerSpecialtiesInput.value = '';
            trainerBioInput.value = '';
            deleteTrainerBtn.classList.add('hidden');
        }
    }

    /**
     * Saves (adds or updates) a trainer's profile and sets their role.
     */
    async function saveTrainer() {
        const email = trainerEmailInput.value.trim();
        const firstName = trainerFirstNameInput.value.trim();
        const lastName = trainerLastNameInput.value.trim();
        const specialties = trainerSpecialtiesInput.value.split(',').map(s => s.trim()).filter(s => s !== '');
        const bio = trainerBioInput.value.trim();

        if (!email || !firstName || !lastName) {
            showNotification("E-mail, voornaam en achternaam zijn verplicht.", 'warning');
            return;
        }

        try {
            let trainerData = {
                email,
                firstName,
                lastName,
                specialties,
                bio,
                // Add default password for new trainers if no auth system, or handle securely.
                // For IndexedDB, this is highly insecure. In a real app, this would be handled by a backend.
                // For now, we assume a simple placeholder or external password management.
            };

            if (currentTrainerId) {
                // Update existing trainer
                trainerData.id = currentTrainerId;
                await putData('userProfile', trainerData);
                showNotification(`Trainer ${firstName} ${lastName} succesvol bijgewerkt!`, 'success');
            } else {
                // Add new trainer
                // Generate a new ID if not auto-incremented by IndexedDB for userProfile
                // Assuming userProfile uses autoIncrement: true, so ID will be assigned on put.
                const newTrainerId = await putData('userProfile', trainerData);
                await putData('userRoles', { userId: newTrainerId, role: 'trainer' }); // Assign 'trainer' role
                showNotification(`Trainer ${firstName} ${lastName} succesvol toegevoegd!`, 'success');
            }

            // Refresh data
            await loadTrainersAndMembers();
            await loadAssignedMembers();
            // Reset form
            trainerSelect.value = '';
            loadTrainerForEditing(); // Clears the form
        } catch (error) {
            console.error("Fout bij opslaan trainer:", error);
            showNotification(`Fout bij opslaan trainer: ${error.message}`, 'error');
        }
    }

    /**
     * Deletes a trainer's profile and unassigns members.
     */
    async function deleteTrainer() {
        if (!currentTrainerId) {
            showNotification("Geen trainer geselecteerd om te verwijderen.", 'warning');
            return;
        }

        if (!confirm("Weet u zeker dat u deze trainer wilt verwijderen? Leden worden dan losgekoppeld.")) { // Replace with custom modal later
            return;
        }

        try {
            await deleteData('userProfile', currentTrainerId);
            await deleteData('userRoles', currentTrainerId); // Remove trainer role

            // Unassign members from this trainer
            const membersAssignedToTrainer = allMembers.filter(member => member.trainerId === currentTrainerId);
            for (const member of membersAssignedToTrainer) {
                member.trainerId = null; // Set trainerId to null
                await putData('memberData', member);
            }

            showNotification("Trainer succesvol verwijderd en leden losgekoppeld.", 'info');

            // Refresh data and reset form
            await loadTrainersAndMembers();
            await loadAssignedMembers();
            trainerSelect.value = '';
            loadTrainerForEditing(); // Clears the form
        } catch (error) {
            console.error("Fout bij verwijderen trainer:", error);
            showNotification(`Fout bij verwijderen trainer: ${error.message}`, 'error');
        }
    }

    /**
     * Assigns a selected member to a selected trainer.
     */
    async function assignMemberToTrainer() {
        const memberId = memberToAssignSelect.value;
        const trainerId = assignTrainerToMemberSelect.value;

        if (!memberId || !trainerId) {
            showNotification("Selecteer zowel een lid als een trainer.", 'warning');
            return;
        }

        try {
            const member = await getData('memberData', parseInt(memberId));
            if (member) {
                member.trainerId = parseInt(trainerId); // Assign trainerId to member
                await putData('memberData', member);
                showNotification(`Lid ${member.name} succesvol toegewezen!`, 'success');
                await loadAssignedMembers(); // Refresh the assigned members table
            } else {
                showNotification("Lid niet gevonden.", 'error');
            }
        } catch (error) {
            console.error("Fout bij toewijzen lid:", error);
            showNotification(`Fout bij toewijzen lid: ${error.message}`, 'error');
        }
    }

    /**
     * Loads and displays which members are assigned to which trainers.
     */
    async function loadAssignedMembers() {
        assignedMembersTableBody.innerHTML = '';
        const members = await getAllData('memberData'); // Get fresh member data
        const trainers = await getAllData('userProfile'); // Get fresh trainer data (user profiles)
        const userRoles = await getAllData('userRoles');

        // Map trainer IDs to their names
        const trainerNames = new Map();
        trainers.forEach(trainer => {
            if (userRoles.some(role => role.userId === trainer.id && role.role === 'trainer')) {
                trainerNames.set(trainer.id, `${trainer.firstName} ${trainer.lastName}`);
            }
        });

        const assignments = new Map(); // Map to store trainerId -> [memberNames]

        members.forEach(member => {
            const assignedTrainerId = member.trainerId;
            if (assignedTrainerId) {
                const trainerName = trainerNames.get(assignedTrainerId) || 'Onbekend';
                if (!assignments.has(trainerName)) {
                    assignments.set(trainerName, []);
                }
                assignments.get(trainerName).push({ id: member.id, name: member.name });
            }
        });

        if (assignments.size === 0) {
            assignedMembersTableBody.innerHTML = '<tr><td colspan="2" class="py-3 px-6 text-center">Geen leden toegewezen aan trainers.</td></tr>';
            return;
        }

        assignments.forEach((memberList, trainerName) => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-800 hover:bg-gray-800';
            row.innerHTML = `
                <td class="py-3 px-6 text-left">${trainerName}</td>
                <td class="py-3 px-6 text-left">
                    ${memberList.map(member => `
                        <span class="inline-flex items-center bg-blue-700 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full mr-2 mb-1">
                            ${member.name}
                            <button class="ml-1 text-red-300 hover:text-red-100" data-action="unassign" data-member-id="${member.id}" data-trainer-id="${trainerName}">
                                &times;
                            </button>
                        </span>
                    `).join('')}
                </td>
            `;
            assignedMembersTableBody.appendChild(row);
        });

        // Add event listeners for unassign buttons
        assignedMembersTableBody.querySelectorAll('[data-action="unassign"]').forEach(button => {
            button.addEventListener('click', async (event) => {
                const memberId = parseInt(event.target.dataset.memberId);
                if (confirm(`Weet u zeker dat u dit lid wilt loskoppelen van de trainer?`)) { // Replace with custom modal
                    try {
                        const member = await getData('memberData', memberId);
                        if (member) {
                            member.trainerId = null; // Unassign
                            await putData('memberData', member);
                            showNotification(`Lid ${member.name} losgekoppeld.`, 'info');
                            await loadAssignedMembers(); // Refresh table
                        }
                    } catch (error) {
                        console.error("Fout bij loskoppelen lid:", error);
                        showNotification("Fout bij loskoppelen lid.", 'error');
                    }
                }
            });
        });
    }
}
