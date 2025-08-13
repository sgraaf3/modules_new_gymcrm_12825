// Bestand: js/views/memberSettingsView.js
// Bevat logica voor het beheren van lid-specifieke instellingen.

import { getData, putData, getOrCreateUserId, getUserRole, setUserRole } from '../database.js';
import { showNotification } from './notifications.js';

export async function initMemberSettingsView(showView, data) {
    const userId = data && data.userId ? data.userId : getOrCreateUserId();
    console.log(`Lid Instellingen View geïnitialiseerd voor gebruiker ${userId}.`);

    const memberSettingsForm = document.getElementById('memberSettingsForm');
    const saveMemberSettingsBtn = document.getElementById('saveMemberSettingsBtn');
    const memberSettingsTitle = document.getElementById('member-settings-title');

    const maxHrInput = document.getElementById('maxHr');
    const thresholdHrInput = document.getElementById('thresholdHr');
    const memberRoleSelect = document.getElementById('memberRole');

    async function loadMemberSettings() {
        try {
            const settings = await getData('memberSettings', userId);
            const user = await getData('registry', userId);
            if (user) {
                memberSettingsTitle.textContent = `Instellingen voor ${user.name}`;
            }

            if (settings) {
                for (const key in settings) {
                    const input = document.getElementById(key);
                    if (input) {
                        if (input.type === 'checkbox') {
                            input.checked = settings[key];
                        } else {
                            input.value = settings[key];
                        }
                    }
                }
            }
            // Load user role separately
            memberRoleSelect.value = await getUserRole(userId);

        } catch (error) {
            console.error("Error loading member settings:", error);
            showNotification('Fout bij laden lidinstellingen.', 'error');
        }
    }

    if (memberSettingsForm) {
        saveMemberSettingsBtn.addEventListener('click', async () => {
            const settingsData = { id: userId };
            memberSettingsForm.querySelectorAll('input, select, textarea').forEach(input => {
                if (input.id !== 'memberRole') { // Exclude memberRole from general settings
                    if (input.type === 'checkbox') {
                        settingsData[input.id] = input.checked;
                    } else {
                        settingsData[input.id] = input.value;
                    }
                }
            });

            try {
                await putData('memberSettings', settingsData);
                await setUserRole(userId, memberRoleSelect.value); // Save user role separately
                showNotification('Lidinstellingen opgeslagen!', 'success');
            } catch (error) {
                console.error("Error saving member settings:", error);
                showNotification('Fout bij opslaan lidinstellingen.', 'error');
            }
        });
    }

    await loadMemberSettings();
}
