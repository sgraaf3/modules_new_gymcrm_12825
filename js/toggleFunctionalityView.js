// Bestand: js/views/toggleFunctionalityView.js
// Bevat logica voor het schakelen van functionaliteiten.

import { getData, putData } from '../database.js';
import { showNotification } from './notifications.js'; // Importeer notificatiesysteem

export function initToggleFunctionalityView() {
    console.log("Functionaliteit Schakelen View geïnitialiseerd.");
    // Logica voor het beheren van de zichtbaarheid van modules.
    const enableTrainingModule = document.getElementById('enableTrainingModule');
    const enableNutritionModule = document.getElementById('enableNutritionModule');
    const enableReportsModule = document.getElementById('enableReportsModule');
    const saveToggleSettingsBtn = document.getElementById('saveToggleSettingsBtn');
    const toggleSettingsId = 'appToggleSettings'; // Vaste ID voor de instellingen

    /**
     * Laadt de toggle-instellingen uit de database en past de UI aan.
     */
    async function loadToggleSettings() {
        try {
            const settings = await getData('toggleSettings', toggleSettingsId);
            if (settings) {
                enableTrainingModule.checked = settings.enableTrainingModule || false;
                enableNutritionModule.checked = settings.enableNutritionModule || false;
                enableReportsModule.checked = settings.enableReportsModule || false;
            }
        } catch (error) {
            console.error("Fout bij laden toggle instellingen:", error);
            showNotification('Fout bij laden instellingen.', 'error');
        }
    }

    // Event listener voor het opslaan van de instellingen
    if (saveToggleSettingsBtn) {
        saveToggleSettingsBtn.addEventListener('click', async () => {
            const settings = {
                id: toggleSettingsId,
                enableTrainingModule: enableTrainingModule.checked,
                enableNutritionModule: enableNutritionModule.checked,
                enableReportsModule: enableReportsModule.checked,
            };
            try {
                await putData('toggleSettings', settings); // Sla instellingen op in de 'toggleSettings' store
                showNotification('Instellingen opgeslagen!', 'success');
            } catch (error) {
                console.error("Fout bij opslaan toggle instellingen:", error);
                showNotification('Fout bij opslaan instellingen.', 'error');
            }
        });
    }

    // Initial load of settings when the view is initialized
    loadToggleSettings();
}
