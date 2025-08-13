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
    const savedSessionsList = document.getElementById('saved-sessions-list'); // Nieuw: lijst voor opgeslagen sessies

    const tabContents = document.querySelectorAll('.tab-content');
    const tabButtons = document.querySelectorAll('.tab-button');
    const formBuilderTab = document.getElementById('tab-form-builder');
    const formBuilderTabButton = document.querySelector('.tab-button[data-tab="form-builder"]');
    const sessionBuilderTab = document.getElementById('tab-session-builder'); // NEW
    const sessionBuilderTabButton = document.querySelector('.tab-button[data-tab="session-builder"]'); // NEW

    const categorySelect = document.getElementById('category-select');
    const categoryContents = document.querySelectorAll('.category-content');

    // NEW Session Builder Elements
    const currentSessionNameInput = document.getElementById('current-session-name');
    const sessionDropZone = document.getElementById('session-drop-zone');
    const saveSessionBtn = document.getElementById('save-session-btn');
    // const sessionTimeLabelsContainer = document.getElementById('session-time-labels'); // Removed as per new requirement


    let currentUserId = getOrCreateUserId(); // Haal de huidige gebruiker ID op

    // Functie om de zichtbaarheid van de zijbalk te updaten op basis van het actieve tabblad
    function updateSidebarVisibility(activeTabId) {
        const categorySelectContainer = document.querySelector('.category-select-container');
        const createSessionBtn = document.getElementById('create-session-btn'); // NEW
        const createDayBtn = document.getElementById('create-day-btn');
        const createWeekBtn = document.getElementById('create-week-btn');
        const createBlockBtn = document.getElementById('create-block-btn');

        // Hide all category content divs initially
        categoryContents.forEach(el => el.style.display = 'none');
        // Hide all individual drag-items within availableModulesContainer
        availableModulesContainer.querySelectorAll('.drag-item').forEach(el => el.style.display = 'none');

        // Hide all "Create New..." buttons initially
        if (createSessionBtn) createSessionBtn.style.display = 'none'; // NEW
        if (createDayBtn) createDayBtn.style.display = 'none';
        if (createWeekBtn) createWeekBtn.style.display = 'none';
        if (createBlockBtn) createBlockBtn.style.display = 'none';
        
        // Hide category select container initially
        if (categorySelectContainer) categorySelectContainer.style.display = 'none';
        // Hide the combined list initially
        if (allSavedItemsList) allSavedItemsList.style.display = 'none';
        // Hide custom measurements list initially (it has its own category now)
        if (customMeasurementsList) customMeasurementsList.style.display = 'none';


        if (activeTabId === 'tab-session-builder') { // NEW: Sessie Bouwer
            if (categorySelectContainer) categorySelectContainer.style.display = 'block';
            // Show the currently selected category content (individual elements)
            const selectedCategory = categorySelect.value;
            const activeCategoryContent = document.getElementById(`category-${selectedCategory}`);
            if (activeCategoryContent) {
                activeCategoryContent.style.display = 'block';
                activeCategoryContent.querySelectorAll('.drag-item').forEach(el => el.style.display = 'flex');
            }
            // Show "Create New Session" button
            if (createSessionBtn) createSessionBtn.style.display = 'block'; // NEW
        } else if (activeTabId === 'tab-dag') { // Dag tab
            if (allSavedItemsList) allSavedItemsList.style.display = 'block';
            allSavedItemsList.querySelectorAll('.drag-item').forEach(el => {
                // Only show saved configured sessions and saved days on the "Dag" tab
                if (el.dataset.type === 'configured-session' || el.dataset.type === 'day') {
                    el.style.display = 'flex';
                } else {
                    el.style.display = 'none';
                }
            });
            // Show "Create New Day" button
            if (createDayBtn) createDayBtn.style.display = 'block';
        } else if (activeTabId === 'tab-week') { // Week tab
            if (allSavedItemsList) allSavedItemsList.style.display = 'block';
            allSavedItemsList.querySelectorAll('.drag-item').forEach(el => {
                // Only show saved days on the "Week" tab
                if (el.dataset.type === 'day') {
                    el.style.display = 'flex';
                } else {
                    el.style.display = 'none';
                }
            });
            // Show "Create New Week" button
            if (createWeekBtn) createWeekBtn.style.display = 'block';
        } else if (activeTabId === 'tab-blok') { // Blok tab
            if (allSavedItemsList) allSavedItemsList.style.display = 'block';
            allSavedItemsList.querySelectorAll('.drag-item').forEach(el => {
                // Only show saved weeks on the "Blok" tab
                if (el.dataset.type === 'week') {
                    el.style.display = 'flex';
                } else {
                    el.style.display = 'none';
                }
            });
            // Show "Create New Block" button
            if (createBlockBtn) createBlockBtn.style.display = 'block';
        } else if (activeTabId === 'tab-form-builder') { // Form Builder tab
            if (customMeasurementsList) customMeasurementsList.style.display = 'block';
            customMeasurementsList.querySelectorAll('.drag-item').forEach(el => el.style.display = 'flex');
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
                    setTimeout(() => generateTimeLabels('day-time-labels'), 0); // Generate for day tab
                }
                // Removed generateTimeLabels for session-builder as it's no longer a timeline
            }, 10);
            
            // Update de zichtbaarheid van de zijbalk
            updateSidebarVisibility(activeTabId);
            
            // Laad opgeslagen items wanneer van tabblad wordt gewisseld
            renderAllSavedItems(); // Roep de functie aan om de gecombineerde lijst te updaten
            loadCustomMeasurements(); // Laad aangepaste metingen
            loadSavedSessions(); // NEW: Load saved sessions for Session Builder tab
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
            
            // FIX: Voeg null/undefined/empty string checks toe voordat JSON.parse wordt aangeroepen
            if (draggableItem.dataset.content && draggableItem.dataset.content !== "undefined" && draggableItem.dataset.content !== "") {
                try {
                    draggedItemData.content = JSON.parse(draggableItem.dataset.content);
                } catch (error) {
                    console.error("Fout bij het parsen van draggedItemData.content:", error);
                    draggedItemData.content = null;
                }
            } else {
                draggedItemData.content = null;
            }
            if (draggableItem.dataset.customMeasurementDefinition && draggableItem.dataset.customMeasurementDefinition !== "undefined" && draggableItem.dataset.customMeasurementDefinition !== "") {
                try {
                    draggedItemData.customMeasurementDefinition = JSON.parse(draggableItem.dataset.customMeasurementDefinition);
                }
                catch (error) {
                    console.error("Fout bij het parsen van draggedItemData.customMeasurementDefinition:", error);
                    draggedItemData.customMeasurementDefinition = null;
                }
            } else {
                draggedItemData.customMeasurementDefinition = null;
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
    // Dit moet gebeuren voor alle drag-items in de sidebar
    document.querySelectorAll('#available-modules .drag-item').forEach(item => {
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

            if (dropZoneId === 'session-drop-zone') { // NEW: Sessie Bouwer drop zone
                expectedTypes = ['hr-zone', 'rest-day', 'training-measurement', 'rest-measurement-free', 'rest-measurement-base', 'document-link', 'custom-training-measurement', 'custom-rest-measurement', 'strength-exercise', 'recovery-activity', 'coordination-activity', 'flexibility-activity', 'speed-activity', 'nutrition-activity'];
                if (expectedTypes.includes(data.type)) {
                    isValidDrop = true;
                }
            } else if (dropZoneId === 'day-drop-zone') { // Dag drop zone: accepteert alleen opgeslagen sessies of dagen
                expectedTypes = ['configured-session', 'day'];
                if (expectedTypes.includes(data.type)) {
                    isValidDrop = true;
                }
            } else if (dropZoneClasses.contains('day-slot')) { // Week tab: accepteert alleen dagen
                expectedTypes = ['day'];
                if (data.type === 'day') {
                    isValidDrop = true;
                }
            } else if (dropZoneClasses.contains('week-slot')) { // Blok tab: accepteert alleen weken
                expectedTypes = ['week'];
                if (data.type === 'week') { 
                    isValidDrop = true;
                }
            } else if (dropZoneId === 'blok-drop-zone') { // Blok drop zone: accepteert alleen weken
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
            if (dropZoneId === 'session-drop-zone') {
                createStackedItemForDropZone(zone, data); // Always stacked for session builder
            } else if (dropZoneId === 'custom-training-zones-drop-zone') {
                createTimelineItemForDropZone(relativeY, zone, data); // Still timeline for custom training zones
            } else if (dropZoneId === 'day-drop-zone') {
                createDayDroppedItem(zone, data); // Stacked for day tab
            } else { // Handles days for week and weeks for block
                createStackedItemForDropZone(zone, data);
            }
            isDraggingExistingItem = false; // Reset de vlag na de drop
            originalParent = null; // Reset de oorspronkelijke ouder
        });
    });

    // Function to create items for Session Builder and other stacked drop zones (no absolute positioning)
    function createStackedItemForDropZone(zone, data) {
        const droppedItem = document.createElement('div');
        droppedItem.dataset.id = data.id || generateUniqueId();
        droppedItem.dataset.type = data.type;
        droppedItem.dataset.name = data.name;
        droppedItem.dataset.content = (data.content && (typeof data.content === 'object' || Array.isArray(data.content))) ? JSON.stringify(data.content) : '';
        if (data.zoneColor) droppedItem.dataset.zoneColor = data.zoneColor;
        if (data.documentName) droppedItem.dataset.documentName = data.documentName;
        if (data.customMeasurementType) droppedItem.dataset.customMeasurementType = data.customMeasurementType;
        droppedItem.dataset.customMeasurementDefinition = (data.customMeasurementDefinition && (typeof data.customMeasurementDefinition === 'object' || Array.isArray(data.customMeasurementDefinition))) ? JSON.stringify(data.customMeasurementDefinition) : '';
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

        droppedItem.setAttribute('draggable', 'true');

        let innerHtmlContent = `
            <div class="element-header flex items-center justify-between w-full">
                <span><i class="${data.icon} mr-2 ${data.zoneColor || ''}"></i>${data.name}</span>
                <button class="remove-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="element-settings hidden flex flex-col mt-2">
        `;

        if (data.type === 'hr-zone') {
            droppedItem.classList.add('hr-zone-bar'); // Apply specific class for styling
            innerHtmlContent += `
                <div class="flex items-center space-x-2 ml-auto w-full md:w-auto flex-wrap">
                    <input type="number" placeholder="Minuten" class="w-20 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-duration-input value="${data.duration || ''}">
                    <label class="flex items-center text-sm text-gray-300">
                        <input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" data-progression-checkbox ${data.progressionEnabled ? 'checked' : ''}>
                        <span class="ml-1">Wekelijks toenemen?</span>
                    </label>
                    <input type="number" placeholder="Waarde" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-progression-value-input value="${data.progressionValue || ''}" ${!data.progressionEnabled ? 'disabled' : ''}>
                    <input type="text" placeholder="Notities" class="w-24 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-notes-input value="${data.notes || ''}">
                </div>
            `;
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
        } else if (data.type === 'custom-training-measurement' || data.type === 'custom-rest-measurement') {
            // No specific settings for these when dropped, as their definition is already encapsulated
            // The nested items will be rendered by renderCustomMeasurementInDay
        } else if (data.type === 'document-link') {
            // No specific settings for document link when dropped
        } else if (data.type === 'rest-day' || data.type === 'training-measurement' || data.type === 'rest-measurement-free' || data.type === 'rest-measurement-base') {
            // No specific settings for these when dropped
        }

        innerHtmlContent += `</div>`; // Sluit element-settings
        droppedItem.innerHTML = innerHtmlContent;
        
        // For session-drop-zone, items are now stacked, not absolutely positioned
        droppedItem.className = `dropped-item flex flex-col p-2 mb-1 rounded-md bg-gray-700`;
        // Remove absolute positioning styles
        droppedItem.style.top = '';
        droppedItem.style.left = '';
        droppedItem.style.width = '';
        droppedItem.style.position = '';

        zone.appendChild(droppedItem);
        attachDragStartListener(droppedItem); // Koppel dragstart aan het nieuw geplaatste item
        addEventListenersToDroppedItem(droppedItem);
        showMessage(`${data.name} toegevoegd!`, 'success');
    }

    // Function to create items for Custom Training Zones (still timeline items with absolute positioning)
    function createTimelineItemForDropZone(yPosition, zone, data) {
        const droppedItem = document.createElement('div');
        droppedItem.dataset.id = data.id || generateUniqueId();
        droppedItem.dataset.type = data.type;
        droppedItem.dataset.name = data.name;
        droppedItem.dataset.content = (data.content && (typeof data.content === 'object' || Array.isArray(data.content))) ? JSON.stringify(data.content) : '';
        if (data.zoneColor) droppedItem.dataset.zoneColor = data.zoneColor;
        if (data.documentName) droppedItem.dataset.documentName = data.documentName;
        if (data.customMeasurementType) droppedItem.dataset.customMeasurementType = data.customMeasurementType;
        droppedItem.dataset.customMeasurementDefinition = (data.customMeasurementDefinition && (typeof data.customMeasurementDefinition === 'object' || Array.isArray(data.customMeasurementDefinition))) ? JSON.stringify(data.customMeasurementDefinition) : '';
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

        droppedItem.setAttribute('draggable', 'true');

        let innerHtmlContent = `
            <div class="element-header flex items-center justify-between w-full">
                <span><i class="${data.icon} mr-2 ${data.zoneColor || ''}"></i>${data.name}</span>
                <button class="remove-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="element-settings hidden flex flex-col mt-2">
        `;

        if (data.type === 'hr-zone') {
            droppedItem.classList.add('hr-zone-bar'); // Apply specific class for styling
            innerHtmlContent += `
                <div class="flex items-center space-x-2 ml-auto w-full md:w-auto flex-wrap">
                    <input type="number" placeholder="Minuten" class="w-20 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-duration-input value="${data.duration || ''}">
                    <label class="flex items-center text-sm text-gray-300">
                        <input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" data-progression-checkbox ${data.progressionEnabled ? 'checked' : ''}>
                        <span class="ml-1">Wekelijks toenemen?</span>
                    </label>
                    <input type="number" placeholder="Waarde" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-progression-value-input value="${data.progressionValue || ''}" ${!data.progressionEnabled ? 'disabled' : ''}>
                    <input type="text" placeholder="Notities" class="w-24 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-notes-input value="${data.notes || ''}">
                </div>
            `;
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
        droppedItem.className = `timeline-item flex flex-col p-2 mb-1 rounded-md bg-gray-700`;
        droppedItem.style.top = `${yPosition}px`;
        droppedItem.style.left = '0';
        droppedItem.style.width = '100%';
        droppedItem.style.position = 'absolute';

        zone.appendChild(droppedItem);
        attachDragStartListener(droppedItem);
        addEventListenersToDroppedItem(droppedItem);
        showMessage(`${data.name} toegevoegd!`, 'success');
    }

    // NEW: Function to create items for Day tab (only accepts configured-session or day)
    function createDayDroppedItem(zone, data) { // Removed yPosition as it's not needed for stacked items
        const droppedItem = document.createElement('div');
        droppedItem.dataset.id = data.id;
        droppedItem.dataset.type = data.type;
        droppedItem.dataset.name = data.name;
        droppedItem.dataset.icon = data.icon;
        droppedItem.dataset.content = (data.content && (typeof data.content === 'object' || Array.isArray(data.content))) ? JSON.stringify(data.content) : '';
        if (data.zoneColor) droppedItem.dataset.zoneColor = data.zoneColor; // For configured-session color

        droppedItem.setAttribute('draggable', 'true'); // Maak geplaatste items draggable

        let innerHtmlContent = `
            <div class="element-header flex items-center justify-between w-full">
                <span><i class="${data.icon} mr-2 ${data.zoneColor || ''}"></i>${data.name}</span>
                <button class="remove-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="element-settings hidden flex flex-col mt-2">
        `;

        if (data.type === 'configured-session') {
            // Display summary of configured session
            let summaryHtml = '';
            const parsedContent = (data.content && typeof data.content === 'string' && data.content !== "undefined" && data.content !== "") ? JSON.parse(data.content) : [];
            if (parsedContent && Array.isArray(parsedContent)) {
                const names = parsedContent.map(item => item.name).join(', ');
                summaryHtml = `<div class="text-xs text-gray-400 mt-1">Bevat: ${names}</div>`;
            }
            innerHtmlContent += summaryHtml;
        } else if (data.type === 'day') {
            // Display summary of day (if dragging an existing saved day)
            let summaryHtml = '';
            const parsedContent = (data.content && typeof data.content === 'string' && data.content !== "undefined" && data.content !== "") ? JSON.parse(data.content) : [];
            if (parsedContent && Array.isArray(parsedContent)) {
                const activityNames = parsedContent.map(act => act.name).join(', ');
                summaryHtml = `<div class="text-xs text-gray-400 mt-1">Activiteiten: ${activityNames}</div>`;
            }
            innerHtmlContent += summaryHtml;
        }
        
        innerHtmlContent += `</div>`; // Sluit element-settings
        droppedItem.innerHTML = innerHtmlContent;
        
        // For day-drop-zone, items are stacked, not absolutely positioned
        droppedItem.className = 'dropped-item flex flex-col p-2 mb-1 rounded-md bg-gray-700';

        zone.appendChild(droppedItem);
        attachDragStartListener(droppedItem);
        addEventListenersToDroppedItem(droppedItem);
        showMessage(`${data.name} toegevoegd aan dag!`, 'success');
    }


    // Renamed from createWeekOrBlockDroppedItem to be more semantically correct for stacked items
    function createStackedItemForDropZone(zone, data) { // Removed yPosition param
        const droppedItem = document.createElement('div');
        droppedItem.className = 'dropped-item flex flex-col p-2 mb-2 rounded-md bg-gray-700';
        droppedItem.dataset.id = data.id;
        droppedItem.dataset.type = data.type;
        droppedItem.dataset.name = data.name;
        droppedItem.dataset.icon = data.icon;
        droppedItem.dataset.content = (data.content && (typeof data.content === 'object' || Array.isArray(data.content))) ? JSON.stringify(data.content) : '';

        droppedItem.setAttribute('draggable', 'true'); // Maak geplaatste items draggable

        let innerHtmlContent = `
            <div class="element-header flex items-center justify-between w-full">
                <span><i class="${data.icon} mr-2"></i>${data.name}</span>
                <button class="remove-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="element-settings hidden flex flex-col mt-2">
        `;

        if (data.type === 'week' && zone.id === 'blok-drop-zone') { // Check zone.id for specific logic
            innerHtmlContent += `
                <div class="flex items-center space-x-2 w-full">
                    <span class="text-sm text-gray-300">Herhalingen:</span>
                    <input type="number" value="${data.repetitions || 1}" min="1" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-repetitions-input>
                    <span class="text-sm text-gray-300 ml-2">Herhaal elke:</span>
                    <input type="number" value="${data.repetitionStep || 1}" min="1" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-repetition-step-input>
                    <span class="text-sm text-gray-300 ml-1">weken</span>
                </div>
            `;
        } else if (data.type === 'day' && zone.classList.contains('day-slot')) { // Check zone.classList for specific logic
            // Samenvatting voor dag in kalenderweergave
            let summaryHtml = '';
            const parsedContent = (data.content && typeof data.content === 'string' && data.content !== "undefined" && data.content !== "") ? JSON.parse(data.content) : [];
            if (parsedContent && Array.isArray(parsedContent)) {
                const hrZonesSummary = parsedContent.filter(act => act.type === 'hr-zone').map(hrz => `${hrz.name} (${hrz.duration} min)`).join(', ');
                const otherActivities = parsedContent.filter(act => act.type !== 'hr-zone').map(act => act.name).join(', ');
                summaryHtml = `<div class="text-xs text-gray-400 mt-1">${hrZonesSummary}${otherActivities ? (hrZonesSummary ? '; ' : '') + otherActivities : ''}</div>`;
            }
            innerHtmlContent += summaryHtml;
        }

        innerHtmlContent += `</div>`; // Sluit element-settings
        droppedItem.innerHTML = innerHtmlContent;
        zone.innerHTML = ''; // Clear placeholder if any
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
        customMeasurementCard.dataset.customMeasurementDefinition = (data.customMeasurementDefinition && (typeof data.customMeasurementDefinition === 'object' || Array.isArray(data.customMeasurementDefinition))) ? JSON.stringify(data.customMeasurementDefinition) : '';
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
                    <input type="number" placeholder="Waarde" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-progression-value-input value="${item.progressionValue || ''}" ${!item.progressionEnabled ? 'disabled' : ''}>
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
            if (zone.id === 'session-drop-zone') { // NEW: Placeholder for session builder
                newPlaceholder.textContent = 'Sleep individuele activiteiten of HR-zones hierheen om de sessie te configureren.';
            } else if (zone.id === 'day-drop-zone') { // NEW: Placeholder for day tab
                newPlaceholder.textContent = 'Sleep opgeslagen sessies of dagen hierheen om de dag te configureren.';
            } else if (zone.classList.contains('day-slot')) {
                newPlaceholder.textContent = 'Sleep dag hier';
            } else if (zone.classList.contains('week-slot')) {
                newPlaceholder.textContent = 'Sleep week hier';
            } else if (zone.id === 'blok-drop-zone') {
                newPlaceholder.textContent = 'Sleep weken hierheen om het blok te configureren.';
            } else if (zone.id === 'custom-training-zones-drop-zone') { 
                newPlaceholder.textContent = 'Sleep HR zones of oefeningen hierheen om de training te definiëren.';
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

        if (Array.isArray(contentData)) { // Voor Sessie Bouwer, Dag (activities array), Custom Training (activities array)
            contentData.forEach(item => {
                if (item.type === 'custom-training-measurement' || item.type === 'custom-rest-measurement') {
                     renderCustomMeasurementInDay(item.topPosition || 0, dropZoneElement, item);
                } else {
                    if (dropZoneElement.id === 'session-drop-zone') {
                        createStackedItemForDropZone(dropZoneElement, item);
                    } else { // This handles custom-training-zones-drop-zone
                        createTimelineItemForDropZone(item.topPosition || 0, dropZoneElement, item);
                    }
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
                        droppedItem.dataset.content = (item.content && (typeof item.content === 'object' || Array.isArray(item.content))) ? JSON.stringify(item.content) : '';

                        droppedItem.setAttribute('draggable', 'true'); // Maak geplaatste items draggable

                        let summaryHtml = '';
                        const parsedContent = (item.content && typeof item.content === 'string' && item.content !== "undefined" && item.content !== "") ? JSON.parse(item.content) : [];
                        if (parsedContent && Array.isArray(parsedContent)) {
                            const hrZonesSummary = parsedContent.filter(act => act.type === 'hr-zone').map(hrz => `${hrz.name} (${hrz.duration} min)`).join(', ');
                            const otherActivities = parsedContent.filter(act => act.type !== 'hr-zone').map(act => act.name).join(', ');
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
                droppedItem.dataset.content = (item.content && (typeof item.content === 'object' || Array.isArray(item.content))) ? JSON.stringify(item.content) : '';
                droppedItem.dataset.repetitions = item.repetitions || 1;
                droppedItem.dataset.repetitionStep = item.repetitionStep || 1; // NEW: repetitionStep

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
                            <span class="text-sm text-gray-300 ml-2">Herhaal elke:</span>
                            <input type="number" value="${item.repetitionStep || 1}" min="1" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-repetition-step-input>
                            <span class="text-sm text-gray-300 ml-1">weken</span>
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

    // --- Render alle opgeslagen items (Dagen, Weken, Blokken, Sessies) in één lijst ---
    async function renderAllSavedItems() {
        if (!allSavedItemsList) {
            console.error("Container for all saved items not found.");
            return;
        }
        allSavedItemsList.innerHTML = ''; // Clear the list

        const savedDays = await getAllData('trainingDays');
        const savedWeeks = await getAllData('trainingWeeks');
        const savedBloks = await getAllData('trainingBlocks');
        const savedConfiguredSessions = await getAllData('configuredSessions'); // NEW

        let allItems = [];

        // Add saved configured sessions
        savedConfiguredSessions.forEach(session => {
            allItems.push({
                ...session,
                type: 'configured-session', // Ensure correct type for filtering
                displayType: 'Sessie',
                sortOrder: 1, // First in the list
                listName: 'configuredSessions'
            });
        });

        // Add saved days
        savedDays.forEach(day => {
            allItems.push({
                ...day,
                type: 'day',
                displayType: 'Dag',
                sortOrder: 2, // After sessions
                listName: 'trainingDays'
            });
        });

        // Add saved weeks
        savedWeeks.forEach(week => {
            allItems.push({
                ...week,
                type: 'week',
                displayType: 'Week',
                sortOrder: 3, // After days
                listName: 'trainingWeeks'
            });
        });

        // Add saved blocks
        savedBloks.forEach(blok => {
            allItems.push({
                ...blok,
                type: 'blok',
                displayType: 'Blok',
                sortOrder: 4, // Last
                listName: 'trainingBlocks'
            });
        });

        // Sort items: configured-session -> day -> week -> block -> custom measurements
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
            itemCard.dataset.content = (item.content && (typeof item.content === 'object' || Array.isArray(item.content))) ? JSON.stringify(item.content) : '';
            if (item.repetitions) itemCard.dataset.repetitions = item.repetitions;
            if (item.customMeasurementType) itemCard.dataset.customMeasurementType = item.customMeasurementType;
            itemCard.dataset.customMeasurementDefinition = (item.customMeasurementDefinition && (typeof item.customMeasurementDefinition === 'object' || Array.isArray(item.customMeasurementDefinition))) ? JSON.stringify(item.customMeasurementDefinition) : '';
            if (item.customMeasurementDescription) itemCard.dataset.customMeasurementDescription = item.customMeasurementDescription;
            if (item.customMeasurementGoals) itemCard.dataset.customMeasurementGoals = item.customMeasurementGoals;
            if (item.repetitionStep) itemCard.dataset.repetitionStep = item.repetitionStep; // NEW: repetitionStep for display


            let summaryText = '';
            if (item.type === 'configured-session' && item.content && Array.isArray(item.content)) {
                const names = item.content.map(subItem => subItem.name).join(', ');
                summaryText = `<div class="text-xs text-gray-400 mt-1">Bevat: ${names}</div>`;
            } else if (item.type === 'day' && item.activities && Array.isArray(item.activities)) {
                const activityNames = item.activities.map(act => act.name).join(', ');
                summaryText = `<div class="text-xs text-gray-400 mt-1">Activiteiten: ${activityNames}</div>`;
            } else if (item.type === 'week' && item.days && typeof item.days === 'object') {
                const configuredDays = Object.values(item.days).filter(day => day !== null).map(day => day.name);
                summaryText = `<div class="text-xs text-gray-400 mt-1">Dagen: ${configuredDays.length > 0 ? configuredDays.join(', ') : 'Geen dagen'}</div>`;
                if (item.repetitionStep && item.repetitionStep > 1) {
                    summaryText += `<div class="text-xs text-gray-400 mt-1">Herhaal elke ${item.repetitionStep} weken</div>`;
                }
            } else if (item.type === 'blok' && item.weeks && Array.isArray(item.weeks)) {
                const configuredWeeks = item.weeks.map(week => {
                    let weekSummary = week.name;
                    if (week.repetitions && week.repetitions > 1) weekSummary += ` (${week.repetitions}x)`;
                    if (week.repetitionStep && week.repetitionStep > 1) weekSummary += ` elke ${week.repetitionStep}w`;
                    return weekSummary;
                }).join(', ');
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

    // NEW: Load and display saved configured sessions
    async function loadSavedSessions() {
        savedSessionsList.innerHTML = '';
        const savedSessions = await getAllData('configuredSessions');
        if (savedSessions.length === 0) {
            savedSessionsList.innerHTML = '<p class="text-gray-400 col-span-full">Nog geen sessies opgeslagen.</p>';
            return;
        }

        savedSessions.forEach(session => {
            const sessionCard = document.createElement('div');
            sessionCard.className = 'drag-item bg-gray-600 p-3 rounded-md shadow flex flex-col cursor-grab';
            sessionCard.setAttribute('draggable', 'true');
            sessionCard.dataset.type = 'configured-session'; // NEW type
            sessionCard.dataset.id = session.id;
            sessionCard.dataset.name = session.name;
            sessionCard.dataset.icon = session.icon || 'fas fa-running'; // Default icon
            sessionCard.dataset.content = (session.activities && Array.isArray(session.activities)) ? JSON.stringify(session.activities) : '';
            sessionCard.dataset.zoneColor = session.zoneColor || ''; // For visual consistency

            let summaryHtml = '';
            if (session.activities && Array.isArray(session.activities)) {
                const activityNames = session.activities.map(act => act.name).join(', ');
                summaryHtml = `<div class="text-xs text-gray-400 mt-1">Bevat: ${activityNames}</div>`;
            }

            sessionCard.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <span><i class="${sessionCard.dataset.icon} mr-2 ${sessionCard.dataset.zoneColor}"></i>${session.name}</span>
                    <button class="remove-saved-item-btn text-red-400 hover:text-red-300" data-id="${session.id}" data-list="configuredSessions"><i class="fas fa-times"></i></button>
                </div>
                ${summaryHtml}
            `;
            savedSessionsList.appendChild(sessionCard);
            attachDragStartListener(sessionCard);
        });
        addRemoveListenersToSavedItems(); // Re-attach listeners
    }


    // --- Opslaan en Laden van Schema's (via IndexedDB) ---

    // NEW: Save Session (from Session Builder)
    if (saveSessionBtn) {
        saveSessionBtn.addEventListener('click', async () => {
            const sessionName = currentSessionNameInput.value.trim();
            if (!sessionName) {
                showMessage('Geef de sessie een naam.', 'error');
                return;
            }

            const activities = [];
            let hasError = false;
            sessionDropZone.querySelectorAll('.dropped-item').forEach(item => { // Use .dropped-item for stacked items
                const activity = {
                    type: item.dataset.type,
                    name: item.dataset.name,
                    icon: item.querySelector('.element-header i').className,
                    zoneColor: item.dataset.zoneColor || '',
                    // For stacked items, topPosition is not relevant for saving
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
                    activity.customMeasurementType = item.dataset.customMeasurementType;
                    activity.customMeasurementDescription = item.dataset.customMeasurementDescription || null;
                    activity.customMeasurementGoals = item.dataset.customMeasurementGoals || null;
                    // For custom measurements, their definition is already stored. We just need to reference it.
                    // The content of the custom measurement is in its customMeasurementDefinition dataset.
                    activity.customMeasurementDefinition = (item.dataset.customMeasurementDefinition && item.dataset.customMeasurementDefinition !== "undefined" && item.dataset.customMeasurementDefinition !== "") ? JSON.parse(item.dataset.customMeasurementDefinition) : null;
                }
                activities.push(activity);
            });

            if (hasError) {
                return;
            }
            if (activities.length === 0) {
                showMessage('Voeg activiteiten toe aan de sessie.', 'error');
                return;
            }

            // No sorting by topPosition for stacked items
            // activities.sort((a, b) => a.topPosition - b.topPosition);

            const sessionId = generateUniqueId();
            const newSession = { id: sessionId, name: sessionName, activities: activities };

            await putData('configuredSessions', newSession); // Save to new store
            showMessage('Sessie opgeslagen!', 'success');
            currentSessionNameInput.value = '';
            sessionDropZone.innerHTML = '<p class="text-gray-400 text-center">Sleep individuele activiteiten of HR-zones hierheen om de sessie te configureren.</p>';
            loadSavedSessions(); // Reload saved sessions list
            renderAllSavedItems(); // Update combined list in sidebar
        });
    }

    // Dagen
    const currentDayNameInput = document.getElementById('current-day-name');
    const dayDropZone = document.getElementById('day-drop-zone');
    const saveDayBtn = document.getElementById('save-day-btn');
    const savedDaysList = document.getElementById('saved-days-list');

    saveDayBtn.addEventListener('click', async () => {
        const dayName = currentDayNameInput.value.trim();
        if (!dayName) {
            showMessage('Geef de dag een naam.', 'error');
            return;
        }

        const activities = []; // For the Day tab, these are now configured sessions or existing days
        let hasError = false;
        dayDropZone.querySelectorAll('.dropped-item').forEach(item => { // Use .dropped-item for day tab
            const activity = {
                id: item.dataset.id,
                type: item.dataset.type, // Will be 'configured-session' or 'day'
                name: item.dataset.name,
                icon: item.dataset.icon,
                content: (item.dataset.content && item.dataset.content !== "undefined" && item.dataset.content !== "") ? JSON.parse(item.dataset.content) : null,
                zoneColor: item.dataset.zoneColor || ''
            };
            activities.push(activity);
        });

        if (hasError) {
            return;
        }

        if (activities.length === 0) {
            showMessage('Voeg sessies of dagen toe aan de dag.', 'error'); // Updated message
            return;
        }

        const dayId = generateUniqueId();
        const newDay = { id: dayId, name: dayName, activities: activities }; // Activities here are references to sessions/days

        await putData('trainingDays', newDay);
        showMessage('Dag opgeslagen!', 'success');
        currentDayNameInput.value = '';
        dayDropZone.innerHTML = '<p class="text-gray-400 text-center">Sleep opgeslagen sessies of dagen hierheen om de dag te configureren.</p>'; // Updated placeholder
        renderAllSavedItems();
    });

    async function loadSavedDays() {
        savedDaysList.innerHTML = '';
        const savedDays = await getAllData('trainingDays');
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
            dayCard.dataset.content = (day.activities && Array.isArray(day.activities)) ? JSON.stringify(day.activities) : '';

            let summaryText = '';
            if (day.activities && Array.isArray(day.activities)) {
                const activityNames = day.activities.map(act => act.name).join(', ');
                summaryText = `<div class="text-xs text-gray-400 mt-1">Bevat: ${activityNames}</div>`;
            }

            dayCard.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <span><i class="${dayCard.dataset.icon} mr-2 text-blue-300"></i>${day.name}</span>
                    <button class="remove-saved-item-btn text-red-400 hover:text-red-300" data-id="${day.id}" data-list="trainingDays"><i class="fas fa-times"></i></button>
                </div>
                ${summaryText}
            `;
            savedDaysList.appendChild(dayCard);
            attachDragStartListener(dayCard);
        });
        addRemoveListenersToSavedItems();
    }

    // Weken
    const currentWeekNameInput = document.getElementById('current-week-name');
    const weekDaySlots = document.querySelectorAll('.day-slot');
    const saveWeekBtn = document.getElementById('save-week-btn');
    const savedWeeksList = document.getElementById('saved-weeks-list');

    saveWeekBtn.addEventListener('click', async () => {
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
                    content: (droppedDay.dataset.content && typeof droppedDay.dataset.content === 'string' && droppedDay.dataset.content !== "undefined" && droppedDay.dataset.content !== "") ? JSON.parse(droppedDay.dataset.content) : null
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

        await putData('trainingWeeks', newWeek);
        showMessage('Week opgeslagen!', 'success');
        currentWeekNameInput.value = '';
        weekDaySlots.forEach(slot => {
            slot.innerHTML = '<p class="text-gray-400 text-center text-sm">Sleep dag hier</p>';
        });
        renderAllSavedItems();
    });

    async function loadSavedWeeks() {
        savedWeeksList.innerHTML = '';
        const savedWeeks = await getAllData('trainingWeeks');
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
            weekCard.dataset.content = (week.days && typeof week.days === 'object') ? JSON.stringify(week.days) : '';
            if (week.repetitionStep) weekCard.dataset.repetitionStep = week.repetitionStep; // NEW: repetitionStep for display

            const configuredDays = Object.values(week.days).filter(day => day !== null).map(day => day.name);
            let summaryText = configuredDays.length > 0 ? configuredDays.join(', ') : 'Geen dagen geconfigureerd';
            if (week.repetitionStep && week.repetitionStep > 1) {
                summaryText += ` (elke ${week.repetitionStep} weken)`;
            }

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
            attachDragStartListener(weekCard);
        });
        addRemoveListenersToSavedItems();
    }

    // Blokken
    const currentBlokNameInput = document.getElementById('current-blok-name');
    const currentBlokNotesInput = document.getElementById('current-blok-notes');
    const blokDropZone = document.getElementById('blok-drop-zone');
    const saveBlokBtn = document.getElementById('save-blok-btn');
    const savedBloksList = document.getElementById('saved-bloks-list');

    saveBlokBtn.addEventListener('click', async () => {
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
            const repetitionStepInput = item.querySelector('[data-repetition-step-input]'); // NEW
            const repetitions = parseInt(repetitionsInput.value);
            const repetitionStep = parseInt(repetitionStepInput.value); // NEW

            if (isNaN(repetitions) || repetitions <= 0) {
                hasError = true;
                showMessage('Vul een geldig aantal herhalingen in voor elke week.', 'error');
                return;
            }
            if (isNaN(repetitionStep) || repetitionStep <= 0) { // NEW validation
                hasError = true;
                showMessage('Vul een geldige herhaalstap in (minimaal 1).', 'error');
                return;
            }

            weeksInBlok.push({
                weekId: item.dataset.id,
                name: item.dataset.name,
                icon: item.dataset.icon,
                content: (item.dataset.content && typeof item.dataset.content === 'string' && item.dataset.content !== "undefined" && item.dataset.content !== "") ? JSON.parse(item.dataset.content) : null,
                repetitions: repetitions,
                repetitionStep: repetitionStep // NEW
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

        await putData('trainingBlocks', newBlok);
        showMessage('Blok opgeslagen!', 'success');
        currentBlokNameInput.value = '';
        currentBlokNotesInput.value = '';
        blokDropZone.innerHTML = '<p class="text-gray-400 text-center">Sleep weken hierheen om het blok te configureren.</p>';
        renderAllSavedItems();
    });

    async function loadSavedBloks() {
        savedBloksList.innerHTML = '';
        const savedBloks = await getAllData('trainingBlocks');
        if (savedBloks.length === 0) {
            savedBloksList.innerHTML = '<p class="text-gray-400 col-span-full">Nog geen blokken opgeslagen.</p>';
            return;
        }

        savedBloks.forEach(blok => {
            const blokCard = document.createElement('div');
            blokCard.className = 'drag-item bg-gray-600 p-3 rounded-md shadow flex flex-col cursor-grab';
            blokCard.setAttribute('draggable', 'true');
            blokCard.dataset.id = blok.id;
            blokCard.dataset.name = blok.name;
            blokCard.dataset.type = 'blok';
            blokCard.dataset.content = (blok.weeks && Array.isArray(blok.weeks)) ? JSON.stringify(blok.weeks) : '';
            blokCard.dataset.repetitions = blok.repetitions || 1; // This might be redundant if repetitions are per week in the block
            if (blok.repetitionStep) blokCard.dataset.repetitionStep = blok.repetitionStep; // NEW: repetitionStep for display

            const configuredWeeksSummary = blok.weeks.map(week => {
                let weekText = `${week.name} (${week.repetitions}x)`;
                if (week.repetitionStep && week.repetitionStep > 1) {
                    weekText += ` elke ${week.repetitionStep}w`;
                }
                return weekText;
            }).join(', ');
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
                        <span class="text-sm text-gray-300 ml-2">Herhaal elke:</span>
                        <input type="number" value="${blok.repetitionStep || 1}" min="1" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-repetition-step-input>
                        <span class="text-sm text-gray-300 ml-1">weken</span>
                    </div>
                    <div class="text-xs text-gray-300 mt-2">
                        ${summaryText}
                    </div>
                </div>
                ${notesText}
            `;
            savedBloksList.appendChild(blokCard);
            attachDragStartListener(blokCard); // Attach listener to the new element
            addEventListenersToDroppedItem(blokCard);
        });
        addRemoveListenersToSavedItems();
    }

    // Functie voor het verwijderen van opgeslagen items (algemeen)
    async function addRemoveListenersToSavedItems() {
        document.querySelectorAll('.remove-saved-item-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const idToRemove = e.target.closest('button').dataset.id;
                const listName = e.target.closest('button').dataset.list;
                
                try {
                    await deleteData(listName, idToRemove);
                    showMessage('Item verwijderd!', 'info');
                    // Herlaad de juiste lijst
                    if (listName === 'trainingDays') loadSavedDays();
                    if (listName === 'trainingWeeks') loadSavedWeeks();
                    if (listName === 'trainingBlocks') loadSavedBloks(); 
                    if (listName === 'customMeasurements') loadCustomMeasurements();
                    if (listName === 'configuredSessions') loadSavedSessions(); // NEW
                    renderAllSavedItems(); // Update de gecombineerde lijst na verwijdering
                } catch (error) {
                    console.error("Error deleting item:", error);
                    showMessage('Fout bij verwijderen item.', 'error');
                }
            });
        });
    }

    // --- Knoppen om nieuwe drag-items te maken (met kopieeroptie) ---
    async function createNewItem(type, namePrompt, listName, icon, color) {
        const copyOption = confirm(`Wil je kopiëren van een bestaande ${type}?`);
        let itemName = '';
        let contentToCopy = null;
        let repetitionStepToCopy = null; // NEW

        if (copyOption) {
            const itemIdToCopy = prompt(`Voer de ID in van de ${type} die je wilt kopiëren:`);
            if (itemIdToCopy) {
                const itemToCopy = await getData(listName, itemIdToCopy);
                if (itemToCopy) {
                    itemName = prompt(`${namePrompt} (kopie van "${itemToCopy.name}"):`);
                    if (itemName) {
                        if (type === 'day') {
                            contentToCopy = itemToCopy.activities ? JSON.parse(JSON.stringify(itemToCopy.activities)) : null;
                        } else if (type === 'week') {
                            contentToCopy = itemToCopy.days ? JSON.parse(JSON.stringify(itemToCopy.days)) : null;
                            repetitionStepToCopy = itemToCopy.repetitionStep || 1; // NEW
                        } else if (type === 'blok') {
                            contentToCopy = itemToCopy.weeks ? JSON.parse(JSON.stringify(itemToCopy.weeks)) : null;
                        } else if (type === 'configured-session') { // NEW: Copy configured session content
                            contentToCopy = itemToCopy.activities ? JSON.parse(JSON.stringify(itemToCopy.activities)) : null;
                        } else if (type === 'custom-training-measurement') {
                            contentToCopy = itemToCopy.customMeasurementDefinition ? JSON.parse(JSON.stringify(itemToCopy.customMeasurementDefinition)) : null;
                        } else if (type === 'custom-rest-measurement') {
                            contentToCopy = {
                                customMeasurementDescription: itemToCopy.customMeasurementDescription,
                                customMeasurementGoals: itemToCopy.customMeasurementGoals
                            };
                        }
                        if (type === 'blok' && itemToCopy.notes) {
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
            
            newItemElement.dataset.content = (contentToCopy && (typeof contentToCopy === 'object' || Array.isArray(contentToCopy))) ? JSON.stringify(contentToCopy) : '';
            if (repetitionStepToCopy) newItemElement.dataset.repetitionStep = repetitionStepToCopy; // NEW

            if (type === 'custom-training-measurement') {
                newItemElement.dataset.customMeasurementType = 'training';
                newItemElement.dataset.customMeasurementDefinition = (contentToCopy && (typeof contentToCopy === 'object' || Array.isArray(contentToCopy))) ? JSON.stringify(contentToCopy) : '';
            } else if (type === 'custom-rest-measurement') {
                newItemElement.dataset.customMeasurementType = 'rest';
                newItemElement.dataset.customMeasurementDescription = contentToCopy?.customMeasurementDescription || '';
                newItemElement.dataset.customMeasurementGoals = contentToCopy?.customMeasurementGoals || '';
            } else if (type === 'configured-session') { // NEW: For configured session
                newItemElement.dataset.content = (contentToCopy && Array.isArray(contentToCopy)) ? JSON.stringify(contentToCopy) : '';
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

    // NEW: Create Session button
    document.getElementById('create-session-btn').addEventListener('click', () => {
        createNewItem('configured-session', 'Naam voor de nieuwe sessie:', 'configuredSessions', 'fas fa-running', 'text-green-300');
    });

    document.getElementById('create-day-btn').addEventListener('click', () => {
        createNewItem('day', 'Naam voor de nieuwe dag:', 'trainingDays', 'fas fa-calendar-day', 'text-blue-300');
    });

    document.getElementById('create-week-btn').addEventListener('click', () => {
        createNewItem('week', 'Naam voor de nieuwe week:', 'trainingWeeks', 'fas fa-calendar-week', 'text-purple-300');
    });

    document.getElementById('create-block-btn').addEventListener('click', () => {
        createNewItem('blok', 'Naam voor het nieuwe blok:', 'trainingBlocks', 'fas fa-layer-group', 'text-cyan-300');
    });

    // Genereer tijdlabels voor de sessie/dag weergave
    function generateTimeLabels(containerId) { // Added containerId parameter
        const timeLabelsContainer = document.getElementById(containerId);
        if (!timeLabelsContainer) {
            console.error(`Element with ID '${containerId}' not found.`);
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

    // saveCustomTrainingBtn en saveCustomRestBtn blijven hetzelfde
    saveCustomTrainingBtn.addEventListener('click', async () => {
        const trainingName = customTrainingNameInput.value.trim();
        if (!trainingName) {
            showMessage('Geef de aangepaste training een naam.', 'error');
            return;
        }

        const definition = [];
        let hasError = false;
        customTrainingZonesDropZone.querySelectorAll('.timeline-item').forEach(item => {
            const itemType = item.dataset.type;
            const subItem = {
                type: itemType,
                name: item.dataset.name,
                icon: item.querySelector('.element-header i').className,
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

        await putData('customMeasurements', newCustomTraining);
        showMessage('Aangepaste training opgeslagen!', 'success');
        customTrainingNameInput.value = '';
        customTrainingZonesDropZone.innerHTML = '<p class="text-gray-400 text-center text-sm">Sleep HR zones of oefeningen hierheen om de training te definiëren.</p>';
        loadCustomMeasurements();
    });

    saveCustomRestBtn.addEventListener('click', async () => {
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

        await putData('customMeasurements', newCustomRest);
        showMessage('Aangepaste rustmeting opgeslagen!', 'success');
        customRestNameInput.value = '';
        customRestDescriptionInput.value = '';
        customRestGoalsInput.value = '';
        loadCustomMeasurements();
    });

    async function loadCustomMeasurements() {
        const availableModulesContainer = document.getElementById('available-modules');
        // Remove existing custom measurement items from the sidebar to prevent duplicates
        availableModulesContainer.querySelectorAll('.drag-item[data-type^="custom-"]').forEach(item => item.remove());

        const savedCustomMeasurements = await getAllData('customMeasurements');
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
                measurementItem.dataset.customMeasurementDefinition = (measurement.customMeasurementDefinition && (typeof measurement.customMeasurementDefinition === 'object' || Array.isArray(measurement.customMeasurementDefinition))) ? JSON.stringify(measurement.customMeasurementDefinition) : '';
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
            // Hide all category content divs initially
            contentDiv.style.display = 'none';
            contentDiv.classList.remove('active');
            // Hide all individual drag-items within this category
            contentDiv.querySelectorAll('.drag-item').forEach(el => el.style.display = 'none');
        });

        const activeCategoryContent = document.getElementById(`category-${selectedCategory}`);
        if (activeCategoryContent) {
            activeCategoryContent.classList.add('active');
            activeCategoryContent.style.display = 'block'; // Zorg dat de geselecteerde categorie zichtbaar is
            activeCategoryContent.querySelectorAll('.drag-item').forEach(item => item.style.display = 'flex'); // Toon items in de categorie
        }
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
        // Activeer de Sessie Bouwer tab bij het laden van de pagina
        document.querySelector('.tab-button[data-tab="session-builder"]').click(); // NEW: Default to Session Builder
        renderAllSavedItems(); // Laad alle opgeslagen items bij opstart
        // Open de eerste inklapbare sectie standaard
        const firstCollapsibleHeader = document.querySelector('.collapsible-header');
        if (firstCollapsibleHeader) {
            firstCollapsibleHeader.click(); // Simuleer een klik om de sectie te openen
        }
    })();
}
