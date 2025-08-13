// Bestand: js/measurementSelectionView.js
// Deze module beheert de weergave voor het selecteren van het type meting (rust of training).

import { showNotification } from './notifications.js';

export function initMeasurementSelectionView(showViewCallback) {
    console.log("Meting Selectie View geïnitialiseerd.");

    const startRestMeasurementBtn = document.getElementById('startRestMeasurementBtn');
    const startTrainingMeasurementBtn = document.getElementById('startTrainingMeasurementBtn');

    if (startRestMeasurementBtn) {
        startRestMeasurementBtn.addEventListener('click', () => {
            // Roep de showView callback aan om naar de restmeting weergave te navigeren
            // en geef het type meting mee.
            showViewCallback('restMeasurementLiveView', { type: 'rest' });
            showNotification('Rustmeting gestart!', 'info');
        });
    }

    if (startTrainingMeasurementBtn) {
        startTrainingMeasurementBtn.addEventListener('click', () => {
            // Roep de showView callback aan om naar de training meting weergave te navigeren
            // en geef het type meting mee.
            showViewCallback('liveTrainingView', { type: 'training' });
            showNotification('Trainingsmeting gestart!', 'info');
        });
    }
}
