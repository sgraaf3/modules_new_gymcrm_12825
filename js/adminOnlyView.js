// Bestand: js/views/adminOnlyView.js
// Bevat logica voor de beheerderspagina.

import { getData, putData } from '../database.js';
import { showNotification } from './notifications.js'; // Importeer notificatiesysteem

export function initAdminOnlyView() {
    console.log("Admin Only View geïnitialiseerd.");
    // Logica voor het weergeven van beheerdersspecifieke data.
    const accessSecretDbBtn = document.getElementById('accessSecretDbBtn');
    const secretDataDisplay = document.getElementById('secretDataDisplay');

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
}
