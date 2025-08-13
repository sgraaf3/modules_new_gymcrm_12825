// Bestand: js/views/adminOnlyView.js
// Bevat logica voor de beheerderspagina.

import { getData, putData, getAllData, deleteData } from '../database.js'; // Added getAllData, deleteData
import { showNotification } from './notifications.js'; // Importeer notificatiesysteem

export async function initAdminOnlyView() { // Made async
    console.log("Admin Only View geïnitialiseerd.");
    
    // DOM Element References for Secret Data (existing)
    const accessSecretDbBtn = document.getElementById('accessSecretDbBtn');
    const secretDataDisplay = document.getElementById('secretDataDisplay');

    // DOM Element References for User Role Management (NEW)
    const userRolesTableBody = document.getElementById('userRolesTableBody');
    const userSelectForRole = document.getElementById('userSelectForRole');
    const roleSelectForUser = document.getElementById('roleSelectForUser');
    const assignRoleBtn = document.getElementById('assignRoleBtn');
    const deleteUserBtn = document.getElementById('deleteUserBtn'); // For deleting user profiles

    // Event Listeners (existing)
    if (accessSecretDbBtn) {
        accessSecretDbBtn.addEventListener('click', async () => {
            const secretId = 'adminSecret'; // Vaste ID voor admin secret
            try {
                let secretData = await getData('adminSecretData', secretId);
                if (!secretData) {
                    secretData = { id: secretId, value: 'This is a highly confidential admin secret from IndexedDB!' };
                    await putData('adminSecretData', secretData);
                    showNotification('Geheime data gegenereerd en opgeslagen.', 'info');
                }
                secretDataDisplay.textContent = JSON.stringify(secretData, null, 2);
                showNotification('Geheime data geladen!', 'success');
            } catch (error) {
                console.error("Fout bij toegang geheime data:", error);
                showNotification('Fout bij toegang geheime data.', 'error');
            }
        });
    }

    // Event Listeners for User Role Management (NEW)
    if (assignRoleBtn) {
        assignRoleBtn.addEventListener('click', assignUserRole);
    }
    if (userSelectForRole) {
        userSelectForRole.addEventListener('change', () => {
            // Pre-fill roleSelectForUser if a user is selected
            const selectedUserId = userSelectForRole.value;
            const selectedUser = allUsersWithRoles.find(u => u.id === selectedUserId);
            if (selectedUser && roleSelectForUser) {
                roleSelectForUser.value = selectedUser.role;
            }
            if (selectedUserId && deleteUserBtn) {
                deleteUserBtn.classList.remove('hidden');
            } else if (deleteUserBtn) {
                deleteUserBtn.classList.add('hidden');
            }
        });
    }
    if (deleteUserBtn) {
        deleteUserBtn.addEventListener('click', deleteUserAccount);
    }

    // Initial Load for User Role Management
    await loadUserRoles();

    let allUsersWithRoles = []; // Cache to store users with their roles

    /**
     * Loads all user profiles and their assigned roles, then populates the table and dropdown.
     */
    async function loadUserRoles() {
        userRolesTableBody.innerHTML = '<tr><td colspan="4" class="py-3 px-6 text-center">Laden gebruikers...</td></tr>';
        userSelectForRole.innerHTML = '<option value="">-- Selecteer een gebruiker --</option>';

        try {
            const users = await getAllData('userProfile');
            const roles = await getAllData('userRoles'); // Fetch roles from userRoles store

            allUsersWithRoles = users.map(user => {
                const userRoleEntry = roles.find(role => role.userId === user.id);
                return {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: userRoleEntry ? userRoleEntry.role : 'member' // Default to 'member' if no role found
                };
            });

            userRolesTableBody.innerHTML = ''; // Clear loading message

            if (allUsersWithRoles.length === 0) {
                userRolesTableBody.innerHTML = '<tr><td colspan="4" class="py-3 px-6 text-center">Geen gebruikers gevonden.</td></tr>';
                return;
            }

            allUsersWithRoles.forEach(user => {
                const row = document.createElement('tr');
                row.className = 'border-b border-gray-800 hover:bg-gray-800';
                row.innerHTML = `
                    <td class="py-3 px-6 text-left">${user.firstName} ${user.lastName}</td>
                    <td class="py-3 px-6 text-left">${user.email}</td>
                    <td class="py-3 px-6 text-left">${user.role.toUpperCase()}</td>
                    <td class="py-3 px-6 text-center">
                        <button class="table-action-button bg-blue-600 hover:bg-blue-700" data-user-id="${user.id}" data-action="edit-role">Bewerk Rol</button>
                    </td>
                `;
                userRolesTableBody.appendChild(row);

                // Populate user select dropdown
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.firstName} ${user.lastName} (${user.email})`;
                userSelectForRole.appendChild(option);
            });

            // Add event listeners for "Bewerk Rol" buttons
            userRolesTableBody.querySelectorAll('[data-action="edit-role"]').forEach(button => {
                button.addEventListener('click', (event) => {
                    const userId = event.target.dataset.userId;
                    userSelectForRole.value = userId; // Select user in dropdown
                    const selectedUser = allUsersWithRoles.find(u => u.id === userId);
                    if (selectedUser && roleSelectForUser) {
                        roleSelectForUser.value = selectedUser.role; // Pre-fill role dropdown
                    }
                    if (deleteUserBtn) deleteUserBtn.classList.remove('hidden'); // Show delete button
                });
            });

        } catch (error) {
            console.error("Fout bij laden gebruikersrollen:", error);
            showNotification("Fout bij laden gebruikersrollen.", 'error');
            userRolesTableBody.innerHTML = '<tr><td colspan="4" class="py-3 px-6 text-center text-red-400">Fout bij laden gebruikers.</td></tr>';
        }
    }

    /**
     * Assigns a selected role to a selected user.
     */
    async function assignUserRole() {
        const userId = userSelectForRole.value;
        const role = roleSelectForUser.value;

        if (!userId || !role) {
            showNotification("Selecteer een gebruiker en een rol.", 'warning');
            return;
        }

        try {
            await putData('userRoles', { userId: userId, role: role });
            showNotification(`Rol '${role.toUpperCase()}' succesvol toegewezen aan gebruiker.`, 'success');
            await loadUserRoles(); // Refresh the table
            userSelectForRole.value = ''; // Reset dropdowns
            roleSelectForUser.value = 'member';
            if (deleteUserBtn) deleteUserBtn.classList.add('hidden');
        } catch (error) {
            console.error("Fout bij toewijzen rol:", error);
            showNotification(`Fout bij toewijzen rol: ${error.message}`, 'error');
        }
    }

    /**
     * Deletes a user account (userProfile and userRoles entry).
     */
    async function deleteUserAccount() {
        const userId = userSelectForRole.value;
        if (!userId) {
            showNotification("Geen gebruiker geselecteerd om te verwijderen.", 'warning');
            return;
        }

        const userToDelete = allUsersWithRoles.find(u => u.id === userId);
        if (!userToDelete) {
            showNotification("Gebruiker niet gevonden.", 'error');
            return;
        }

        if (!confirm(`Weet u zeker dat u gebruiker ${userToDelete.firstName} ${userToDelete.lastName} (${userToDelete.email}) wilt verwijderen? Dit kan niet ongedaan gemaakt worden!`)) {
            return;
        }

        try {
            await deleteData('userProfile', userId);
            await deleteData('userRoles', userId); // Delete their role entry
            // You might also want to delete all data related to this user from other stores
            // This would require iterating through all relevant stores (e.g., trainingSessions, memberData, etc.)
            // For simplicity, this is omitted but crucial for a complete deletion.
            
            showNotification(`Gebruiker ${userToDelete.email} succesvol verwijderd.`, 'info');
            await loadUserRoles(); // Refresh the table
            userSelectForRole.value = ''; // Reset dropdowns
            roleSelectForUser.value = 'member';
            if (deleteUserBtn) deleteUserBtn.classList.add('hidden');
        } catch (error) {
            console.error("Fout bij verwijderen gebruiker:", error);
            showNotification(`Fout bij verwijderen gebruiker: ${error.message}`, 'error');
        }
    }
}
