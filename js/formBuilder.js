// Bestand: formBuilder.js
import { showMessage } from './viewRenderer.js';
import { generateUniqueId } from './scheduleDataManager.js';


export function setupFormBuilder() {
    const customTrainingZonesDropZone = document.getElementById('custom-training-zones-drop-zone');
    const saveCustomTrainingBtn = document.getElementById('save-custom-training-btn');
    const customTrainingNameInput = document.getElementById('custom-training-name');
    const saveCustomRestBtn = document.getElementById('save-custom-rest-btn');
    const customRestNameInput = document.getElementById('custom-rest-name');
    const customRestDescriptionInput = document.getElementById('custom-rest-description');
    const customRestGoalsInput = document.getElementById('custom-rest-goals');

    saveCustomTrainingBtn.addEventListener('click', () => {
        const trainingName = customTrainingNameInput.value.trim();
        if (!trainingName) {
            showMessage('Geef de aangepaste training een naam.', 'error');
            return;
        }
        const definition = [];
        let hasError = false;
        customTrainingZonesDropZone.querySelectorAll('.dropped-item').forEach(item => {
            const durationInput = item.querySelector('[data-duration-input]');
            const duration = parseInt(durationInput.value);
            if (isNaN(duration) || duration <= 0) {
                hasError = true;
                showMessage('Vul een geldige duur (in minuten) in voor alle HR zones in de training.', 'error');
                return;
            }
            definition.push({
                type: item.dataset.type,
                name: item.dataset.name,
                icon: item.querySelector('i').className,
                zoneColor: item.dataset.zoneColor || '',
                duration: duration
            });
        });
        if (hasError) return;
        if (definition.length === 0) {
            showMessage('Voeg HR zones toe aan de aangepaste training.', 'error');
            return;
        }
        const customId = generateUniqueId();
        const newCustomTraining = {
            id: customId,
            name: trainingName,
            type: 'custom-training-measurement',
            icon: 'fas fa-dumbbell',
            zoneColor: 'text-yellow-500',
            customMeasurementType: 'training',
            customMeasurementDefinition: definition
        };
        let savedCustomMeasurements = JSON.parse(localStorage.getItem('customMeasurements') || '[]');
        savedCustomMeasurements.push(newCustomTraining);
        localStorage.setItem('customMeasurements', JSON.stringify(savedCustomMeasurements));
        showMessage('Aangepaste training opgeslagen!', 'success');
        customTrainingNameInput.value = '';
        customTrainingZonesDropZone.innerHTML = '<p class="text-gray-400 text-center text-sm">Sleep HR zones of oefeningen hierheen om de training te definiëren.</p>';
        loadCustomMeasurements();
    });

    saveCustomRestBtn.addEventListener('click', () => {
        const restName = customRestNameInput.value.trim();
        const restDescription = customRestDescriptionInput.value.trim();
        const restGoals = customRestGoalsInput.value.trim();
        if (!restName) {
            showMessage('Geef de aangepaste rustmeting een naam.', 'error');
            return;
        }
        const customId = generateUniqueId();
        const newCustomRest = {
            id: customId,
            name: restName,
            type: 'custom-rest-measurement',
            icon: 'fas fa-moon',
            zoneColor: 'text-blue-500',
            customMeasurementType: 'rest',
            customMeasurementDescription: restDescription,
            customMeasurementGoals: restGoals
        };
        let savedCustomMeasurements = JSON.parse(localStorage.getItem('customMeasurements') || '[]');
        savedCustomMeasurements.push(newCustomRest);
        localStorage.setItem('customMeasurements', JSON.stringify(savedCustomMeasurements));
        showMessage('Aangepaste rustmeting opgeslagen!', 'success');
        customRestNameInput.value = '';
        customRestDescriptionInput.value = '';
        customRestGoalsInput.value = '';
        loadCustomMeasurements();
    });
}

