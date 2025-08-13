// Bestand: viewRenderer.js
import { loadSavedDays, loadSavedWeeks, loadSavedBloks } from './scheduleDataManager.js';

import { setupDragAndDrop } from './dragAndDropManager.js';

export function showMessage(message, type = 'info') {
    const msgBox = document.getElementById('message-box');
    if (msgBox) {
        msgBox.textContent = message;
        msgBox.className = `message-box show bg-${type === 'error' ? 'red' : type === 'success' ? 'green' : 'gray'}-700`;
        setTimeout(() => {
            msgBox.classList.remove('show');
        }, 3000);
    }
}

export function generateTimeLabels() {
    const timeLabelsContainer = document.getElementById('day-time-labels');
    if (!timeLabelsContainer) return;
    timeLabelsContainer.innerHTML = '';
    for (let h = 0; h < 24; h++) {
        let label = document.createElement('div');
        label.className = 'time-slot-label';
        label.textContent = `${String(h).padStart(2, '0')}:00`;
        timeLabelsContainer.appendChild(label);
        label = document.createElement('div');
        label.className = 'time-slot-label';
        label.textContent = `${String(h).padStart(2, '0')}:30`;
        timeLabelsContainer.appendChild(label);
    }
}

export function setupTabNavigation() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
            loadSavedDays();
            loadSavedWeeks();
            loadSavedBloks();
            loadCustomMeasurements();
        });
    });
}