// Bestand: js/views/actionCenterView.js
// Bevat logica voor het uitvoeren van globale acties zoals gebruikersbeheer en notificaties.

import { putData, deleteData, setUserRole, getAllData, getData, getOrCreateUserId } from '../database.js';
import { showNotification } from './notifications.js'; // Importeer notificatiesysteem

export async function initActionCenterView() {
    console.log("Actie Centrum View geïnitialiseerd.");

    const changeUserBtn = document.getElementById('changeUserBtn');
    const inviteUserBtn = document.getElementById('inviteUserBtn');
    const removeUserBtn = document.getElementById('removeUserBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const sendPopupNotificationBtn = document.getElementById('sendPopupNotificationBtn');

    const openTasksCountDisplay = document.getElementById('openTasksCount');
    const newMessagesCountDisplay = document.getElementById('newMessagesCount');
    const openTasksList = document.getElementById('openTasksList');
    const importantMessagesList = document.getElementById('importantMessagesList');

    const currentUserId = getOrCreateUserId(); // Get current user ID

    /**
     * Laadt en toont openstaande taken en belangrijke meldingen.
     */
    async function loadActionCenterData() {
        try {
            const actionCenterData = await getAllData('actionCenterData');
            const tasks = actionCenterData.filter(item => item.type === 'task');
            const messages = actionCenterData.filter(item => item.type === 'message');

            if (openTasksCountDisplay) openTasksCountDisplay.textContent = tasks.length;
            if (newMessagesCountDisplay) newMessagesCountDisplay.textContent = messages.length;

            // Display Open Tasks
            openTasksList.innerHTML = '';
            if (tasks.length === 0) {
                openTasksList.innerHTML = '<p class="text-gray-400">Geen openstaande taken.</p>';
            } else {
                tasks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by newest first
                tasks.forEach(task => {
                    const taskCard = document.createElement('div');
                    taskCard.className = 'data-card';
                    taskCard.innerHTML = `
                        <div class="card-header"><h3>${task.title}</h3></div>
                        <div class="sub-value">${task.description || 'Geen beschrijving'}</div>
                        <div class="flex justify-end mt-2">
                            <button class="text-green-400 hover:text-green-300 text-sm mr-2" data-action="complete-task" data-id="${task.id}">Voltooi</button>
                            <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-task" data-id="${task.id}">Verwijder</button>
                        </div>
                    `;
                    openTasksList.appendChild(taskCard);
                });
            }

            // Display Important Messages
            importantMessagesList.innerHTML = '';
            if (messages.length === 0) {
                importantMessagesList.innerHTML = '<p class="text-gray-400">Geen belangrijke meldingen.</p>';
            } else {
                messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by newest first
                messages.forEach(message => {
                    const messageCard = document.createElement('div');
                    messageCard.className = 'data-card';
                    messageCard.innerHTML = `
                        <div class="card-header"><h3>${message.title}</h3></div>
                        <div class="sub-value">${message.content || 'Geen inhoud'}</div>
                        <div class="flex justify-end mt-2">
                            <button class="text-green-400 hover:text-green-300 text-sm mr-2" data-action="mark-read" data-id="${message.id}">Markeer als gelezen</button>
                            <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-message" data-id="${message.id}">Verwijder</button>
                        </div>
                    `;
                    importantMessagesList.appendChild(messageCard);
                });
            }

            // Add event listeners for dynamically loaded buttons
            openTasksList.querySelectorAll('[data-action="complete-task"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const taskId = parseInt(event.target.dataset.id);
                    // For now using confirm, ideally replaced by custom modal
                    if (confirm('Taak voltooien?')) {
                        try {
                            await deleteData('actionCenterData', taskId);
                            showNotification('Taak voltooid!', 'success');
                            loadActionCenterData(); // Reload data
                        } catch (error) {
                            console.error("Fout bij voltooien taak:", error);
                            showNotification('Fout bij voltooien taak.', 'error');
                        }
                    }
                });
            });
            openTasksList.querySelectorAll('[data-action="delete-task"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const taskId = parseInt(event.target.dataset.id);
                    if (confirm('Taak verwijderen?')) {
                        try {
                            await deleteData('actionCenterData', taskId);
                            showNotification('Taak verwijderd!', 'success');
                            loadActionCenterData(); // Reload data
                        } catch (error) {
                            console.error("Fout bij verwijderen taak:", error);
                            showNotification('Fout bij verwijderen taak.', 'error');
                        }
                    }
                });
            });
            importantMessagesList.querySelectorAll('[data-action="mark-read"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const messageId = parseInt(event.target.dataset.id);
                    if (confirm('Melding markeren als gelezen?')) {
                        try {
                            await deleteData('actionCenterData', messageId);
                            showNotification('Melding gemarkeerd als gelezen!', 'success');
                            loadActionCenterData(); // Reload data
                        } catch (error) {
                            console.error("Fout bij markeren melding als gelezen:", error);
                            showNotification('Fout bij markeren melding als gelezen.', 'error');
                        }
                    }
                });
            });
            importantMessagesList.querySelectorAll('[data-action="delete-message"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const messageId = parseInt(event.target.dataset.id);
                    if (confirm('Melding verwijderen?')) {
                        try {
                            await deleteData('actionCenterData', messageId);
                            showNotification('Melding verwijderd!', 'success');
                            loadActionCenterData(); // Reload data
                        } catch (error) {
                            console.error("Fout bij verwijderen melding:", error);
                            showNotification('Fout bij verwijderen melding.', 'error');
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Fout bij laden actiecentrum data:", error);
            showNotification("Fout bij laden actiecentrum data.", "error");
        }
    }

    // Event listeners for user management and notifications
    if (changeUserBtn) {
        changeUserBtn.addEventListener('click', () => {
            const newUserId = prompt("Voer de ID van de gebruiker in:");
            if (newUserId) {
                localStorage.setItem('appUserId', newUserId);
                showNotification(`Gebruiker gewijzigd naar ${newUserId}. Pagina wordt herladen.`, 'info');
                setTimeout(() => location.reload(), 1000); // Reload page to apply user change
            } else {
                showNotification('Geen gebruiker ID ingevoerd.', 'warning');
            }
        });
    }

    if (inviteUserBtn) {
        inviteUserBtn.addEventListener('click', async () => {
            const inviteUserId = prompt("Voer de ID van de nieuwe gebruiker in:");
            const inviteUserName = prompt("Voer de naam van de nieuwe gebruiker in:");
            const inviteUserRole = prompt("Voer de rol voor de nieuwe gebruiker in (bijv. member, admin, trainer):");
            if (inviteUserId && inviteUserName && inviteUserRole) {
                try {
                    // Create a basic profile in 'registry' and set their role
                    await putData('registry', { id: parseInt(inviteUserId), name: inviteUserName, email: `user${inviteUserId}@example.com`, status: 'Active', joinDate: new Date().toISOString().split('T')[0] });
                    await setUserRole(parseInt(inviteUserId), inviteUserRole);
                    showNotification(`Gebruiker ${inviteUserName} (ID: ${inviteUserId}) met rol ${inviteUserRole} uitgenodigd!`, 'success');
                } catch (error) {
                    console.error("Fout bij uitnodigen gebruiker:", error);
                    showNotification('Fout bij uitnodigen gebruiker.', 'error');
                }
            } else {
                showNotification("Ongeldige invoer voor gebruiker uitnodigen. Naam, ID en rol zijn verplicht.", 'warning');
            }
        });
    }

    if (removeUserBtn) {
        removeUserBtn.addEventListener('click', async () => {
            const removeUserId = prompt("Voer de ID van de gebruiker die u wilt verwijderen in:");
            if (removeUserId) {
                if (confirm(`Weet u zeker dat u gebruiker ${removeUserId} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
                    try {
                        await deleteData('registry', parseInt(removeUserId)); // Remove from registry
                        await deleteData('userRoles', parseInt(removeUserId)); // Remove role
                        // Optionally, delete other user-specific data (e.g., userProfile, trainingSessions, etc.)
                        showNotification(`Gebruiker ${removeUserId} verwijderd.`, 'success');
                    } catch (error) {
                        console.error("Fout bij verwijderen gebruiker:", error);
                        showNotification('Fout bij verwijderen gebruiker.', 'error');
                    }
                }
            } else {
                showNotification("Geen gebruiker ID ingevoerd.", 'warning');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('appUserId');
            showNotification('U bent uitgelogd. Pagina wordt herladen.', 'info');
            setTimeout(() => location.reload(), 1000); // Reload page after logout
        });
    }

    if (sendPopupNotificationBtn) {
        sendPopupNotificationBtn.addEventListener('click', async () => {
            const notificationTitle = prompt("Voer de titel voor de pop-upmelding in:");
            const notificationMessage = prompt("Voer het bericht voor de pop-upmelding in:");
            if (notificationTitle && notificationMessage) {
                // Add a new message to the actionCenterData store
                const newMessage = {
                    type: 'message',
                    title: notificationTitle,
                    content: notificationMessage,
                    timestamp: new Date().toISOString()
                };
                try {
                    await putData('actionCenterData', newMessage);
                    showNotification(`Melding verzonden: "${notificationTitle}"`, 'info');
                    loadActionCenterData(); // Reload data to show the new message
                } catch (error) {
                    console.error("Fout bij verzenden pop-up melding:", error);
                    showNotification('Fout bij verzenden pop-up melding.', 'error');
                }
            } else {
                showNotification("Titel en bericht zijn verplicht voor de melding.", 'warning');
            }
        });
    }

    // Initial load of action center data when the view is initialized
    await loadActionCenterData();
}
