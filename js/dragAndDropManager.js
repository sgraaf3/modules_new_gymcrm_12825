// Bestand: dragAndDropManager.js
import { showMessage } from './viewRenderer.js';
import { generateUniqueId } from './scheduleDataManager.js';

export function setupDragAndDrop(dayDropZone, customTrainingZonesDropZone, weekDaySlots, blokDropZone) {
    let draggedItemData = null;

    document.querySelectorAll('.drag-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItemData = {
                type: e.target.dataset.type,
                name: e.target.dataset.name,
                icon: e.target.dataset.icon,
                id: e.target.dataset.id || generateUniqueId(),
                content: e.target.dataset.content ? JSON.parse(e.target.dataset.content) : null,
                zoneColor: e.target.dataset.zoneColor || '',
                duration: e.target.dataset.duration || null,
                progressionEnabled: e.target.dataset.progressionEnabled === 'true',
                progressionValue: e.target.dataset.progressionValue || null,
                customMeasurementType: e.target.dataset.customMeasurementType || null,
                customMeasurementDefinition: e.target.dataset.customMeasurementDefinition ? JSON.parse(e.target.dataset.customMeasurementDefinition) : null,
                customMeasurementDescription: e.target.dataset.customMeasurementDescription || null,
                customMeasurementGoals: e.target.dataset.customMeasurementGoals || null,
                inputType: e.target.dataset.inputType || null,
                reps: e.target.dataset.reps || null,
                sets: e.target.dataset.sets || null,
                minReps: e.target.dataset.minReps || null,
                maxReps: e.target.dataset.maxReps || null,
                minSets: e.target.dataset.minSets || null,
                maxSets: e.target.dataset.maxSets || null,
                minTime: e.target.dataset.minTime || null,
                maxTime: e.target.dataset.maxTime || null,
                notes: e.target.dataset.notes || null
            };
            e.dataTransfer.setData('text/plain', JSON.stringify(draggedItemData));
            e.dataTransfer.effectAllowed = 'move';
        });
    });

    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
            e.dataTransfer.dropEffect = 'move';
        });

        zone.addEventListener('dragleave', (e) => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');

            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const dropZoneId = zone.id;
            const dropZoneClasses = zone.classList;

            let isValidDrop = false;
            let expectedTypes = [];

            if (dropZoneId === 'day-drop-zone') {
                expectedTypes = ['hr-zone', 'rest-day', 'training-measurement', 'rest-measurement-free', 'rest-measurement-base', 'document-link', 'custom-training-measurement', 'custom-rest-measurement', 'strength-exercise', 'recovery-activity', 'coordination-activity', 'flexibility-activity', 'speed-activity', 'nutrition-activity'];
                if (expectedTypes.includes(data.type)) {
                    isValidDrop = true;
                }
            } else if (dropZoneClasses.contains('day-slot')) {
                expectedTypes = ['day'];
                if (data.type === 'day') {
                    isValidDrop = true;
                }
            } else if (dropZoneClasses.contains('week-slot')) {
                expectedTypes = ['week'];
                if (data.type === 'week') {
                    isValidDrop = true;
                }
            } else if (dropZoneId === 'blok-drop-zone') {
                expectedTypes = ['week'];
                if (data.type === 'week') {
                    isValidDrop = true;
                }
            } else if (dropZoneId === 'custom-training-zones-drop-zone') {
                expectedTypes = ['hr-zone', 'strength-exercise', 'recovery-activity', 'coordination-activity', 'flexibility-activity', 'speed-activity', 'nutrition-activity'];
                if (expectedTypes.includes(data.type)) {
                    isValidDrop = true;
                }
            }

            if (!isValidDrop) {
                let specificMessage = `Kan '${data.name}' (type: ${data.type}) niet slepen naar deze zone.`;
                if (expectedTypes.length > 0) {
                    specificMessage += ` Deze zone accepteert alleen: ${expectedTypes.map(t => t.replace(/-/g, ' ')).join(', ')}.`;
                }
                showMessage(specificMessage, 'error');
                console.error("Ongeldige drop poging:", { draggedType: data.type, targetId: dropZoneId, targetClasses: Array.from(dropZoneClasses) });
                return;
            }

            const placeholder = zone.querySelector('p.text-gray-400');
            if (placeholder) {
                placeholder.remove();
            }

            const droppedItem = document.createElement('div');
            droppedItem.dataset.id = data.id;
            droppedItem.dataset.type = data.type;
            droppedItem.dataset.name = data.name;
            if (data.content) droppedItem.dataset.content = JSON.stringify(data.content);
            if (data.zoneColor) droppedItem.dataset.zoneColor = data.zoneColor;
            if (data.documentName) droppedItem.dataset.documentName = data.documentName;
            if (data.customMeasurementType) droppedItem.dataset.customMeasurementType = data.customMeasurementType;
            if (data.customMeasurementDefinition) droppedItem.dataset.customMeasurementDefinition = JSON.stringify(data.customMeasurementDefinition);
            if (data.customMeasurementDescription) droppedItem.dataset.customMeasurementDescription = data.customMeasurementDescription;
            if (data.customMeasurementGoals) droppedItem.dataset.customMeasurementGoals = data.customMeasurementGoals;
            if (data.inputType) droppedItem.dataset.inputType = data.inputType;
            if (data.reps) droppedItem.dataset.reps = data.reps;
            if (data.sets) droppedItem.dataset.sets = data.sets;
            if (data.minReps) droppedItem.dataset.minReps = data.minReps;
            if (data.maxReps) droppedItem.dataset.maxReps = data.maxReps;
            if (data.minSets) droppedItem.dataset.minSets = data.minSets;
            if (data.maxSets) droppedItem.dataset.maxSets = data.maxSets;
            if (data.minTime) droppedItem.dataset.minTime = data.minTime;
            if (data.maxTime) droppedItem.dataset.maxTime = data.maxTime;
            if (data.notes) droppedItem.dataset.notes = data.notes;


            let innerHtmlContent = `<span><i class="${data.icon} mr-2 ${data.zoneColor || ''}"></i>${data.name}</span>`;

            if (dropZoneId === 'day-drop-zone' || dropZoneId === 'custom-training-zones-drop-zone') {
                droppedItem.className = `timeline-item flex items-center p-2 mb-1 rounded-md bg-gray-700`;

                if (dropZoneId === 'day-drop-zone') {
                    const rect = zone.getBoundingClientRect();
                    const relativeY = e.clientY - rect.top;
                    droppedItem.style.top = `${relativeY}px`;
                    droppedItem.style.left = '0';
                    droppedItem.style.width = '100%';
                    droppedItem.style.position = 'absolute';
                }

                if (data.type === 'hr-zone') {
                    innerHtmlContent += `
                        <div class="flex items-center space-x-2 ml-auto">
                            <input type="number" placeholder="Minuten" class="w-20 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-duration-input value="${data.duration || ''}">
                            <label class="flex items-center text-sm text-gray-300">
                                <input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" data-progression-checkbox ${data.progressionEnabled ? 'checked' : ''}>
                                <span class="ml-1">Wekelijks toenemen?</span>
                            </label>
                            <input type="number" placeholder="Minuten" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-progression-value-input value="${data.progressionValue || ''}" ${!data.progressionEnabled ? 'disabled' : ''}>
                                <input type="text" placeholder="Notities" class="w-24 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-notes-input value="${data.notes || ''}">
                        </div>
                    `;
                    droppedItem.classList.add('hr-zone-bar');
                } else if (data.type === 'document-link') {
                    if (!data.documentName) {
                        const docName = prompt('Voer de naam/ID van het document in:');
                        data.documentName = docName || 'Onbekend Document';
                    }
                    droppedItem.dataset.documentName = data.documentName;
                    innerHtmlContent += `<span class="ml-2 text-gray-400">(${data.documentName})</span>`;
                } else if (data.type === 'custom-training-measurement' && data.customMeasurementDefinition) {
                    const totalDuration = data.customMeasurementDefinition.reduce((sum, item) => sum + (item.duration || 0), 0);
                    innerHtmlContent += `<span class="ml-2 text-gray-400">(${totalDuration} min)</span>`;
                } else if (data.type === 'custom-rest-measurement' && data.customMeasurementDescription) {
                     innerHtmlContent += `<span class="ml-2 text-gray-400">(${data.customMeasurementDescription.substring(0, 20)}...)</span>`;
                } else if (['strength-exercise', 'recovery-activity', 'coordination-activity', 'flexibility-activity', 'speed-activity', 'nutrition-activity'].includes(data.type)) {
                    const timeDisplay = data.inputType === 'reps_sets' ? 'display:none;' : 'display:flex;';
                    const repsSetsDisplay = data.inputType === 'time' || !data.inputType ? 'display:none;' : 'display:flex;';

                    innerHtmlContent += `
                        <div class="flex items-center space-x-2 ml-auto w-full md:w-auto flex-wrap">
                            <select class="p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm mt-1" data-input-type-select>
                                <option value="time" ${data.inputType === 'time' ? 'selected' : ''}>Tijd (min)</option>
                                <option value="reps_sets" ${data.inputType === 'reps_sets' ? 'selected' : ''}>Reps & Sets</option>
                            </select>
                            <div class="flex items-center space-x-1 mt-1" data-time-inputs style="${timeDisplay}">
                                <input type="number" placeholder="Duur" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-duration-input value="${data.duration || ''}">
                                <input type="number" placeholder="Min" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-min-time-input value="${data.minTime || ''}">
                                <input type="number" placeholder="Max" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-max-time-input value="${data.maxTime || ''}">
                            </div>
                            <div class="flex items-center space-x-1 mt-1" data-reps-sets-inputs style="${repsSetsDisplay}">
                                <input type="number" placeholder="Reps" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-reps-input value="${data.reps || ''}">
                                <input type="number" placeholder="Sets" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-sets-input value="${data.sets || ''}">
                                <input type="number" placeholder="Min R" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-min-reps-input value="${data.minReps || ''}">
                                <input type="number" placeholder="Max R" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-max-reps-input value="${data.maxReps || ''}">
                                <input type="number" placeholder="Min S" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-min-sets-input value="${data.minSets || ''}">
                                <input type="number" placeholder="Max S" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-max-sets-input value="${data.maxSets || ''}">
                            </div>
                            <label class="flex items-center text-sm text-gray-300 mt-1">
                                <input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" data-progression-checkbox ${data.progressionEnabled ? 'checked' : ''}>
                                <span class="ml-1">Wekelijks toenemen?</span>
                            </label>
                            <input type="number" placeholder="Waarde" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm mt-1" data-progression-value-input value="${data.progressionValue || ''}" ${!data.progressionEnabled ? 'disabled' : ''}>
                            <input type="text" placeholder="Notities" class="w-24 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm mt-1" data-notes-input value="${data.notes || ''}">
                        </div>
                    `;
                }
            } else {
                droppedItem.className = 'dropped-item flex items-center justify-between p-2 mb-2 rounded-md bg-gray-700';
                if (data.type === 'week' && dropZoneId === 'blok-drop-zone') {
                    innerHtmlContent += `
                        <div class="flex items-center space-x-2 ml-auto">
                            <span class="text-sm text-gray-300">Herhalingen:</span>
                            <input type="number" value="1" min="1" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-repetitions-input>
                        </div>
                    `;
                }
            }
            innerHtmlContent += `<button class="remove-btn"><i class="fas fa-times"></i></button>`;
            droppedItem.innerHTML = innerHtmlContent;
            
            if (dropZoneId === 'day-drop-zone' || dropZoneId === 'custom-training-zones-drop-zone') {
                zone.appendChild(droppedItem);
            } else {
                zone.innerHTML = '';
                zone.appendChild(droppedItem);
            }

            const inputTypeSelect = droppedItem.querySelector('[data-input-type-select]');
            const timeInputsDiv = droppedItem.querySelector('[data-time-inputs]');
            const repsSetsInputsDiv = droppedItem.querySelector('[data-reps-sets-inputs]');
            const progressionCheckbox = droppedItem.querySelector('[data-progression-checkbox]');
            const progressionValueInput = droppedItem.querySelector('[data-progression-value-input]');

            if (inputTypeSelect) {
                inputTypeSelect.addEventListener('change', () => {
                    if (inputTypeSelect.value === 'time') {
                        if (timeInputsDiv) timeInputsDiv.style.display = 'flex';
                        if (repsSetsInputsDiv) repsSetsInputsDiv.style.display = 'none';
                    } else {
                        if (timeInputsDiv) timeInputsDiv.style.display = 'none';
                        if (repsSetsInputsDiv) repsSetsInputsDiv.style.display = 'flex';
                    }
                });
                inputTypeSelect.dispatchEvent(new Event('change'));
            }
            if (progressionCheckbox && progressionValueInput) {
                progressionCheckbox.addEventListener('change', () => {
                    progressionValueInput.disabled = !progressionCheckbox.checked;
                    if (!progressionCheckbox.checked) {
                        progressionValueInput.value = '';
                    }
                });
            }

            droppedItem.querySelector('.remove-btn').addEventListener('click', () => {
                droppedItem.remove();
                if (zone.children.length === 0) {
                    const newPlaceholder = document.createElement('p');
                    newPlaceholder.className = 'text-gray-400 text-center text-sm';
                    if (dropZoneId === 'day-drop-zone' || dropZoneId === 'custom-training-zones-drop-zone') {
                        newPlaceholder.textContent = 'Sleep HR zones of oefeningen hierheen om de training te definiëren.';
                    } else if (dropZoneClasses.contains('day-slot')) {
                        newPlaceholder.textContent = 'Sleep dag hier';
                    } else if (dropZoneClasses.contains('week-slot')) {
                        newPlaceholder.textContent = 'Sleep week hier';
                    } else if (dropZoneId === 'blok-drop-zone') {
                        newPlaceholder.textContent = 'Sleep weken hierheen om het blok te configureren.';
                    }
                    zone.appendChild(newPlaceholder);
                }
            });

            showMessage(`${data.name} toegevoegd!`, 'success');
        });
    });
}