import { getUserRole, getOrCreateUserId, putData, getData, getAllData, deleteData } from '../database.js'; // Importeer IndexedDB functies

export function initScheduleBuilderView() {
    console.log("Schedule Builder View geïnitialiseerd.");

    // Functie om een unieke ID te genereren (blijft hetzelfde)
    function generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    // Functie om een bericht te tonen (blijft hetzelfde)
    function showMessage(message, type = 'info') {
        const msgBox = document.getElementById('message-box');
        msgBox.textContent = message;
        msgBox.className = `message-box show bg-${type === 'error' ? 'red' : type === 'success' ? 'green' : 'gray'}-700`;
        setTimeout(() => {
            msgBox.classList.remove('show');
        }, 3000);
    }

    // --- UI Elementen ---
    const customTrainingZonesDropZone = document.getElementById('custom-training-zones-drop-zone');
    const saveCustomTrainingBtn = document.getElementById('save-custom-training-btn');
    const customTrainingNameInput = document.getElementById('custom-training-name');

    const saveCustomRestBtn = document.getElementById('save-custom-rest-btn');
    const customRestNameInput = document.getElementById('custom-rest-name');
    const customRestDescriptionInput = document.getElementById('custom-rest-description');
    const customRestGoalsInput = document.getElementById('custom-rest-goals');

    const customMeasurementsList = document.getElementById('custom-measurements-list');
    const availableModulesContainer = document.getElementById('available-modules');
    const allSavedItemsList = document.getElementById('all-saved-items-list'); // Nieuwe container voor gecombineerde lijst

    const tabContents = document.querySelectorAll('.tab-content');
    const tabButtons = document.querySelectorAll('.tab-button');
    const formBuilderTab = document.getElementById('tab-form-builder');
    const formBuilderTabButton = document.querySelector('.tab-button[data-tab="form-builder"]');

    const categorySelect = document.getElementById('category-select');
    const categoryContents = document.querySelectorAll('.category-content');

    let currentUserId = getOrCreateUserId(); // Haal de huidige gebruiker ID op

    // Functie om de zichtbaarheid van de zijbalk te updaten op basis van het actieve tabblad
    function updateSidebarVisibility(activeTabId) {
        const categorySelectContainer = document.querySelector('.category-select-container');
        const createDayBtn = document.getElementById('create-day-btn');
        const createWeekBtn = document.getElementById('create-week-btn');
        const createBlockBtn = document.getElementById('create-block-btn');

        // Hide all category content divs initially
        categoryContents.forEach(el => el.style.display = 'none');
        // Hide all individual drag-items within availableModulesContainer
        availableModulesContainer.querySelectorAll('.drag-item').forEach(el => el.style.display = 'none');

        // Hide all "Create New..." buttons initially
        if (createDayBtn) createDayBtn.style.display = 'none';
        if (createWeekBtn) createWeekBtn.style.display = 'none';
        if (createBlockBtn) createBlockBtn.style.display = 'none';
        
        // Hide category select container initially
        if (categorySelectContainer) categorySelectContainer.style.display = 'none';
        // Hide the combined list initially
        if (allSavedItemsList) allSavedItemsList.style.display = 'none';

        if (activeTabId === 'tab-dag') {
            if (categorySelectContainer) categorySelectContainer.style.display = 'block';
            // Show the currently selected category content
            const selectedCategory = categorySelect.value;
            const activeCategoryContent = document.getElementById(`category-${selectedCategory}`);
            if (activeCategoryContent) {
                activeCategoryContent.style.display = 'block';
                activeCategoryContent.querySelectorAll('.drag-item').forEach(el => el.style.display = 'flex');
            }
            // Always show custom measurements list for Day tab
            customMeasurementsList.style.display = 'block';
            customMeasurementsList.querySelectorAll('.drag-item').forEach(el => el.style.display = 'flex');

            // Show all "Create New..." buttons
            if (createDayBtn) createDayBtn.style.display = 'block';
            if (createWeekBtn) createWeekBtn.style.display = 'block';
            if (createBlockBtn) createBlockBtn.style.display = 'block';

        } else if (activeTabId === 'tab-week') {
            if (allSavedItemsList) allSavedItemsList.style.display = 'block';
            allSavedItemsList.querySelectorAll('.drag-item').forEach(el => {
                if (el.dataset.type === 'day') {
                    el.style.display = 'flex';
                } else {
                    el.style.display = 'none';
                }
            });
            
            // Show all "Create New..." buttons (as they create items for the sidebar)
            if (createDayBtn) createDayBtn.style.display = 'block';
            if (createWeekBtn) createWeekBtn.style.display = 'block';
            if (createBlockBtn) createBlockBtn.style.display = 'block';

        } else if (activeTabId === 'tab-blok') {
            if (allSavedItemsList) allSavedItemsList.style.display = 'block';
            allSavedItemsList.querySelectorAll('.drag-item').forEach(el => {
                if (el.dataset.type === 'week' || el.dataset.type === 'blok') {
                    el.style.display = 'flex';
                } else {
                    el.style.display = 'none';
                }
            });
            
            // Show all "Create New..." buttons (as they create items for the sidebar)
            if (createDayBtn) createDayBtn.style.display = 'block';
            if (createWeekBtn) createWeekBtn.style.display = 'block';
            if (createBlockBtn) createBlockBtn.style.display = 'block';

        } else if (activeTabId === 'tab-form-builder') {
            // Show only custom measurements list
            customMeasurementsList.style.display = 'block';
            customMeasurementsList.querySelectorAll('.drag-item').forEach(el => el.style.display = 'flex');

            // Show all "Create New..." buttons
            if (createDayBtn) createDayBtn.style.display = 'block';
            if (createWeekBtn) createWeekBtn.style.display = 'block';
            if (createBlockBtn) createBlockBtn.style.display = 'block';
        }
    }

    // --- Tab Navigatie Logica ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Verwijder 'active' van alle tabbladen en inhoud
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => {
                content.classList.remove('active', 'fade-in'); // Verwijder animatieklassen
                content.classList.add('hidden'); // Verberg direct
            });

            // Voeg 'active' toe aan de geklikte tabblad
            button.classList.add('active');
            const activeTabId = `tab-${button.dataset.tab}`;
            const targetContent = document.getElementById(activeTabId);
            
            // Toon de inhoud en voeg animatie toe
            targetContent.classList.remove('hidden');
            setTimeout(() => { // Kleine vertraging voor de animatie
                targetContent.classList.add('active', 'fade-in');
                // Specifieke actie voor het "Dag" tabblad om tijdlabels te genereren
                if (activeTabId === 'tab-dag') {
                    // Gebruik setTimeout om ervoor te zorgen dat de DOM volledig is gerenderd
                    setTimeout(generateTimeLabels, 0); 
                }
            }, 10);
            
            // Update de zichtbaarheid van de zijbalk
            updateSidebarVisibility(activeTabId);
            
            // Laad opgeslagen items wanneer van tabblad wordt gewisseld
            renderAllSavedItems(); // Roep de functie aan om de gecombineerde lijst te updaten
            loadCustomMeasurements(); // Laad aangepaste metingen
        });
    });

    // --- Drag & Drop Logica ---
    let draggedItemData = null; // Slaat de data van het gesleepte item op
    let isDraggingExistingItem = false; // Nieuwe vlag om te controleren of een bestaand item wordt verplaatst
    let originalParent = null; // Oorspronkelijke ouder van het gesleepte item

    // Functie om de dragstart eventlistener aan een element te koppelen
    function attachDragStartListener(itemElement) {
        itemElement.addEventListener('dragstart', (e) => {
            // Zorg ervoor dat we het daadwerkelijke sleepbare element krijgen, niet een kindelement
            const draggableItem = e.target.closest('.drag-item, .timeline-item, .dropped-item');
            if (!draggableItem) {
                console.warn("Dragstart geactiveerd op een niet-sleepbaar element of kindelement zonder draggable parent.");
                e.preventDefault(); // Voorkom standaard drag gedrag als het geen geldig draggable item is
                return; 
            }

            // Gebruik een fallback voor 'type' als het niet direct op het dataset object staat
            draggedItemData = { 
                type: draggableItem.dataset.type || 'unknown', // Fallback type
                ...draggableItem.dataset 
            };
            
            if (draggedItemData.content) {
                try {
                    draggedItemData.content = JSON.parse(draggedItemData.content);
                } catch (error) {
                    console.error("Fout bij het parsen van draggedItemData.content:", error);
                    draggedItemData.content = null;
                }
            }
            if (draggedItemData.customMeasurementDefinition) {
                try {
                    draggedItemData.customMeasurementDefinition = JSON.parse(draggedItemData.customMeasurementDefinition);
                } catch (error) {
                    console.error("Fout bij het parsen van draggedItemData.customMeasurementDefinition:", error);
                    draggedItemData.customMeasurementDefinition = null;
                }
            }

            // Controleer of het een bestaand item in een dropzone is
            if (draggableItem.classList.contains('timeline-item') || draggableItem.classList.contains('dropped-item')) {
                isDraggingExistingItem = true;
                originalParent = draggableItem.parentNode;
                e.dataTransfer.effectAllowed = 'move';
            } else {
                isDraggingExistingItem = false;
                e.dataTransfer.effectAllowed = 'copy'; // Kopiëren vanuit de zijbalk
            }
            e.dataTransfer.setData('text/plain', JSON.stringify(draggedItemData));
        });
    }

    // Koppel dragstart listeners aan alle initiële sleepbare items
    document.querySelectorAll('.drag-item').forEach(item => {
        attachDragStartListener(item);
    });

    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            zone.classList.add('drag-over');
            e.dataTransfer.dropEffect = isDraggingExistingItem ? 'move' : 'copy';
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

            // Validatie van drop-actie
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

            // Als het een bestaand item is dat wordt verplaatst, verwijder het dan van de oorspronkelijke locatie
            if (isDraggingExistingItem && originalParent) {
                const draggedElement = originalParent.querySelector(`[data-id="${data.id}"]`);
                if (draggedElement) {
                    draggedElement.remove();
                    checkAndAddPlaceholder(originalParent); // Voeg placeholder terug als oorspronkelijke zone leeg is
                }
            }

            // Verwijder placeholder tekst indien aanwezig
            const placeholder = zone.querySelector('p.text-gray-400');
            if (placeholder) {
                placeholder.remove();
            }

            const rect = zone.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;

            // Aangepaste logica voor het renderen van gedropte items
            if (dropZoneId === 'day-drop-zone' && (data.type === 'custom-training-measurement' || data.type === 'custom-rest-measurement')) {
                 renderCustomMeasurementInDay(relativeY, zone, data);
            } else if (dropZoneId === 'day-drop-zone' || dropZoneId === 'custom-training-zones-drop-zone') {
                createSingleDroppedItem(relativeY, zone, data, dropZoneId);
            } else {
                 createWeekOrBlockDroppedItem(relativeY, zone, data, dropZoneId);
            }
            isDraggingExistingItem = false; // Reset de vlag na de drop
            originalParent = null; // Reset de oorspronkelijke ouder
        });
    });

    function createSingleDroppedItem(yPosition, zone, data, dropZoneId) {
        const droppedItem = document.createElement('div');
        droppedItem.dataset.id = data.id || generateUniqueId();
        droppedItem.dataset.type = data.type;
        droppedItem.dataset.name = data.name;
        if (data.content) {
            droppedItem.dataset.content = JSON.stringify(data.content);
        }
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
        if (data.duration) droppedItem.dataset.duration = data.duration;
        if (data.progressionEnabled) droppedItem.dataset.progressionEnabled = data.progressionEnabled;
        if (data.progressionValue) droppedItem.dataset.progressionValue = data.progressionValue;

        droppedItem.setAttribute('draggable', 'true'); // Maak geplaatste items draggable

        let innerHtmlContent = `
            <div class="element-header flex items-center justify-between w-full">
                <span><i class="${data.icon} mr-2 ${data.zoneColor || ''}"></i>${data.name}</span>
                <button class="remove-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="element-settings hidden flex flex-col mt-2">
        `;

        if (data.type === 'hr-zone') {
            innerHtmlContent += `
                <div class="flex items-center space-x-2 ml-auto w-full md:w-auto flex-wrap">
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
        innerHtmlContent += `</div>`; // Sluit element-settings
        droppedItem.innerHTML = innerHtmlContent;
        if (dropZoneId === 'day-drop-zone') {
            droppedItem.className = `timeline-item flex flex-col p-2 mb-1 rounded-md bg-gray-700`;
            droppedItem.style.top = `${yPosition}px`;
            droppedItem.style.left = '0';
            droppedItem.style.width = '100%';
            droppedItem.style.position = 'absolute';
        } else {
             droppedItem.className = 'dropped-item flex flex-col p-2 mb-1 rounded-md bg-gray-700';
        }

        zone.appendChild(droppedItem);
        attachDragStartListener(droppedItem); // Koppel dragstart aan het nieuw geplaatste item
        addEventListenersToDroppedItem(droppedItem);
        showMessage(`${data.name} toegevoegd!`, 'success');
    }

    function createWeekOrBlockDroppedItem(yPosition, zone, data, dropZoneId) {
        const droppedItem = document.createElement('div');
        droppedItem.className = 'dropped-item flex flex-col p-2 mb-2 rounded-md bg-gray-700';
        droppedItem.dataset.id = data.id;
        droppedItem.dataset.type = data.type;
        droppedItem.dataset.name = data.name;
        droppedItem.dataset.icon = data.icon;
        droppedItem.dataset.content = JSON.stringify(data.content);

        droppedItem.setAttribute('draggable', 'true'); // Maak geplaatste items draggable

        let innerHtmlContent = `
            <div class="element-header flex items-center justify-between w-full">
                <span><i class="${data.icon} mr-2"></i>${data.name}</span>
                <button class="remove-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="element-settings hidden flex flex-col mt-2">
        `;

        if (data.type === 'week' && dropZoneId === 'blok-drop-zone') {
            innerHtmlContent += `
                <div class="flex items-center space-x-2 w-full">
                    <span class="text-sm text-gray-300">Herhalingen:</span>
                    <input type="number" value="${data.repetitions || 1}" min="1" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-repetitions-input>
                </div>
            `;
        } else if (data.type === 'day' && dropZoneId !== 'blok-drop-zone') {
            // Samenvatting voor dag in kalenderweergave
            let summaryHtml = '';
            if (data.content && Array.isArray(data.content)) {
                const hrZonesSummary = data.content.filter(act => act.type === 'hr-zone').map(hrz => `${hrz.name} (${hrz.duration} min)`).join(', ');
                const otherActivities = data.content.filter(act => act.type !== 'hr-zone').map(act => act.name).join(', ');
                summaryHtml = `<div class="text-xs text-gray-400 mt-1">${hrZonesSummary}${otherActivities ? (hrZonesSummary ? '; ' : '') + otherActivities : ''}</div>`;
            }
            innerHtmlContent += summaryHtml;
        }

        innerHtmlContent += `</div>`; // Sluit element-settings
        droppedItem.innerHTML = innerHtmlContent;
        zone.innerHTML = '';
        zone.appendChild(droppedItem);
        attachDragStartListener(droppedItem); // Koppel dragstart aan het nieuw geplaatste item
        addEventListenersToDroppedItem(droppedItem);
        showMessage(`${data.name} toegevoegd!`, 'success');
    }

    function renderCustomMeasurementInDay(yPosition, zone, data) {
        const customMeasurementCard = document.createElement('div');
        customMeasurementCard.className = `timeline-item custom-measurement-group p-2 mb-2 rounded-md border border-gray-600 bg-gray-800 relative`;
        customMeasurementCard.style.top = `${yPosition}px`;
        customMeasurementCard.style.left = '0';
        customMeasurementCard.style.width = '100%';
        customMeasurementCard.style.position = 'absolute';
        
        customMeasurementCard.dataset.id = data.id || generateUniqueId();
        customMeasurementCard.dataset.type = data.type;
        customMeasurementCard.dataset.name = data.name;
        customMeasurementCard.dataset.icon = data.icon;
        customMeasurementCard.dataset.customMeasurementType = data.customMeasurementType;
        customMeasurementCard.dataset.customMeasurementDefinition = JSON.stringify(data.customMeasurementDefinition);
        customMeasurementCard.dataset.customMeasurementDescription = data.customMeasurementDescription;
        customMeasurementCard.dataset.customMeasurementGoals = data.customMeasurementGoals;

        customMeasurementCard.setAttribute('draggable', 'true'); // Maak geplaatste items draggable
        
        let headerHtml = `
            <div class="element-header flex items-center justify-between bg-gray-700 p-2 rounded-md mb-2">
                <span><i class="${data.icon} mr-2 ${data.zoneColor || ''}"></i>${data.name}</span>
                <button class="remove-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="element-settings nested-items-container flex flex-col space-y-1">
        `;
        
        if (data.customMeasurementType === 'training' && data.customMeasurementDefinition && Array.isArray(data.customMeasurementDefinition)) {
            data.customMeasurementDefinition.forEach(subItem => {
                headerHtml += renderNestedItemHtml(subItem);
            });
        } else if (data.customMeasurementType === 'rest') {
            headerHtml += `
                <div class="p-2 text-sm text-gray-300">
                    <p><strong>Beschrijving:</strong> ${data.customMeasurementDescription || 'Geen beschrijving'}</p>
                    <p class="mt-1"><strong>Doelen:</strong> ${data.customMeasurementGoals || 'Geen doelen'}</p>
                </div>
            `;
        }
        
        headerHtml += `</div>`;
        customMeasurementCard.innerHTML = headerHtml;
        zone.appendChild(customMeasurementCard);
        
        attachDragStartListener(customMeasurementCard); // Koppel dragstart aan het nieuw geplaatste item
        addEventListenersToDroppedItem(customMeasurementCard);
        addEventListenersToNestedItems(customMeasurementCard);
        
        showMessage(`${data.name} toegevoegd!`, 'success');
    }

    // Functie om de HTML voor een genest item te genereren
    function renderNestedItemHtml(item) {
        let contentHtml = `
            <div class="nested-item flex flex-col p-2 rounded-md bg-gray-700 w-full"
                 data-type="${item.type}" data-name="${item.name}" data-icon="${item.icon}"
                 data-zone-color="${item.zoneColor || ''}" data-input-type="${item.inputType || ''}"
                 data-reps="${item.reps || ''}" data-sets="${item.sets || ''}"
                 data-min-reps="${item.minReps || ''}" data-max-reps="${item.maxReps || ''}"
                 data-min-sets="${item.minSets || ''}" data-max-sets="${item.maxSets || ''}"
                 data-duration="${item.duration || ''}" data-min-time="${item.minTime || ''}"
                 data-max-time="${item.maxTime || ''}" data-notes="${item.notes || ''}"
                 data-progression-enabled="${item.progressionEnabled || 'false'}"
                 data-progression-value="${item.progressionValue || ''}">
                 
                <div class="element-header flex items-center justify-between w-full">
                    <span><i class="${item.icon} mr-2 ${item.zoneColor || ''}"></i>${item.name}</span>
                </div>
                <div class="element-settings nested-inputs flex flex-col mt-2 space-y-1 w-full">
        `;
        
        // Voeg de inputvelden toe
        if (item.type === 'hr-zone') {
             contentHtml += `
                <div class="flex items-center space-x-2 w-full md:w-auto flex-wrap">
                    <input type="number" placeholder="Minuten" class="w-20 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-duration-input value="${item.duration || ''}">
                    <label class="flex items-center text-sm text-gray-300">
                        <input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" data-progression-checkbox ${item.progressionEnabled ? 'checked' : ''}>
                        <span class="ml-1">Wekelijks toenemen?</span>
                    </label>
                    <input type="number" placeholder="Minuten" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-progression-value-input value="${item.progressionValue || ''}" ${!item.progressionEnabled ? 'disabled' : ''}>
                    <input type="text" placeholder="Notities" class="w-24 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-notes-input value="${item.notes || ''}">
                </div>
            `;
        } else if (['strength-exercise', 'recovery-activity', 'coordination-activity', 'flexibility-activity', 'speed-activity', 'nutrition-activity'].includes(item.type)) {
            const timeDisplay = item.inputType === 'reps_sets' ? 'display:none;' : 'display:flex;';
            const repsSetsDisplay = item.inputType === 'time' || !item.inputType ? 'display:none;' : 'display:flex;';
            contentHtml += `
                <div class="flex items-center space-x-2 w-full md:w-auto flex-wrap">
                    <select class="p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm mt-1" data-input-type-select>
                        <option value="time" ${item.inputType === 'time' ? 'selected' : ''}>Tijd (min)</option>
                        <option value="reps_sets" ${item.inputType === 'reps_sets' ? 'selected' : ''}>Reps & Sets</option>
                    </select>
                    <div class="flex items-center space-x-1 mt-1" data-time-inputs style="${timeDisplay}">
                        <input type="number" placeholder="Duur" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-duration-input value="${item.duration || ''}">
                        <input type="number" placeholder="Min" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-min-time-input value="${item.minTime || ''}">
                        <input type="number" placeholder="Max" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-max-time-input value="${item.maxTime || ''}">
                    </div>
                    <div class="flex items-center space-x-1 mt-1" data-reps-sets-inputs style="${repsSetsDisplay}">
                        <input type="number" placeholder="Reps" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-reps-input value="${item.reps || ''}">
                        <input type="number" placeholder="Sets" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-sets-input value="${item.sets || ''}">
                        <input type="number" placeholder="Min R" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-min-reps-input value="${item.minReps || ''}">
                        <input type="number" placeholder="Max R" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-max-reps-input value="${item.maxReps || ''}">
                        <input type="number" placeholder="Min S" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-min-sets-input value="${item.minSets || ''}">
                        <input type="number" placeholder="Max S" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-max-sets-input value="${item.maxSets || ''}">
                    </div>
                    <label class="flex items-center text-sm text-gray-300 mt-1">
                        <input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" data-progression-checkbox ${item.progressionEnabled ? 'checked' : ''}>
                        <span class="ml-1">Wekelijks toenemen?</span>
                    </label>
                    <input type="number" placeholder="Waarde" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm mt-1" data-progression-value-input value="${item.progressionValue || ''}" ${!item.progressionEnabled ? 'disabled' : ''}>
                    <input type="text" placeholder="Notities" class="w-24 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm mt-1" data-notes-input value="${item.notes || ''}">
                </div>
            `;
        }
        
        contentHtml += `</div>`; // Sluit element-settings
        contentHtml += `</div>`; // Sluit nested-item
        return contentHtml;
    }

    // Hulpfunctie om event listeners toe te voegen aan een gedropt item
    function addEventListenersToDroppedItem(item) {
        const header = item.querySelector('.element-header');
        const settings = item.querySelector('.element-settings');
        const removeBtn = item.querySelector('.remove-btn');

        if (header && settings) {
            header.addEventListener('click', (e) => {
                if (e.target.closest('.remove-btn')) return; // Voorkom togglen als op verwijderknop geklikt wordt
                settings.classList.toggle('hidden');
            });
        }
        
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Voorkom dat de klik doorgeeft aan de header
                item.remove();
                checkAndAddPlaceholder(item.parentNode);
            });
        }
        
        const inputTypeSelect = item.querySelector('[data-input-type-select]');
        const timeInputsDiv = item.querySelector('[data-time-inputs]');
        const repsSetsInputsDiv = item.querySelector('[data-reps-sets-inputs]');
        const progressionCheckbox = item.querySelector('[data-progression-checkbox]');
        const progressionValueInput = item.querySelector('[data-progression-value-input]');

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
    }

    // Hulpfunctie om listeners toe te voegen aan geneste elementen
    function addEventListenersToNestedItems(parentItem) {
        parentItem.querySelectorAll('.nested-item').forEach(item => {
            const header = item.querySelector('.element-header');
            const settings = item.querySelector('.element-settings');
            if(header && settings){
                 header.addEventListener('click', () => {
                     settings.classList.toggle('hidden');
                 });
            }

            const inputTypeSelect = item.querySelector('[data-input-type-select]');
            const timeInputsDiv = item.querySelector('[data-time-inputs]');
            const repsSetsInputsDiv = item.querySelector('[data-reps-sets-inputs]');
            const progressionCheckbox = item.querySelector('[data-progression-checkbox]');
            const progressionValueInput = item.querySelector('[data-progression-value-input]');

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
        });
    }

    // Hulpfunctie om een placeholder toe te voegen als de zone leeg is
    function checkAndAddPlaceholder(zone) {
        if (zone.children.length === 0) {
            const newPlaceholder = document.createElement('p');
            newPlaceholder.className = 'text-gray-400 text-center text-sm';
            if (zone.id === 'day-drop-zone' || zone.id === 'custom-training-zones-drop-zone') { 
                newPlaceholder.textContent = 'Sleep HR zones of oefeningen hierheen om de training te definiëren.';
            } else if (zone.classList.contains('day-slot')) {
                newPlaceholder.textContent = 'Sleep dag hier';
            } else if (zone.classList.contains('week-slot')) {
                newPlaceholder.textContent = 'Sleep week hier';
            } else if (zone.id === 'blok-drop-zone') {
                newPlaceholder.textContent = 'Sleep weken hierheen om het blok te configureren.';
            }
            zone.appendChild(newPlaceholder);
        }
    }


    // --- Hulpfunctie om dropzones te vullen bij kopiëren en laden ---
    async function populateDropZone(dropZoneElement, contentData, targetType) {
        dropZoneElement.innerHTML = '';
        if (!contentData || (Array.isArray(contentData) && contentData.length === 0 && dropZoneElement.id !== 'blok-drop-zone')) {
            checkAndAddPlaceholder(dropZoneElement);
            return;
        }

        if (Array.isArray(contentData)) { // Voor Dag (array van activiteiten) of Custom Training (array van zones)
            contentData.forEach(item => {
                if (item.type === 'custom-training-measurement' || item.type === 'custom-rest-measurement') {
                     renderCustomMeasurementInDay(item.topPosition || 0, dropZoneElement, item);
                } else {
                     const droppedItem = document.createElement('div');
                     droppedItem.dataset.id = item.id || generateUniqueId();
                     droppedItem.dataset.type = item.type;
                     droppedItem.dataset.name = item.name;
                     droppedItem.dataset.icon = item.icon;
                     droppedItem.dataset.zoneColor = item.zoneColor || '';
                     droppedItem.dataset.documentName = item.documentName || '';
                     droppedItem.dataset.customMeasurementType = item.customMeasurementType || '';
                     droppedItem.dataset.customMeasurementDefinition = item.customMeasurementDefinition ? JSON.stringify(item.customMeasurementDefinition) : '';
                     droppedItem.dataset.customMeasurementDescription = item.customMeasurementDescription || '';
                     droppedItem.dataset.customMeasurementGoals = item.customMeasurementGoals || '';
                     droppedItem.dataset.inputType = item.inputType || '';
                     droppedItem.dataset.reps = item.reps || '';
                     droppedItem.dataset.sets = item.sets || '';
                     droppedItem.dataset.minReps = item.minReps || '';
                     droppedItem.dataset.maxReps = item.maxReps || '';
                     droppedItem.dataset.minSets = item.minSets || '';
                     droppedItem.dataset.maxSets = item.maxSets || '';
                     droppedItem.dataset.minTime = item.minTime || '';
                     droppedItem.dataset.maxTime = item.maxTime || '';
                     droppedItem.dataset.notes = item.notes || '';
                     droppedItem.dataset.duration = item.duration || '';
                     droppedItem.dataset.progressionEnabled = item.progressionEnabled || false;
                     droppedItem.dataset.progressionValue = item.progressionValue || '';
                     if (item.content) {
                          droppedItem.dataset.content = JSON.stringify(item.content);
                     }

                    droppedItem.setAttribute('draggable', 'true'); // Maak geplaatste items draggable
                    
                     let innerHtmlContent = `
                        <div class="element-header flex items-center justify-between w-full">
                            <span><i class="${item.icon} mr-2 ${item.zoneColor || ''}"></i>${item.name}</span>
                            <button class="remove-btn"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="element-settings flex flex-col mt-2">
                     `;
            
                    if (item.type === 'hr-zone') {
                        droppedItem.className = `timeline-item flex flex-col p-2 mb-1 rounded-md bg-gray-700 hr-zone-bar`;
                        innerHtmlContent += `
                            <div class="flex items-center space-x-2 w-full md:w-auto flex-wrap">
                                <input type="number" placeholder="Minuten" class="w-20 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-duration-input value="${item.duration || ''}">
                                <label class="flex items-center text-sm text-gray-300">
                                    <input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" data-progression-checkbox ${item.progressionEnabled ? 'checked' : ''}>
                                    <span class="ml-1">Wekelijks toenemen?</span>
                                </label>
                                <input type="number" placeholder="Minuten" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-progression-value-input value="${item.progressionValue || ''}" ${!item.progressionEnabled ? 'disabled' : ''}>
                                <input type="text" placeholder="Notities" class="w-24 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-notes-input value="${item.notes || ''}">
                            </div>
                         `;
                    } else if (['strength-exercise', 'recovery-activity', 'coordination-activity', 'flexibility-activity', 'speed-activity', 'nutrition-activity'].includes(item.type)) {
                         const timeDisplay = item.inputType === 'reps_sets' ? 'display:none;' : 'display:flex;';
                         const repsSetsDisplay = item.inputType === 'time' || !item.inputType ? 'display:none;' : 'display:flex;';
                         droppedItem.className = 'timeline-item flex flex-col p-2 mb-1 rounded-md bg-gray-700';
                         innerHtmlContent += `
                            <div class="flex items-center space-x-2 w-full md:w-auto flex-wrap">
                                <select class="p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm mt-1" data-input-type-select>
                                    <option value="time" ${item.inputType === 'time' ? 'selected' : ''}>Tijd (min)</option>
                                    <option value="reps_sets" ${item.inputType === 'reps_sets' ? 'selected' : ''}>Reps & Sets</option>
                                </select>
                                <div class="flex items-center space-x-1 mt-1" data-time-inputs style="${timeDisplay}">
                                    <input type="number" placeholder="Duur" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-duration-input value="${item.duration || ''}">
                                    <input type="number" placeholder="Min" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-min-time-input value="${item.minTime || ''}">
                                    <input type="number" placeholder="Max" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-max-time-input value="${item.maxTime || ''}">
                                </div>
                                <div class="flex items-center space-x-1 mt-1" data-reps-sets-inputs style="${repsSetsDisplay}">
                                    <input type="number" placeholder="Reps" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-reps-input value="${item.reps || ''}">
                                    <input type="number" placeholder="Sets" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-sets-input value="${item.sets || ''}">
                                    <input type="number" placeholder="Min R" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-min-reps-input value="${item.minReps || ''}">
                                    <input type="number" placeholder="Max R" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-max-reps-input value="${item.maxReps || ''}">
                                    <input type="number" placeholder="Min S" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-min-sets-input value="${item.minSets || ''}">
                                    <input type="number" placeholder="Max S" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-max-sets-input value="${item.maxSets || ''}">
                                </div>
                                <label class="flex items-center text-sm text-gray-300 mt-1">
                                    <input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" data-progression-checkbox ${item.progressionEnabled ? 'checked' : ''}>
                                    <span class="ml-1">Wekelijks toenemen?</span>
                                </label>
                                <input type="number" placeholder="Waarde" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm mt-1" data-progression-value-input value="${item.progressionValue || ''}" ${!item.progressionEnabled ? 'disabled' : ''}>
                                <input type="text" placeholder="Notities" class="w-24 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm mt-1" data-notes-input value="${item.notes || ''}">
                            </div>
                         `;
                    }
                    innerHtmlContent += `</div>`; // Sluit element-settings
                    droppedItem.innerHTML = innerHtmlContent;

                     // Set position for loaded items in day-drop-zone
                     if (dropZoneElement.id === 'day-drop-zone') {
                         droppedItem.style.top = `${item.topPosition || 0}px`;
                         droppedItem.style.left = '0';
                         droppedItem.style.width = '100%';
                         droppedItem.style.position = 'absolute';
                     }
                
                     dropZoneElement.appendChild(droppedItem);
                     attachDragStartListener(droppedItem); // Koppel dragstart aan het nieuw geplaatste item
                     addEventListenersToDroppedItem(droppedItem);
                }
            });
        } else if (contentData && typeof contentData === 'object' && targetType === 'object') {
            for (const key in contentData) {
                const slot = dropZoneElement.querySelector(`[data-${dropZoneElement.classList.contains('day-slot') ? 'day-of-week' : 'week-number'}="${key}"]`);
                if (slot) {
                    slot.innerHTML = '';
                    if (contentData[key]) {
                        const item = contentData[key];
                        const droppedItem = document.createElement('div');
                        droppedItem.className = 'dropped-item flex flex-col p-2 mb-1 rounded-md bg-gray-700';
                        droppedItem.dataset.id = item.id;
                        droppedItem.dataset.type = item.type;
                        droppedItem.dataset.name = item.name;
                        droppedItem.dataset.icon = item.icon;
                        droppedItem.dataset.content = JSON.stringify(item.content);

                        droppedItem.setAttribute('draggable', 'true'); // Maak geplaatste items draggable

                        let summaryHtml = '';
                        if (item.type === 'day' && item.content && Array.isArray(item.content)) {
                            const hrZonesSummary = item.content.filter(act => act.type === 'hr-zone').map(hrz => `${hrz.name} (${hrz.duration} min)`).join(', ');
                            const otherActivities = item.content.filter(act => act.type !== 'hr-zone').map(act => act.name).join(', ');
                            summaryHtml = `<div class="text-xs text-gray-400 mt-1">${hrZonesSummary}${otherActivities ? (hrZonesSummary ? '; ' : '') + otherActivities : ''}</div>`;
                        } else if (item.type === 'week' && item.content && typeof item.content === 'object') {
                            const daysCount = Object.values(item.content).filter(d => d !== null).map(d => d.name).join(', ');
                            summaryHtml = `<div class="text-xs text-gray-400 mt-1">Dagen: ${daysCount || 'Geen dagen'}</div>`;
                        }

                        droppedItem.innerHTML = `
                            <div class="element-header flex items-center justify-between w-full">
                                <span><i class="${item.icon} mr-2"></i>${item.name}</span>
                                <button class="remove-btn absolute top-1 right-1"><i class="fas fa-times"></i></button>
                            </div>
                            <div class="element-settings hidden flex flex-col mt-2">
                                ${summaryHtml}
                            </div>
                        `;
                        slot.appendChild(droppedItem);
                        attachDragStartListener(droppedItem); // Koppel dragstart aan het nieuw geplaatste item
                        addEventListenersToDroppedItem(droppedItem);
                    } else {
                        checkAndAddPlaceholder(slot);
                    }
                }
            }
        } else if (dropZoneElement.id === 'blok-drop-zone') { // Voor Blok (array van maanden)
             if (contentData.length === 0) {
                 const newPlaceholder = document.createElement('p');
                 newPlaceholder.className = 'text-gray-400 text-center';
                 newPlaceholder.textContent = 'Sleep weken hierheen om het blok te configureren.';
                 dropZoneElement.appendChild(newPlaceholder);
                 return;
             }
            contentData.forEach(item => {
                const droppedItem = document.createElement('div');
                droppedItem.className = 'dropped-item flex flex-col p-3 rounded-md bg-gray-700';
                droppedItem.dataset.id = item.id;
                droppedItem.dataset.type = item.type;
                droppedItem.dataset.name = item.name;
                droppedItem.dataset.icon = item.icon;
                droppedItem.dataset.content = JSON.stringify(item.content);
                droppedItem.dataset.repetitions = item.repetitions || 1;

                droppedItem.setAttribute('draggable', 'true'); // Maak geplaatste items draggable

                droppedItem.innerHTML = `
                    <div class="element-header flex items-center justify-between w-full">
                        <span><i class="${item.icon} mr-2 text-cyan-300"></i>${item.name}</span>
                        <button class="remove-btn"><i class="fas fa-times"></i></button>
                    </div>
                     <div class="element-settings hidden flex flex-col mt-2">
                         <div class="flex items-center space-x-2 w-full">
                            <span class="text-sm text-gray-300">Herhalingen:</span>
                            <input type="number" value="${item.repetitions || 1}" min="1" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-repetitions-input>
                        </div>
                        <div class="text-xs text-gray-300 mt-2">
                            ${Object.keys(item.content).filter(day => item.content[day]).map(day => `<span class="inline-block bg-gray-800 rounded-full px-2 py-1 text-xs font-semibold text-gray-300 mr-1 mb-1">${item.content[day].name}</span>`).join('')}
                        </div>
                     </div>
                `;
                dropZoneElement.appendChild(droppedItem);
                attachDragStartListener(droppedItem); // Koppel dragstart aan het nieuw geplaatste item
                addEventListenersToDroppedItem(droppedItem);
            });
        }
    }

    // --- Render alle opgeslagen items (Dagen, Weken, Blokken) in één lijst ---
    async function renderAllSavedItems() {
        if (!allSavedItemsList) {
            console.error("Container for all saved items not found.");
            return;
        }
        allSavedItemsList.innerHTML = ''; // Clear the list

        const savedDays = await getAllData('trainingDays'); // Changed from localStorage
        const savedWeeks = await getAllData('trainingWeeks'); // Changed from localStorage
        const savedBloks = await getAllData('trainingBlocks'); // Changed from localStorage

        let allItems = [];

        // Add saved days
        savedDays.forEach(day => {
            allItems.push({
                ...day,
                type: 'day',
                displayType: 'Dag', // For sorting and display
                sortOrder: 2, // After elements, before weeks
                listName: 'trainingDays' // Add listName for removal
            });
        });

        // Add saved weeks
        savedWeeks.forEach(week => {
            allItems.push({
                ...week,
                type: 'week',
                displayType: 'Week', // For sorting and display
                sortOrder: 3, // After days, before blocks
                listName: 'trainingWeeks' // Add listName for removal
            });
        });

        // Add saved blocks
        savedBloks.forEach(blok => {
            allItems.push({
                ...blok,
                type: 'blok',
                displayType: 'Blok', // For sorting and display
                sortOrder: 4, // Last
                listName: 'trainingBlocks' // Add listName for removal
            });
        });

        // Sort items: element (if added) -> day -> week -> block -> custom measurements
        allItems.sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) {
                return a.sortOrder - b.sortOrder;
            }
            return a.name.localeCompare(b.name); // Then by name
        });

        if (allItems.length === 0) {
            allSavedItemsList.innerHTML = '<p class="text-gray-400 col-span-full">Nog geen schema\'s opgeslagen.</p>';
            return;
        }

        allItems.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.className = 'drag-item bg-gray-600 p-3 rounded-md shadow flex flex-col cursor-grab';
            itemCard.setAttribute('draggable', 'true');
            itemCard.dataset.type = item.type;
            itemCard.dataset.id = item.id;
            itemCard.dataset.name = item.name;
            itemCard.dataset.icon = item.icon;
            if (item.content) itemCard.dataset.content = JSON.stringify(item.content);
            if (item.repetitions) itemCard.dataset.repetitions = item.repetitions;
            if (item.customMeasurementType) itemCard.dataset.customMeasurementType = item.customMeasurementType;
            if (item.customMeasurementDefinition) itemCard.dataset.customMeasurementDefinition = JSON.stringify(item.customMeasurementDefinition);
            if (item.customMeasurementDescription) itemCard.dataset.customMeasurementDescription = item.customMeasurementDescription;
            if (item.customMeasurementGoals) itemCard.dataset.customMeasurementGoals = item.customMeasurementGoals;


            let summaryText = '';
            if (item.type === 'day' && item.activities && Array.isArray(item.activities)) {
                const activityNames = item.activities.map(act => act.name).join(', ');
                summaryText = `<div class="text-xs text-gray-400 mt-1">Activiteiten: ${activityNames}</div>`;
            } else if (item.type === 'week' && item.days && typeof item.days === 'object') {
                const configuredDays = Object.values(item.days).filter(day => day !== null).map(day => day.name);
                summaryText = `<div class="text-xs text-gray-400 mt-1">Dagen: ${configuredDays.length > 0 ? configuredDays.join(', ') : 'Geen dagen'}</div>`;
            } else if (item.type === 'blok' && item.weeks && Array.isArray(item.weeks)) {
                const configuredWeeks = item.weeks.map(week => `${week.name} (${week.repetitions}x)`).join(', ');
                summaryText = `<div class="text-xs text-gray-400 mt-1">Weken: ${configuredWeeks.length > 0 ? configuredWeeks : 'Geen weken'}</div>`;
            } else if (item.type === 'custom-training-measurement' && item.customMeasurementDefinition) {
                const totalDuration = item.customMeasurementDefinition.reduce((sum, subItem) => sum + (subItem.duration || 0), 0);
                summaryText = `<div class="text-xs text-gray-400 mt-1">Duur: ${totalDuration} min</div>`;
            } else if (item.type === 'custom-rest-measurement') {
                summaryText = `<div class="text-xs text-gray-400 mt-1">Rustmeting</div>`;
            }


            itemCard.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <span><i class="${item.icon} mr-2"></i>${item.name} (${item.displayType})</span>
                    <button class="remove-saved-item-btn text-red-400 hover:text-red-300" data-id="${item.id}" data-list="${item.listName}"><i class="fas fa-times"></i></button>
                </div>
                ${summaryText}
            `;
            allSavedItemsList.appendChild(itemCard);

            // Voeg dragstart listener toe aan het nieuwe element in de gecombineerde lijst
            attachDragStartListener(itemCard);
        });
        addRemoveListenersToSavedItems(); // Re-attach listeners for dynamically loaded items
    }


    // --- Opslaan en Laden van Schema's (via IndexedDB) ---

    // Dagen
    const currentDayNameInput = document.getElementById('current-day-name');
    const dayDropZone = document.getElementById('day-drop-zone');
    const saveDayBtn = document.getElementById('save-day-btn');
    const savedDaysList = document.getElementById('saved-days-list');

    saveDayBtn.addEventListener('click', async () => { // Added async
        const dayName = currentDayNameInput.value.trim();
        if (!dayName) {
            showMessage('Geef de dag een naam.', 'error');
            return;
        }

        const activities = [];
        let hasError = false; 
        dayDropZone.querySelectorAll('.timeline-item').forEach(item => {
             const activity = {
                 type: item.dataset.type,
                 name: item.dataset.name,
                 icon: item.querySelector('.element-header i').className, // Correcte selector
                 zoneColor: item.dataset.zoneColor || '',
                 topPosition: parseFloat(item.style.top) || 0,
                 progressionEnabled: item.dataset.progressionEnabled === 'true',
                 inputType: item.dataset.inputType || null,
                 reps: item.dataset.reps || null,
                 sets: item.dataset.sets || null,
                 minReps: item.dataset.minReps || null,
                 maxReps: item.dataset.maxReps || null,
                 minSets: item.dataset.minSets || null,
                 maxSets: item.dataset.maxSets || null,
                 minTime: item.dataset.minTime || null,
                 maxTime: item.dataset.maxTime || null,
                 notes: item.dataset.notes || null,
                 duration: item.dataset.duration || null,
                 progressionValue: item.dataset.progressionValue || null
             };
            
             if (item.dataset.type === 'hr-zone') {
                 const durationInput = item.querySelector('[data-duration-input]');
                 const progressionCheckbox = item.querySelector('[data-progression-checkbox]');
                 const progressionValueInput = item.querySelector('[data-progression-value-input]');
                 const notesInput = item.querySelector('[data-notes-input]');
                
                 const duration = parseInt(durationInput.value);
                 if (isNaN(duration) || duration <= 0) {
                     hasError = true;
                     showMessage('Vul een geldige duur (in minuten) in voor alle hartslagzones.', 'error');
                     return; 
                 }
                 activity.duration = duration;
                 activity.progressionEnabled = progressionCheckbox.checked;
                 activity.progressionValue = progressionCheckbox.checked ? parseInt(progressionValueInput.value) : null; 
                 if (activity.progressionEnabled && (isNaN(activity.progressionValue) || activity.progressionValue <= 0)) {
                     hasError = true;
                     showMessage('Vul een geldige toename waarde (in minuten) in voor wekelijkse toename.', 'error');
                     return;
                 }
                 activity.notes = notesInput.value;
            } else if (['strength-exercise', 'recovery-activity', 'coordination-activity', 'flexibility-activity', 'speed-activity', 'nutrition-activity'].includes(item.dataset.type)) {
                const inputTypeSelect = item.querySelector('[data-input-type-select]');
                const progressionCheckbox = item.querySelector('[data-progression-checkbox]');
                const progressionValueInput = item.querySelector('[data-progression-value-input]');
                const notesInput = item.querySelector('[data-notes-input]');
            
                activity.inputType = inputTypeSelect ? inputTypeSelect.value : null;
                activity.progressionEnabled = progressionCheckbox ? progressionCheckbox.checked : false;
                activity.progressionValue = (progressionCheckbox && progressionCheckbox.checked) ? parseInt(progressionValueInput.value) : null;
                activity.notes = notesInput ? notesInput.value : '';

                if (activity.inputType === 'time') {
                    activity.duration = parseInt(item.querySelector('[data-duration-input]').value);
                    activity.minTime = parseInt(item.querySelector('[data-min-time-input]').value);
                    activity.maxTime = parseInt(item.querySelector('[data-max-time-input]').value);
                } else if (activity.inputType === 'reps_sets') {
                    activity.reps = parseInt(item.querySelector('[data-reps-input]').value);
                    activity.sets = parseInt(item.querySelector('[data-sets-input]').value);
                    activity.minReps = parseInt(item.querySelector('[data-min-reps-input]').value);
                    activity.maxReps = parseInt(item.querySelector('[data-max-reps-input]').value);
                    activity.minSets = parseInt(item.querySelector('[data-min-sets-input]').value);
                    activity.maxSets = parseInt(item.querySelector('[data-max-sets-input]').value);
                }
            } else if (item.dataset.type === 'document-link') {
                 activity.documentName = item.dataset.documentName;
            } else if (item.dataset.type === 'custom-training-measurement' || item.dataset.type === 'custom-rest-measurement') {
                 // Haal de data uit de dataset van de main container
                 activity.customMeasurementType = item.dataset.customMeasurementType;
                 activity.customMeasurementDescription = item.dataset.customMeasurementDescription || null;
                 activity.customMeasurementGoals = item.dataset.customMeasurementGoals || null;
                
                 // Nu itereren over de geneste items om hun actuele waarden op te halen
                 const nestedDefinition = [];
                 item.querySelectorAll('.nested-item').forEach(nestedItem => {
                     const subActivity = {
                         type: nestedItem.dataset.type,
                         name: nestedItem.dataset.name,
                         icon: nestedItem.querySelector('.element-header i').className, // Correcte selector
                         zoneColor: nestedItem.dataset.zoneColor,
                         inputType: nestedItem.dataset.inputType,
                         progressionEnabled: nestedItem.dataset.progressionEnabled === 'true',
                         notes: nestedItem.querySelector('[data-notes-input]') ? nestedItem.querySelector('[data-notes-input]').value : ''
                     };
                     
                     if (subActivity.type === 'hr-zone') {
                         subActivity.duration = parseInt(nestedItem.querySelector('[data-duration-input]').value);
                         subActivity.progressionValue = subActivity.progressionEnabled ? parseInt(nestedItem.querySelector('[data-progression-value-input]').value) : null;
                     } else if (subActivity.inputType === 'time') {
                         subActivity.duration = parseInt(nestedItem.querySelector('[data-duration-input]').value);
                         subActivity.minTime = parseInt(nestedItem.querySelector('[data-min-time-input]').value);
                         subActivity.maxTime = parseInt(nestedItem.querySelector('[data-max-time-input]').value);
                     } else if (subActivity.inputType === 'reps_sets') {
                         subActivity.reps = parseInt(nestedItem.querySelector('[data-reps-input]').value);
                         subActivity.sets = parseInt(nestedItem.querySelector('[data-sets-input]').value);
                         subActivity.minReps = parseInt(nestedItem.querySelector('[data-min-reps-input]').value);
                         subActivity.maxReps = parseInt(nestedItem.querySelector('[data-max-reps-input]').value);
                         subActivity.minSets = parseInt(nestedItem.querySelector('[data-min-sets-input]').value);
                         subActivity.maxSets = parseInt(nestedItem.querySelector('[data-max-sets-input]').value);
                     }
                     nestedDefinition.push(subActivity);
                 });
                 activity.customMeasurementDefinition = nestedDefinition;
            }
             activities.push(activity);
        });

        if (hasError) {
            return; 
        }

        if (activities.length === 0) {
            showMessage('Voeg activiteiten toe aan de dag.', 'error');
            return;
        }

        activities.sort((a, b) => a.topPosition - b.topPosition);

        const dayId = generateUniqueId();
        const newDay = { id: dayId, name: dayName, activities: activities };

        await putData('trainingDays', newDay); // Changed from localStorage
        showMessage('Dag opgeslagen!', 'success');
        currentDayNameInput.value = '';
        dayDropZone.innerHTML = '<p class="text-gray-400 text-center">Sleep hartslagzones, rust, metingen of documenten hierheen om de dag te configureren.</p>';
        renderAllSavedItems(); // Roep de functie aan om de gecombineerde lijst te updaten
    });

    async function loadSavedDays() { // Added async
        savedDaysList.innerHTML = '';
        const savedDays = await getAllData('trainingDays'); // Changed from localStorage
        if (savedDays.length === 0) {
            savedDaysList.innerHTML = '<p class="text-gray-400 col-span-full">Nog geen dagen opgeslagen.</p>';
            return;
        }

        savedDays.forEach(day => {
            const dayCard = document.createElement('div');
            dayCard.className = 'drag-item bg-gray-600 p-3 rounded-md shadow flex flex-col cursor-grab';
            dayCard.setAttribute('draggable', 'true');
            dayCard.dataset.type = 'day';
            dayCard.dataset.id = day.id;
            dayCard.dataset.name = day.name;
            dayCard.dataset.icon = 'fas fa-calendar-day'; 
            dayCard.dataset.content = JSON.stringify(day.activities); 

            dayCard.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <span><i class="${dayCard.dataset.icon} mr-2 text-blue-300"></i>${day.name}</span>
                    <button class="remove-saved-item-btn text-red-400 hover:text-red-300" data-id="${day.id}" data-list="trainingDays"><i class="fas fa-times"></i></button>
                </div>
                <div class="text-xs text-gray-300 mt-2">
                    ${day.activities.map(act => {
                        let activityText = `<span class="inline-block bg-gray-800 rounded-full px-2 py-1 text-xs font-semibold text-gray-300 mr-1 mb-1"><i class="${act.icon.split(' ')[1]} mr-1 ${act.zoneColor || ''}"></i>${act.name}`;
                        if (act.type === 'hr-zone') {
                            if (act.duration) {
                                activityText += ` (${act.duration} min)`;
                            }
                            if (act.progressionEnabled && act.progressionValue) {
                                activityText += ` (+${act.progressionValue} min)`; 
                            }
                        } else if (act.type === 'document-link') {
                            activityText += ` (${act.documentName || 'Onbekend'})`;
                        } else if (act.type === 'custom-training-measurement') {
                            const totalDuration = act.customMeasurementDefinition ? act.customMeasurementDefinition.reduce((sum, subItem) => sum + (subItem.duration || 0), 0) : 0;
                            activityText += ` (${totalDuration} min)`;
                        } else if (act.type === 'custom-rest-measurement') {
                            activityText += ` (Aangepaste Rust)`;
                        }
                        activityText += `</span>`;
                        return activityText;
                    }).join('')}
                </div>
            `;
            savedDaysList.appendChild(dayCard);
        });
        addRemoveListenersToSavedItems();
    }

    // Weken
    const currentWeekNameInput = document.getElementById('current-week-name');
    const weekDaySlots = document.querySelectorAll('.day-slot'); 
    const saveWeekBtn = document.getElementById('save-week-btn');
    const savedWeeksList = document.getElementById('saved-weeks-list');

    saveWeekBtn.addEventListener('click', async () => { // Added async
        const weekName = currentWeekNameInput.value.trim();
        if (!weekName) {
            showMessage('Geef de week een naam.', 'error');
            return;
        }

    const daysInWeek = {};
    let isEmptyWeek = true;
    weekDaySlots.forEach(slot => {
        const droppedDay = slot.querySelector('.dropped-item');
        if (droppedDay) {
            daysInWeek[slot.dataset.dayOfWeek] = {
                id: droppedDay.dataset.id,
                name: droppedDay.dataset.name,
                icon: droppedDay.dataset.icon,
                content: JSON.parse(droppedDay.dataset.content)
            };
            isEmptyWeek = false;
        } else {
            daysInWeek[slot.dataset.dayOfWeek] = null; 
        }
    });

    if (isEmptyWeek) {
        showMessage('Voeg dagen toe aan de week.', 'error');
        return;
    }

    const weekId = generateUniqueId();
    const newWeek = { id: weekId, name: weekName, days: daysInWeek };

    await putData('trainingWeeks', newWeek); // Changed from localStorage
    showMessage('Week opgeslagen!', 'success');
    currentWeekNameInput.value = '';
    weekDaySlots.forEach(slot => {
        slot.innerHTML = '<p class="text-gray-400 text-center text-sm">Sleep dag hier</p>';
    });
    renderAllSavedItems(); // Roep de functie aan om de gecombineerde lijst te updaten
});

async function loadSavedWeeks() { // Added async
    savedWeeksList.innerHTML = '';
    const savedWeeks = await getAllData('trainingWeeks'); // Changed from localStorage
    if (savedWeeks.length === 0) {
        savedWeeksList.innerHTML = '<p class="text-gray-400 col-span-full">Nog geen weken opgeslagen.</p>';
        return;
    }

    savedWeeks.forEach(week => {
        const weekCard = document.createElement('div');
        weekCard.className = 'drag-item bg-gray-600 p-3 rounded-md shadow flex flex-col cursor-grab';
        weekCard.setAttribute('draggable', 'true');
        weekCard.dataset.type = 'week';
        weekCard.dataset.id = week.id;
        weekCard.dataset.name = week.name;
        weekCard.dataset.icon = 'fas fa-calendar-week'; 
        weekCard.dataset.content = JSON.stringify(week.days); 

        const configuredDays = Object.values(week.days).filter(day => day !== null).map(day => day.name);
        const summaryText = configuredDays.length > 0 ? configuredDays.join(', ') : 'Geen dagen geconfigureerd';

        weekCard.innerHTML = `
            <div class="flex items-center justify-between w-full">
                <span><i class="${weekCard.dataset.icon} mr-2 text-purple-300"></i>${week.name}</span>
                <button class="remove-saved-item-btn text-red-400 hover:text-red-300" data-id="${week.id}" data-list="trainingWeeks"><i class="fas fa-times"></i></button>
            </div>
            <div class="text-xs text-gray-300 mt-2">
                ${summaryText}
            </div>
        `;
        savedWeeksList.appendChild(weekCard);
    });
    addRemoveListenersToSavedItems();
}

// Blokken
    const currentBlokNameInput = document.getElementById('current-blok-name');
    const currentBlokNotesInput = document.getElementById('current-blok-notes');
    const blokDropZone = document.getElementById('blok-drop-zone');
    const saveBlokBtn = document.getElementById('save-blok-btn');
    const savedBloksList = document.getElementById('saved-bloks-list');

    saveBlokBtn.addEventListener('click', async () => { // Added async
        const blokName = currentBlokNameInput.value.trim();
        const blokNotes = currentBlokNotesInput.value.trim();
        if (!blokName) {
            showMessage('Geef het blok een naam.', 'error');
            return;
        }

        const weeksInBlok = [];
        let hasError = false;
        blokDropZone.querySelectorAll('.dropped-item').forEach(item => {
            const repetitionsInput = item.querySelector('[data-repetitions-input]');
            const repetitions = parseInt(repetitionsInput.value);
            if (isNaN(repetitions) || repetitions <= 0) {
                hasError = true;
                showMessage('Vul een geldig aantal herhalingen in voor elke week.', 'error');
                return;
            }

            weeksInBlok.push({
                weekId: item.dataset.id,
                name: item.dataset.name,
                icon: item.dataset.icon,
                content: JSON.parse(item.dataset.content),
                repetitions: repetitions
            });
        });

        if (hasError) {
            return;
        }

        if (weeksInBlok.length === 0) {
            showMessage('Voeg weken toe aan het blok.', 'error');
            return;
        }

        if (weeksInBlok.length > 53) {
            showMessage('Een blok kan maximaal 53 weken bevatten.', 'error');
            return;
        }

        const blokId = generateUniqueId();
        const newBlok = { 
            id: blokId, 
            name: blokName, 
            weeks: weeksInBlok,
            notes: blokNotes
        }; 

        await putData('trainingBlocks', newBlok); // Changed from localStorage
        showMessage('Blok opgeslagen!', 'success');
        currentBlokNameInput.value = '';
        currentBlokNotesInput.value = '';
        blokDropZone.innerHTML = '<p class="text-gray-400 text-center">Sleep weken hierheen om het blok te configureren.</p>';
        renderAllSavedItems(); // Roep de functie aan om de gecombineerde lijst te updaten
    });

    async function loadSavedBloks() { // Added async
        savedBloksList.innerHTML = '';
        const savedBloks = await getAllData('trainingBlocks'); // Changed from localStorage
        if (savedBloks.length === 0) {
            savedBloksList.innerHTML = '<p class="text-gray-400 col-span-full">Nog geen blokken opgeslagen.</p>';
            return;
        }

        savedBloks.forEach(blok => {
            const blokCard = document.createElement('div');
            blokCard.className = 'drag-item bg-gray-600 p-3 rounded-md shadow flex flex-col cursor-grab'; // Changed to drag-item
            blokCard.setAttribute('draggable', 'true');
            blokCard.dataset.id = blok.id;
            blokCard.dataset.name = blok.name;
            blokCard.dataset.type = 'blok';

            const configuredWeeksSummary = blok.weeks.map(week => `${week.name} (${week.repetitions}x)`).join(', ');
            const summaryText = configuredWeeksSummary || 'Geen weken geconfigureerd';
            const notesText = blok.notes ? `<div class="text-xs text-gray-400 mt-1">Notities: ${blok.notes.substring(0, 50)}${blok.notes.length > 50 ? '...' : ''}</div>` : '';


            blokCard.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <span><i class="fas fa-layer-group mr-2 text-cyan-300"></i>${blok.name}</span>
                    <button class="remove-saved-item-btn text-red-400 hover:text-red-300" data-id="${blok.id}" data-list="trainingBlocks"><i class="fas fa-times"></i></button>
                </div>
                <div class="element-settings hidden flex flex-col mt-2">
                     <div class="flex items-center space-x-2 w-full">
                        <span class="text-sm text-gray-300">Herhalingen:</span>
                        <input type="number" value="${blok.repetitions || 1}" min="1" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-repetitions-input>
                    </div>
                    <div class="text-xs text-gray-300 mt-2">
                        ${summaryText}
                    </div>
                </div>
                ${notesText}
            `;
            savedBloksList.appendChild(blokCard);
            addEventListenersToDroppedItem(blokCard);
        });
        addRemoveListenersToSavedItems();
    }

    // Functie voor het verwijderen van opgeslagen items (algemeen)
    async function addRemoveListenersToSavedItems() { // Added async
        document.querySelectorAll('.remove-saved-item-btn').forEach(button => {
            button.addEventListener('click', async (e) => { // Added async
                const idToRemove = e.target.closest('button').dataset.id;
                const listName = e.target.closest('button').dataset.list;
                
                try {
                    await deleteData(listName, idToRemove); // Changed from localStorage
                    showMessage('Item verwijderd!', 'info');
                    // Herlaad de juiste lijst
                    if (listName === 'trainingDays') loadSavedDays();
                    if (listName === 'trainingWeeks') loadSavedWeeks();
                    if (listName === 'trainingBlocks') loadSavedBloks(); 
                    if (listName === 'customMeasurements') loadCustomMeasurements();
                    renderAllSavedItems(); // Update de gecombineerde lijst na verwijdering
                } catch (error) {
                    console.error("Error deleting item:", error);
                    showMessage('Fout bij verwijderen item.', 'error');
                }
            });
        });
    }

    // --- Knoppen om nieuwe drag-items te maken (met kopieeroptie) ---
    async function createNewItem(type, namePrompt, listName, icon, color) { // Added async
        const copyOption = confirm(`Wil je kopiëren van een bestaande ${type}?`);
        let itemName = '';
        let contentToCopy = (type === 'day' || type === 'custom-training-measurement') ? [] : {}; 

        if (copyOption) {
            const itemIdToCopy = prompt(`Voer de ID in van de ${type} die je wilt kopiëren:`);
            if (itemIdToCopy) {
                const itemToCopy = await getData(listName, itemIdToCopy); // Changed from localStorage
                if (itemToCopy) {
                    itemName = prompt(`${namePrompt} (kopie van "${itemToCopy.name}"):`);
                    if (itemName) {
                        contentToCopy = JSON.parse(JSON.stringify(itemToCopy.activities || itemToCopy.days || itemToCopy.weeks || itemToCopy.customMeasurementDefinition));
                        if (type === 'blok' && itemToCopy.notes) { // Corrected type to 'blok'
                            contentToCopy.notes = itemToCopy.notes;
                        }
                    }
                } else {
                    showMessage(`${type} met opgegeven ID niet gevonden.`, 'error');
                    return;
                }
            } else {
                return; 
            }
        } else {
            itemName = prompt(namePrompt);
        }
        
        if (itemName) {
            const itemId = generateUniqueId();
            const newItemElement = document.createElement('div');
            newItemElement.className = 'drag-item';
            newItemElement.setAttribute('draggable', 'true');
            newItemElement.dataset.type = type;
            newItemElement.dataset.id = itemId;
            newItemElement.dataset.name = itemName;
            newItemElement.dataset.icon = icon;
            
            if (type === 'custom-training-measurement') {
                newItemElement.dataset.customMeasurementType = 'training';
                newItemElement.dataset.customMeasurementDefinition = JSON.stringify(contentToCopy);
                newItemElement.dataset.content = '[]';
            } else if (type === 'custom-rest-measurement') {
                newItemElement.dataset.customMeasurementType = 'rest';
                newItemElement.dataset.customMeasurementDescription = contentToCopy.customMeasurementDescription || '';
                newItemElement.dataset.customMeasurementGoals = contentToCopy.customMeasurementGoals || '';
                newItemElement.dataset.content = '[]';
            } else {
                newItemElement.dataset.content = JSON.stringify(contentToCopy);
            }


            newItemElement.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <span><i class="${icon} mr-2 ${color}"></i>${itemName}</span>
                    <i class="fas fa-grip-vertical text-gray-400"></i>
                </div>
            `;
            document.getElementById('available-modules').appendChild(newItemElement);
            
            attachDragStartListener(newItemElement); // Koppel dragstart aan het nieuw gemaakte item
            showMessage(`Nieuwe ${type} '${itemName}' gemaakt!`, 'success');
        }
    }

    document.getElementById('create-day-btn').addEventListener('click', () => {
        createNewItem('day', 'Naam voor de nieuwe dag:', 'trainingDays', 'fas fa-calendar-day', 'text-blue-300'); // Changed listName
    });

    document.getElementById('create-week-btn').addEventListener('click', () => {
        createNewItem('week', 'Naam voor de nieuwe week:', 'trainingWeeks', 'fas fa-calendar-week', 'text-purple-300'); // Changed listName
    });

    document.getElementById('create-block-btn').addEventListener('click', () => {
        createNewItem('blok', 'Naam voor het nieuwe blok:', 'trainingBlocks', 'fas fa-layer-group', 'text-cyan-300'); // Changed listName and type to 'blok'
    });

    // Genereer tijdlabels voor de dagweergave
    function generateTimeLabels() {
        const timeLabelsContainer = document.getElementById('day-time-labels');
        if (!timeLabelsContainer) { // Add null check
            console.error("Element with ID 'day-time-labels' not found.");
            return;
        }
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

    // generateTimeLabels() is now called via the tab click event listener

    saveCustomTrainingBtn.addEventListener('click', async () => { // Added async
        const trainingName = customTrainingNameInput.value.trim();
        if (!trainingName) {
            showMessage('Geef de aangepaste training een naam.', 'error');
            return;
        }

        const definition = [];
        let hasError = false;
        customTrainingZonesDropZone.querySelectorAll('.dropped-item').forEach(item => {
            const itemType = item.dataset.type;
            const subItem = {
                type: itemType,
                name: item.dataset.name,
                icon: item.querySelector('i').className,
                zoneColor: item.dataset.zoneColor || '',
                inputType: item.dataset.inputType || null,
                progressionEnabled: item.querySelector('[data-progression-checkbox]') ? item.querySelector('[data-progression-checkbox]').checked : false,
                notes: item.querySelector('[data-notes-input]') ? item.querySelector('[data-notes-input]').value : ''
            };

            if (itemType === 'hr-zone') {
                const durationInput = item.querySelector('[data-duration-input]');
                const duration = parseInt(durationInput.value);
                if (isNaN(duration) || duration <= 0) {
                    hasError = true;
                    showMessage('Vul een geldige duur (in minuten) in voor alle HR zones in de training.', 'error');
                    return;
                }
                subItem.duration = duration;
                subItem.progressionValue = subItem.progressionEnabled ? parseInt(item.querySelector('[data-progression-value-input]').value) : null;
            } else {
                 const inputTypeSelect = item.querySelector('[data-input-type-select]');
                 subItem.inputType = inputTypeSelect ? inputTypeSelect.value : null;

                 if (subItem.inputType === 'time') {
                     subItem.duration = parseInt(item.querySelector('[data-duration-input]').value);
                     subItem.minTime = parseInt(item.querySelector('[data-min-time-input]').value);
                     subItem.maxTime = parseInt(item.querySelector('[data-max-time-input]').value);
                 } else if (subItem.inputType === 'reps_sets') {
                     subItem.reps = parseInt(item.querySelector('[data-reps-input]').value);
                     subItem.sets = parseInt(item.querySelector('[data-sets-input]').value);
                     subItem.minReps = parseInt(item.querySelector('[data-min-reps-input]').value);
                     subItem.maxReps = parseInt(item.querySelector('[data-max-reps-input]').value);
                     subItem.minSets = parseInt(item.querySelector('[data-min-sets-input]').value);
                     subItem.maxSets = parseInt(item.querySelector('[data-max-sets-input]').value);
                 }
                subItem.progressionValue = subItem.progressionEnabled ? parseInt(item.querySelector('[data-progression-value-input]').value) : null;
            }
            definition.push(subItem);
        });

        if (hasError) {
            return;
        }
        if (definition.length === 0) {
            showMessage('Voeg HR zones of oefeningen toe aan de aangepaste training.', 'error');
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

        await putData('customMeasurements', newCustomTraining); // Changed from localStorage
        showMessage('Aangepaste training opgeslagen!', 'success');
        customTrainingNameInput.value = '';
        customTrainingZonesDropZone.innerHTML = '<p class="text-gray-400 text-center text-sm">Sleep HR zones of oefeningen hierheen om de training te definiëren.</p>';
        loadCustomMeasurements();
    });

    saveCustomRestBtn.addEventListener('click', async () => { // Added async
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

        await putData('customMeasurements', newCustomRest); // Changed from localStorage
        showMessage('Aangepaste rustmeting opgeslagen!', 'success');
        customRestNameInput.value = '';
        customRestDescriptionInput.value = '';
        customRestGoalsInput.value = '';
        loadCustomMeasurements();
    });

    async function loadCustomMeasurements() { // Added async
        const availableModulesContainer = document.getElementById('available-modules');
        availableModulesContainer.querySelectorAll('.drag-item[data-type^="custom-"]').forEach(item => item.remove());

        const savedCustomMeasurements = await getAllData('customMeasurements'); // Changed from localStorage
        const customMeasurementsList = document.getElementById('custom-measurements-list');
        customMeasurementsList.innerHTML = '';

        if (savedCustomMeasurements.length === 0) {
            customMeasurementsList.innerHTML = '<p class="text-gray-400 text-sm">Geen aangepaste metingen.</p>';
            return;
        }

        savedCustomMeasurements.forEach(measurement => {
            const measurementItem = document.createElement('div');
            measurementItem.className = 'drag-item';
            measurementItem.setAttribute('draggable', 'true');
            measurementItem.dataset.type = measurement.type;
            measurementItem.dataset.name = measurement.name;
            measurementItem.dataset.icon = measurement.icon;
            measurementItem.dataset.id = measurement.id;
            measurementItem.dataset.zoneColor = measurement.zoneColor || '';

            if (measurement.customMeasurementType === 'training') {
                measurementItem.dataset.customMeasurementType = 'training';
                measurementItem.dataset.customMeasurementDefinition = JSON.stringify(measurement.customMeasurementDefinition);
            } else if (measurement.customMeasurementType === 'rest') {
                measurementItem.dataset.customMeasurementType = 'rest';
                measurementItem.dataset.customMeasurementDescription = measurement.customMeasurementDescription;
                measurementItem.dataset.customMeasurementGoals = measurement.customMeasurementGoals;
            }

            measurementItem.innerHTML = `
                <span><i class="${measurement.icon} mr-2 ${measurement.zoneColor || ''}"></i>${measurement.name}</span>
                <button class="remove-saved-item-btn text-red-400 hover:text-red-300" data-id="${measurement.id}" data-list="customMeasurements"><i class="fas fa-times"></i></button>
            `;
            availableModulesContainer.appendChild(measurementItem);
            
            attachDragStartListener(measurementItem); // Koppel dragstart aan het nieuw gemaakte item

            customMeasurementsList.appendChild(measurementItem.cloneNode(true));
        });
        addRemoveListenersToSavedItems();
        // Update de zichtbaarheid van de zijbalk na het laden van items
        updateSidebarVisibility(document.querySelector('.tab-button.active').dataset.tab);
    }

    document.getElementById('settings-btn').addEventListener('click', () => {
        showMessage('Globale instellingen functionaliteit komt hier (nog niet geïmplementeerd).', 'info');
    });

    categorySelect.addEventListener('change', (e) => {
        const selectedCategory = e.target.value;
        categoryContents.forEach(contentDiv => {
            if (contentDiv.id === `category-${selectedCategory}`) {
                contentDiv.classList.add('active');
                contentDiv.style.display = 'block'; // Zorg dat de geselecteerde categorie zichtbaar is
                contentDiv.querySelectorAll('.drag-item').forEach(item => item.style.display = 'flex'); // Toon items in de categorie
            } else {
                contentDiv.classList.remove('active');
                contentDiv.style.display = 'none'; // Verberg andere categorieën
            }
        });
    });

    // Event listener voor inklapbare headers
    document.addEventListener('click', (event) => {
        const header = event.target.closest('.collapsible-header');
        if (header) {
            const targetId = header.dataset.collapsibleTarget;
            const content = document.getElementById(targetId);
            if (content) {
                header.classList.toggle('collapsed');
                content.classList.toggle('expanded');
            }
        }
    });

    // Initialiseer bij het laden van de view
    (async function() {
        const userRole = await getUserRole(currentUserId);
        if (userRole === 'admin') {
            if (formBuilderTab) formBuilderTab.style.display = 'block';
            if (formBuilderTabButton) formBuilderTabButton.style.display = 'block';
        } else {
            if (formBuilderTab) formBuilderTab.style.display = 'none';
            if (formBuilderTabButton) formBuilderTabButton.style.display = 'none';
        }
        // Activeer de Dag tab bij het laden van de pagina
        document.querySelector('.tab-button[data-tab="dag"]').click();
        renderAllSavedItems(); // Laad alle opgeslagen items bij opstart
        // Open de eerste inklapbare sectie standaard
        const firstCollapsibleHeader = document.querySelector('.collapsible-header');
        if (firstCollapsibleHeader) {
            firstCollapsibleHeader.click(); // Simuleer een klik om de sectie te openen
        }
    })();
}
