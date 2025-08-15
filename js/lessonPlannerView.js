// Bestand: js/lessonPlannerView.js
import { getData, putData, getAllData, deleteData } from '../database.js';
import { showNotification } from './notifications.js';

// Functie om een unieke ID te genereren
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Functie om een bericht te tonen
function showMessage(message, type = 'info') {
    const msgBox = document.getElementById('message-box');
    if (msgBox) {
        msgBox.textContent = message;
        msgBox.className = `message-box show bg-${type === 'error' ? 'red' : type === 'success' ? 'green' : 'gray'}-700`;
        setTimeout(() => {
            msgBox.classList.remove('show');
        }, 3000);
    }
}

// --- UI Elementen ---
const lessonForm = document.getElementById('lessonForm');
const lessonIdInput = document.getElementById('lessonId');
const lessonNameInput = document.getElementById('lessonName');
const lessonCategoryInput = document.getElementById('lessonCategory');
const lessonTeacherSelect = document.getElementById('lessonTeacher');
const lessonRoomSelect = document.getElementById('lessonRoom');
const lessonTotalPlacesInput = document.getElementById('lessonTotalPlaces');
const lessonDurationInput = document.getElementById('lessonDuration');
const lessonExplanationInput = document.getElementById('lessonExplanation');
const saveLessonBtn = document.getElementById('saveLessonBtn');
const clearLessonFormBtn = document.getElementById('clearLessonFormBtn');
const createNewLessonBtn = document.getElementById('create-new-lesson-btn');

const availableLessonsList = document.getElementById('available-lessons-list');
const allSavedLessonItemsList = document.getElementById('all-saved-lesson-items-list');

const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Les Dag Bouwer elementen
const currentLessonDayNameInput = document.getElementById('current-lesson-day-name');
const lessonDayDropZone = document.getElementById('lesson-day-drop-zone');
const saveLessonDayBtn = document.getElementById('save-lesson-day-btn');
const createLessonDayBtn = document.getElementById('create-lesson-day-btn');

// Les Week Bouwer elementen
const currentLessonWeekNameInput = document.getElementById('current-schedule-name'); // Hergebruikt ID
const lessonWeekDropZones = document.querySelectorAll('.calendar-day-cell-lesson.lesson-drop-zone');
const saveLessonWeekBtn = document.getElementById('saveLessonWeekBtn');
const createLessonWeekBtn = document.getElementById('create-lesson-week-btn');

// Les Blok Bouwer elementen
const currentLessonBlockNameInput = document.getElementById('current-lesson-block-name');
const currentLessonBlockNotesInput = document.getElementById('current-lesson-block-notes');
const lessonBlockDropZone = document.getElementById('lesson-block-drop-zone');
const saveLessonBlockBtn = document.getElementById('save-lesson-block-btn');
const createLessonBlockBtn = document.getElementById('create-lesson-block-btn');

let draggedItemData = null;
let isDraggingExistingItem = false;
let originalParent = null;

// --- Algemene Hulpfuncties ---
function formatTime(minutes) {
    if (isNaN(minutes) || minutes === null) return '-- min';
    return `${minutes} min`;
}

// --- Drag & Drop Logica ---
function attachDragStartListener(itemElement) {
    itemElement.addEventListener('dragstart', (e) => {
        const draggableItem = e.target.closest('.drag-item, .timeline-item, .dropped-item');
        if (!draggableItem) {
            e.preventDefault();
            return;
        }

        draggedItemData = {
            type: draggableItem.dataset.type || 'unknown',
            ...draggableItem.dataset
        };

        // Parse content if it exists and is a string
        if (draggableItem.dataset.content && typeof draggableItem.dataset.content === 'string' && draggableItem.dataset.content !== "undefined" && draggableItem.dataset.content !== "") {
            try {
                draggedItemData.content = JSON.parse(draggableItem.dataset.content);
            } catch (error) {
                console.error("Fout bij het parsen van draggedItemData.content:", error);
                draggedItemData.content = null;
            }
        } else {
            draggedItemData.content = null;
        }

        if (draggableItem.classList.contains('timeline-item') || draggableItem.classList.contains('dropped-item')) {
            isDraggingExistingItem = true;
            originalParent = draggableItem.parentNode;
            e.dataTransfer.effectAllowed = 'move';
        } else {
            isDraggingExistingItem = false;
            e.dataTransfer.effectAllowed = 'copy';
        }
        e.dataTransfer.setData('text/plain', JSON.stringify(draggedItemData));
    });
}

function setupDragAndDrop() {
    // Koppel dragstart listeners aan alle drag-items in de zijbalk
    document.querySelectorAll('.drag-item').forEach(item => {
        attachDragStartListener(item);
    });

    // Koppel drag-and-drop listeners aan alle dropzones
    document.querySelectorAll('.drop-zone, .lesson-drop-zone').forEach(zone => {
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

            let isValidDrop = false;
            let expectedTypes = [];

            if (dropZoneId === 'lesson-day-drop-zone') { // Les Dag Bouwer
                expectedTypes = ['lesson'];
                if (expectedTypes.includes(data.type)) {
                    isValidDrop = true;
                }
            } else if (dropZoneClasses.contains('lesson-drop-zone') && dropZoneId !== 'lesson-day-drop-zone') { // Les Week Bouwer
                expectedTypes = ['lesson-day', 'lesson']; // Kan lesdagen of individuele lessen accepteren
                if (expectedTypes.includes(data.type)) {
                    isValidDrop = true;
                }
            } else if (dropZoneId === 'lesson-block-drop-zone') { // Les Blok Bouwer
                expectedTypes = ['lesson-week'];
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

            if (isDraggingExistingItem && originalParent) {
                const draggedElement = originalParent.querySelector(`[data-id="${data.id}"]`);
                if (draggedElement) {
                    draggedElement.remove();
                    checkAndAddPlaceholder(originalParent);
                }
            }

            const placeholder = zone.querySelector('p.text-gray-400');
            if (placeholder) {
                placeholder.remove();
            }

            if (dropZoneId === 'lesson-day-drop-zone') {
                createTimelineDroppedLessonItem(e.clientY - zone.getBoundingClientRect().top, zone, data);
            } else if (dropZoneClasses.contains('lesson-drop-zone')) { // Voor weekrooster cellen
                if (data.type === 'lesson') {
                    // Als een individuele les wordt gedropt op een weekcel, voeg deze toe
                    zone.appendChild(createDroppedLessonItem(data));
                } else if (data.type === 'lesson-day') {
                    // Als een lesdag wordt gedropt, vervang de inhoud van de cel
                    zone.innerHTML = '';
                    zone.appendChild(createDroppedLessonDayItem(data));
                }
            } else if (dropZoneId === 'lesson-block-drop-zone') {
                createDroppedLessonBlockItem(zone, data);
            }
            
            isDraggingExistingItem = false;
            originalParent = null;
        });
    });
}

function createTimelineDroppedLessonItem(yPosition, zone, data) {
    const droppedItem = document.createElement('div');
    droppedItem.dataset.id = data.id || generateUniqueId();
    droppedItem.dataset.type = data.type;
    droppedItem.dataset.name = data.name;
    droppedItem.dataset.teacher = data.teacher || '';
    droppedItem.dataset.room = data.room || '';
    droppedItem.dataset.totalPlaces = data.totalPlaces || '';
    droppedItem.dataset.category = data.category || '';
    droppedItem.dataset.explanation = data.explanation || '';
    droppedItem.dataset.duration = data.duration || '';

    droppedItem.setAttribute('draggable', 'true');

    // Calculate height based on duration (e.g., 25px per 30 minutes)
    const height = (parseInt(data.duration) / 30) * 25;
    droppedItem.style.height = `${height}px`;

    // Calculate top position based on Y-coordinate and snap to 30-minute intervals
    const snappedY = Math.round(yPosition / 25) * 25;
    droppedItem.style.top = `${snappedY}px`;
    droppedItem.style.left = '0';
    droppedItem.style.width = '100%';
    droppedItem.style.position = 'absolute';

    let categoryColorClass = 'bg-gray-600';
    switch (data.category) {
        case 'Fitness': categoryColorClass = 'bg-red-600'; break;
        case 'Budo': categoryColorClass = 'bg-blue-600'; break;
        case 'Dans': categoryColorClass = 'bg-purple-600'; break;
        case 'Zwemmen': categoryColorClass = 'bg-cyan-600'; break;
        case 'Groep': categoryColorClass = 'bg-green-600'; break;
        default: categoryColorClass = 'bg-gray-600'; break;
    }
    droppedItem.className = `timeline-item ${categoryColorClass} p-2 rounded-md shadow text-sm relative`;

    droppedItem.innerHTML = `
        <div class="lesson-header flex justify-between items-center w-full">
            <span class="font-bold">${data.name}</span>
            <button class="remove-btn text-white opacity-75 hover:opacity-100"><i class="fas fa-times"></i></button>
        </div>
        <div class="lesson-details text-gray-200 text-xs">
            Docent: ${data.teacher || 'N.v.t.'} | Lokaal: ${data.room || 'N.v.t.'}
            ${data.duration ? ` | Duur: ${data.duration} min` : ''}
        </div>
    `;

    droppedItem.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        droppedItem.remove();
        checkAndAddPlaceholder(zone);
    });

    attachDragStartListener(droppedItem);
    zone.appendChild(droppedItem);
    showMessage(`Les '${data.name}' toegevoegd aan dag!`, 'success');
}

function createDroppedLessonItem(data) {
    const item = document.createElement('div');
    let categoryColorClass = 'bg-gray-600'; 
    switch (data.category) {
        case 'Fitness': categoryColorClass = 'bg-red-600'; break;
        case 'Budo': categoryColorClass = 'bg-blue-600'; break;
        case 'Dans': categoryColorClass = 'bg-purple-600'; break;
        case 'Zwemmen': categoryColorClass = 'bg-cyan-600'; break;
        case 'Groep': categoryColorClass = 'bg-green-600'; break;
        default: categoryColorClass = 'bg-gray-600'; break;
    }

    item.className = `lesson-item ${categoryColorClass} p-2 rounded-md shadow text-sm relative mb-1`;
    item.setAttribute('draggable', 'true');
    item.dataset.id = data.id || generateUniqueId();
    item.dataset.name = data.name;
    item.dataset.teacher = data.teacher || '';
    item.dataset.room = data.room || '';
    item.dataset.totalPlaces = data.totalPlaces || '';
    item.dataset.category = data.category || '';
    item.dataset.explanation = data.explanation || '';
    item.dataset.duration = data.duration || '';

    item.innerHTML = `
        <div class="lesson-header flex justify-between items-center w-full">
            <span class="font-bold">${data.name}</span>
            <button class="remove-btn text-white opacity-75 hover:opacity-100"><i class="fas fa-times"></i></button>
        </div>
        <div class="lesson-details text-gray-200 text-xs">
            Docent: ${data.teacher || 'N.v.t.'} | Lokaal: ${data.room || 'N.v.t.'}
            ${data.duration ? ` | Duur: ${data.duration} min` : ''}
            ${data.totalPlaces ? ` | Max: ${data.totalPlaces}` : ''}
        </div>
    `;

    item.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        item.remove();
        if (item.parentNode.children.length === 1) { // Check if only placeholder remains
            item.parentNode.innerHTML = '<p class="text-gray-400 text-center text-sm">Sleep les hier</p>';
        }
    });

    attachDragStartListener(item);
    return item;
}

function createDroppedLessonDayItem(data) {
    const item = document.createElement('div');
    item.className = 'dropped-item flex flex-col p-2 mb-1 rounded-md bg-gray-700';
    item.setAttribute('draggable', 'true');
    item.dataset.id = data.id || generateUniqueId();
    item.dataset.type = data.type;
    item.dataset.name = data.name;
    item.dataset.content = JSON.stringify(data.content); // Inhoud van de lesdag (lessen)

    let summaryHtml = '';
    if (data.content && Array.isArray(data.content)) {
        const lessonNames = data.content.map(lesson => lesson.name).join(', ');
        summaryHtml = `<div class="text-xs text-gray-400 mt-1">Lessen: ${lessonNames}</div>`;
    }

    item.innerHTML = `
        <div class="flex items-center justify-between w-full">
            <span><i class="fas fa-calendar-day mr-2 text-blue-300"></i>${data.name}</span>
            <button class="remove-btn text-red-400 hover:text-red-300"><i class="fas fa-times"></i></button>
        </div>
        ${summaryHtml}
    `;
    
    item.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        item.remove();
        if (item.parentNode.children.length === 0) {
            item.parentNode.innerHTML = '<p class="text-gray-400 text-center text-sm">Sleep les dag hier</p>';
        }
    });

    attachDragStartListener(item);
    return item;
}

function createDroppedLessonBlockItem(zone, data) {
    const droppedItem = document.createElement('div');
    droppedItem.className = 'dropped-item flex flex-col p-3 rounded-md bg-gray-700';
    droppedItem.setAttribute('draggable', 'true');
    droppedItem.dataset.id = data.id || generateUniqueId();
    droppedItem.dataset.name = data.name;
    droppedItem.dataset.type = data.type;
    droppedItem.dataset.content = JSON.stringify(data.content); // Inhoud van de lesweek (dagen)
    droppedItem.dataset.repetitions = data.repetitions || 1;

    let summaryText = '';
    if (data.content) {
        const configuredDays = Object.keys(data.content).filter(day => data.content[day] && data.content[day].length > 0).join(', ');
        summaryText = `<div class="text-xs text-gray-300 mt-2">Dagen met lessen: ${configuredDays || 'geen'}</div>`;
    }

    droppedItem.innerHTML = `
        <div class="flex items-center justify-between w-full">
            <span><i class="fas fa-layer-group mr-2 text-cyan-300"></i>${data.name}</span>
            <button class="remove-btn text-red-400 hover:text-red-300"><i class="fas fa-times"></i></button>
        </div>
        <div class="element-settings hidden flex flex-col mt-2">
            <div class="flex items-center space-x-2 w-full">
                <span class="text-sm text-gray-300">Herhalingen:</span>
                <input type="number" value="${data.repetitions || 1}" min="1" class="w-16 p-1 rounded-md bg-gray-800 border border-gray-600 text-gray-200 text-sm" data-repetitions-input>
            </div>
            ${summaryText}
        </div>
    `;

    droppedItem.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        droppedItem.remove();
        checkAndAddPlaceholder(zone);
    });

    const repetitionsInput = droppedItem.querySelector('[data-repetitions-input]');
    if (repetitionsInput) {
        repetitionsInput.addEventListener('change', () => {
            droppedItem.dataset.repetitions = repetitionsInput.value;
        });
    }

    droppedItem.querySelector('.flex.items-center.justify-between.w-full').addEventListener('click', () => {
        droppedItem.querySelector('.element-settings').classList.toggle('hidden');
    });

    attachDragStartListener(droppedItem);
    zone.appendChild(droppedItem);
    showMessage(`${data.name} toegevoegd aan blok!`, 'success');
}

function checkAndAddPlaceholder(zone) {
    if (zone.children.length === 0 || (zone.children.length === 1 && zone.children[0].tagName === 'P')) { // Check if only placeholder exists
        let placeholderText = '';
        if (zone.id === 'lesson-day-drop-zone') {
            placeholderText = 'Sleep lessen hierheen om de dag te configureren.';
        } else if (zone.classList.contains('lesson-drop-zone')) {
            placeholderText = 'Sleep les dag hier';
        } else if (zone.id === 'lesson-block-drop-zone') {
            placeholderText = 'Sleep les weken hierheen om het blok te configureren.';
        }
        if (!zone.querySelector('p.text-gray-400')) { // Only add if no placeholder exists
            const newPlaceholder = document.createElement('p');
            newPlaceholder.className = 'text-gray-400 text-center text-sm';
            newPlaceholder.textContent = placeholderText;
            zone.appendChild(newPlaceholder);
        }
    }
}


// --- Laadfuncties voor opgeslagen items ---
async function loadAvailableLessons() {
    // Ensure the element exists before trying to manipulate it
    const listElement = document.getElementById('available-lessons-list');
    if (!listElement) {
        console.error("Element 'available-lessons-list' not found. Skipping loadAvailableLessons.");
        return;
    }
    listElement.innerHTML = ''; // Clear existing content

    try {
        const lessons = await getAllData('lessons');
        if (lessons.length === 0) {
            listElement.innerHTML = '<p class="text-gray-400">Geen lessen gevonden.</p>';
            return;
        }

        lessons.forEach(lesson => {
            const lessonCard = document.createElement('div');
            lessonCard.className = 'drag-item lesson-item bg-gray-700 p-3 rounded-md shadow cursor-grab';
            lessonCard.setAttribute('draggable', 'true');
            lessonCard.dataset.id = lesson.id;
            lessonCard.dataset.type = 'lesson';
            lessonCard.dataset.name = lesson.name;
            lessonCard.dataset.teacher = lesson.teacher || '';
            lessonCard.dataset.room = lesson.room || '';
            lessonCard.dataset.totalPlaces = lesson.totalPlaces || '';
            lessonCard.dataset.category = lesson.category || '';
            lessonCard.dataset.explanation = lesson.explanation || '';
            lessonCard.dataset.duration = lesson.duration || '';
            
            lessonCard.innerHTML = `
                <div class="flex justify-between items-center">
                    <span><i class="fas fa-chalkboard-teacher mr-2"></i>${lesson.name}</span>
                    <button class="remove-saved-item-btn text-red-400 hover:text-red-300" data-id="${lesson.id}" data-list="lessons"><i class="fas fa-times"></i></button>
                </div>
            `;
            listElement.appendChild(lessonCard);
        });
        // setupDragAndDrop() is now called once at the end of initLessonPlannerView
        // attachDragStartListener is called directly when creating new elements
        addRemoveListenersToSavedItems();
    } catch (error) {
        console.error("Fout bij laden van lessen:", error);
        listElement.innerHTML = '<p class="text-red-400">Fout bij het laden van lessen.</p>';
        showNotification('Fout bij het laden van lessen.', 'error');
    }
}

async function loadSavedLessonDays() {
    const savedDays = await getAllData('lessonDays');
    return savedDays.map(day => ({
        ...day,
        displayType: 'Les Dag',
        sortOrder: 2, // Na individuele lessen
        listName: 'lessonDays',
        icon: 'fas fa-calendar-day'
    }));
}

async function loadSavedLessonWeeks() {
    const savedWeeks = await getAllData('lessonSchedules'); // Gebruikt lessonSchedules store
    return savedWeeks.map(week => ({
        ...week,
        displayType: 'Les Week',
        sortOrder: 3, // Na lesdagen
        listName: 'lessonSchedules',
        icon: 'fas fa-calendar-week'
    }));
}

async function loadSavedLessonBlocks() {
    const savedBlocks = await getAllData('lessonBlocks');
    return savedBlocks.map(block => ({
        ...block,
        displayType: 'Les Blok',
        sortOrder: 4, // Na lesweken
        listName: 'lessonBlocks',
        icon: 'fas fa-layer-group'
    }));
}

async function renderAllSavedLessonItems() {
    // Ensure the element exists before trying to manipulate it
    const listElement = document.getElementById('all-saved-lesson-items-list');
    if (!listElement) {
        console.error("Element 'all-saved-lesson-items-list' not found. Skipping renderAllSavedLessonItems.");
        return;
    }
    listElement.innerHTML = ''; // Clear existing content

    const lessons = await getAllData('lessons'); // Individuele lessen
    const savedLessonDays = await loadSavedLessonDays();
    const savedLessonWeeks = await loadSavedLessonWeeks();
    const savedLessonBlocks = await loadSavedLessonBlocks();

    let allItems = [];
    lessons.forEach(lesson => allItems.push({ ...lesson, type: 'lesson', displayType: 'Les', sortOrder: 1, listName: 'lessons', icon: 'fas fa-chalkboard-teacher' }));
    allItems = allItems.concat(savedLessonDays);
    allItems = allItems.concat(savedLessonWeeks);
    allItems = allItems.concat(savedLessonBlocks);

    allItems.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
            return a.sortOrder - b.sortOrder;
        }
        return a.name.localeCompare(b.name);
    });

    if (allItems.length === 0) {
        listElement.innerHTML = '<p class="text-gray-400 col-span-full">Nog geen les schema\'s opgeslagen.</p>';
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
        itemCard.dataset.repetitions = item.repetitions || 1;
        
        // Specifieke data voor lessen
        itemCard.dataset.teacher = item.teacher || '';
        itemCard.dataset.room = item.room || '';
        itemCard.dataset.totalPlaces = item.totalPlaces || '';
        itemCard.dataset.category = item.category || '';
        itemCard.dataset.explanation = item.explanation || '';
        itemCard.dataset.duration = item.duration || '';

        let summaryText = '';
        if (item.type === 'lesson') {
            summaryText = `<div class="text-xs text-gray-400 mt-1">Docent: ${item.teacher || 'N.v.t.'}, Duur: ${item.duration || '--'} min</div>`;
        } else if (item.type === 'lesson-day' && item.content && Array.isArray(item.content)) {
            const lessonNames = item.content.map(lesson => lesson.name).join(', ');
            summaryText = `<div class="text-xs text-gray-400 mt-1">Lessen: ${lessonNames}</div>`;
        } else if (item.type === 'lesson-week' && item.schedule && typeof item.schedule === 'object') {
            const configuredDays = Object.keys(item.schedule).filter(day => item.schedule[day] && item.schedule[day].length > 0).join(', ');
            summaryText = `<div class="text-xs text-gray-400 mt-1">Dagen met lessen: ${configuredDays || 'geen'}</div>`;
        } else if (item.type === 'lesson-block' && item.weeks && Array.isArray(item.weeks)) {
            const configuredWeeks = item.weeks.map(week => `${week.name} (${week.repetitions}x)`).join(', ');
            summaryText = `<div class="text-xs text-gray-400 mt-1">Weken: ${configuredWeeks.length > 0 ? configuredWeeks : 'Geen weken'}</div>`;
        }

        itemCard.innerHTML = `
            <div class="flex items-center justify-between w-full">
                <span><i class="${item.icon} mr-2"></i>${item.name} (${item.displayType})</span>
                <button class="remove-saved-item-btn text-red-400 hover:text-red-300" data-id="${item.id}" data-list="${item.listName}"><i class="fas fa-times"></i></button>
            </div>
            ${summaryText}
        `;
        listElement.appendChild(itemCard);
        // attachDragStartListener is now called once at the end of initLessonPlannerView
        // It will be called for all new items after they are rendered.
    });
    addRemoveListenersToSavedItems();
}

// --- Opslaan functies ---
async function saveLessonFromForm() {
    const lessonData = {
        id: lessonIdInput.value || generateUniqueId(),
        name: lessonNameInput.value.trim(),
        category: lessonCategoryInput.value.trim(),
        teacher: lessonTeacherSelect.value.trim(),
        room: lessonRoomSelect.value.trim(),
        totalPlaces: parseInt(lessonTotalPlacesInput.value) || 0,
        duration: parseInt(lessonDurationInput.value) || 0,
        explanation: lessonExplanationInput.value.trim()
    };
    
    if (!lessonData.name || !lessonData.category || !lessonData.duration) {
        showNotification('Naam, categorie en duur zijn verplicht.', 'error');
        return;
    }

    try {
        await putData('lessons', lessonData);
        showNotification('Les opgeslagen!', 'success');
        lessonForm.reset();
        lessonIdInput.value = '';
        loadAvailableLessons();
        populateTeacherAndRoomDropdowns();
        renderAllSavedLessonItems();
    } catch (error) {
        console.error("Fout bij opslaan les:", error);
        showNotification('Fout bij het opslaan van de les.', 'error');
    }
}

async function saveLessonDay() {
    const dayName = currentLessonDayNameInput.value.trim();
    if (!dayName) {
        showMessage('Geef de les dag een naam.', 'error');
        return;
    }

    const lessonsInDay = [];
    let hasError = false;
    lessonDayDropZone.querySelectorAll('.timeline-item').forEach(item => {
        lessonsInDay.push({
            id: item.dataset.id,
            name: item.dataset.name,
            teacher: item.dataset.teacher,
            room: item.dataset.room,
            totalPlaces: item.dataset.totalPlaces,
            category: item.dataset.category,
            explanation: item.dataset.explanation,
            duration: item.dataset.duration,
            topPosition: parseFloat(item.style.top) || 0
        });
    });

    if (lessonsInDay.length === 0) {
        showMessage('Voeg lessen toe aan de dag.', 'error');
        return;
    }

    lessonsInDay.sort((a, b) => a.topPosition - b.topPosition);

    const dayId = generateUniqueId();
    const newLessonDay = { id: dayId, name: dayName, content: lessonsInDay };

    try {
        await putData('lessonDays', newLessonDay);
        showMessage('Les Dag opgeslagen!', 'success');
        currentLessonDayNameInput.value = '';
        lessonDayDropZone.innerHTML = '<p class="text-gray-400 text-center">Sleep lessen hierheen om de dag te configureren.</p>';
        renderAllSavedLessonItems();
    } catch (error) {
        console.error("Fout bij opslaan les dag:", error);
        showNotification('Fout bij het opslaan van de les dag.', 'error');
    }
}

async function saveLessonWeek() {
    const scheduleName = currentLessonWeekNameInput.value.trim();
    if (!scheduleName) {
        showNotification('Geef het les weekrooster een naam.', 'error');
        return;
    }
    
    const schedule = {};
    let hasLessons = false;
    lessonWeekDropZones.forEach(slot => {
        const dayOfWeek = slot.dataset.dayOfWeek;
        schedule[dayOfWeek] = Array.from(slot.querySelectorAll('.lesson-item, .dropped-item')).map(item => {
            // Check if it's an individual lesson or a dropped lesson-day
            if (item.dataset.type === 'lesson') {
                return {
                    id: item.dataset.id,
                    name: item.dataset.name,
                    teacher: item.dataset.teacher,
                    room: item.dataset.room,
                    totalPlaces: item.dataset.totalPlaces,
                    category: item.dataset.category,
                    explanation: item.dataset.explanation,
                    duration: item.dataset.duration,
                    type: 'lesson'
                };
            } else if (item.dataset.type === 'lesson-day') {
                return {
                    id: item.dataset.id,
                    name: item.dataset.name,
                    content: JSON.parse(item.dataset.content), // De inhoud van de lesdag
                    type: 'lesson-day'
                };
            }
            return null;
        }).filter(item => item !== null); // Filter nulls if any
        
        if (schedule[dayOfWeek].length > 0) {
            hasLessons = true;
        }
    });

    if (!hasLessons) {
        showNotification('Voeg les dagen of lessen toe aan het rooster voordat je opslaat.', 'warning');
        return;
    }
    
    const weekData = {
        id: generateUniqueId(),
        name: scheduleName,
        schedule: schedule
    };

    try {
        await putData('lessonSchedules', weekData);
        showNotification('Les Week opgeslagen!', 'success');
        currentLessonWeekNameInput.value = '';
        lessonWeekDropZones.forEach(slot => {
            slot.innerHTML = '<p class="text-gray-400 text-center text-sm">Sleep les dag hier</p>';
        });
        renderAllSavedLessonItems();
    }
    catch (error) {
        console.error("Fout bij opslaan les weekrooster:", error);
        showNotification('Fout bij het opslaan van het les weekrooster.', 'error');
    }
}

async function saveLessonBlock() {
    const blockName = currentLessonBlockNameInput.value.trim();
    const blockNotes = currentLessonBlockNotesInput.value.trim();
    if (!blockName) {
        showMessage('Geef het les blok een naam.', 'error');
        return;
    }

    const weeksInBlock = [];
    let hasError = false;
    lessonBlockDropZone.querySelectorAll('.dropped-item').forEach(item => {
        const repetitionsInput = item.querySelector('[data-repetitions-input]');
        const repetitions = parseInt(repetitionsInput.value);
        if (isNaN(repetitions) || repetitions <= 0) {
            hasError = true;
            showMessage('Vul een geldig aantal herhalingen in voor elke les week.', 'error');
            return;
        }

        weeksInBlock.push({
            weekId: item.dataset.id,
            name: item.dataset.name,
            content: JSON.parse(item.dataset.content), // Inhoud van de lesweek
            repetitions: repetitions
        });
    });

    if (hasError) {
        return;
    }
    if (weeksInBlock.length === 0) {
        showMessage('Voeg les weken toe aan het blok.', 'error');
        return;
    }
    if (weeksInBlock.length > 53) {
        showMessage('Een les blok kan maximaal 53 weken bevatten.', 'error');
        return;
    }

    const blockId = generateUniqueId();
    const newLessonBlock = {
        id: blockId,
        name: blockName,
        weeks: weeksInBlock,
        notes: blockNotes
    };

    try {
        await putData('lessonBlocks', newLessonBlock);
        showMessage('Les Blok opgeslagen!', 'success');
        currentLessonBlockNameInput.value = '';
        currentLessonBlockNotesInput.value = '';
        lessonBlockDropZone.innerHTML = '<p class="text-gray-400 text-center">Sleep les weken hierheen om het blok te configureren.</p>';
        renderAllSavedLessonItems();
    } catch (error) {
        console.error("Fout bij opslaan les blok:", error);
        showNotification('Fout bij het opslaan van het les blok.', 'error');
    }
}

// Functie voor het verwijderen van opgeslagen items (algemeen)
async function addRemoveListenersToSavedItems() {
    document.querySelectorAll('.remove-saved-item-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idToRemove = e.target.closest('button').dataset.id;
            const listName = e.target.closest('button').dataset.list;
            
            try {
                await deleteData(listName, idToRemove);
                showMessage('Item verwijderd!', 'info');
                loadAvailableLessons(); // Herlaad de beschikbare lessen
                populateTeacherAndRoomDropdowns(); // Herlaad de dropdowns
                renderAllSavedLessonItems(); // Update de gecombineerde lijst
            } catch (error) {
                console.error("Error deleting item:", error);
                showMessage('Fout bij verwijderen item.', 'error');
            }
        });
    });
}

// Populeer docent- en lokaal-dropdowns
async function populateTeacherAndRoomDropdowns() {
    // Ensure elements exist before trying to manipulate them
    const teacherSelect = document.getElementById('lessonTeacher');
    const roomSelect = document.getElementById('lessonRoom');
    if (!teacherSelect || !roomSelect) {
        console.error("Teacher or Room select element not found. Skipping populateTeacherAndRoomDropdowns.");
        return;
    }

    teacherSelect.innerHTML = '<option value="">Selecteer Docent</option>';
    roomSelect.innerHTML = '<option value="">Selecteer Lokaal</option>';

    try {
        const lessons = await getAllData('lessons');
        const uniqueTeachers = new Set();
        const uniqueRooms = new Set();

        lessons.forEach(lesson => {
            if (lesson.teacher) uniqueTeachers.add(lesson.teacher);
            if (lesson.room) uniqueRooms.add(lesson.room);
        });

        uniqueTeachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher;
            option.textContent = teacher;
            teacherSelect.appendChild(option);
        });

        uniqueRooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room;
            option.textContent = room;
            roomSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Fout bij populeren docent/lokaal dropdowns:", error);
        showNotification('Fout bij het laden van docenten en lokalen.', 'error');
    }
}

// Genereer tijdlabels voor de les dag weergave
function generateTimeLabels(containerId) {
    const timeLabelsContainer = document.getElementById(containerId);
    if (!timeLabelsContainer) {
        console.error(`Element with ID '${containerId}' not found. Skipping generateTimeLabels.`);
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

// Beheer van collapsible secties
function setupCollapsibles() {
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.dataset.collapsibleTarget;
            const content = document.getElementById(targetId);
            if (content) {
                header.classList.toggle('collapsed');
                content.classList.toggle('expanded');
            }
        });
    });
}

// Beheer van tabbladen
function setupTabNavigation() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.add('hidden'));
            
            button.classList.add('active');
            const targetContent = document.getElementById(`tab-${button.dataset.tab}`);
            if (targetContent) {
                targetContent.classList.remove('hidden');
                if (button.dataset.tab === 'lesson-day-builder') {
                    generateTimeLabels('lesson-day-time-labels');
                }
            }
        });
    });
}

// Hoofdfunctie om de view te initialiseren
export async function initLessonPlannerView() {
    console.log("Lessenplanner View geïnitialiseerd.");
    
    // Event listeners voor knoppen
    if (saveLessonBtn) saveLessonBtn.addEventListener('click', saveLessonFromForm);
    if (clearLessonFormBtn) clearLessonFormBtn.addEventListener('click', () => {
        lessonForm.reset();
        lessonIdInput.value = '';
    });
    if (createNewLessonBtn) createNewLessonBtn.addEventListener('click', () => {
                const lessonBuilderTabButton = document.querySelector('.tab-button[data-tab="lesson-builder"]');
        if (lessonBuilderTabButton) {
            lessonBuilderTabButton.click();
        }
        lessonForm.reset();
        lessonIdInput.value = '';
    });

    if (saveLessonDayBtn) saveLessonDayBtn.addEventListener('click', saveLessonDay);
    if (createLessonDayBtn) createLessonDayBtn.addEventListener('click', () => {
        document.querySelector('.tab-button[data-tab="lesson-day-builder"]').click();
        currentLessonDayNameInput.value = '';
        lessonDayDropZone.innerHTML = '<p class="text-gray-400 text-center">Sleep lessen hierheen om de dag te configureren.</p>';
    });

    if (saveLessonWeekBtn) saveLessonWeekBtn.addEventListener('click', saveLessonWeek);
    if (createLessonWeekBtn) createLessonWeekBtn.addEventListener('click', () => {
        document.querySelector('.tab-button[data-tab="lesson-week-builder"]').click();
        currentLessonWeekNameInput.value = '';
        lessonWeekDropZones.forEach(slot => {
            slot.innerHTML = '<p class="text-gray-400 text-center text-sm">Sleep les dag hier</p>';
        });
    });

    if (saveLessonBlockBtn) saveLessonBlockBtn.addEventListener('click', saveLessonBlock);
    if (createLessonBlockBtn) createLessonBlockBtn.addEventListener('click', () => {
        document.querySelector('.tab-button[data-tab="lesson-block-builder"]').click();
        currentLessonBlockNameInput.value = '';
        currentLessonBlockNotesInput.value = '';
        lessonBlockDropZone.innerHTML = '<p class="text-gray-400 text-center">Sleep les weken hierheen om het blok te configureren.</p>';
    });

    // Setup UI componenten
    setupCollapsibles();
    setupTabNavigation();

    // Initiële data laden (uitgesteld om DOM-elementen tijd te geven om te laden)
    // De setupDragAndDrop() wordt hier expliciet aangeroepen na het laden van alle items.
    setTimeout(async () => {
        await loadAvailableLessons();
        await populateTeacherAndRoomDropdowns();
        await renderAllSavedLessonItems();
        setupDragAndDrop(); // Zorg ervoor dat drag-and-drop na alle DOM-updates wordt ingesteld
        // Activeer standaard de eerste tab
                // Activeer standaard de eerste tab
        const lessonBuilderTabButton = document.querySelector('.tab-button[data-tab="lesson-builder"]');
        if (lessonBuilderTabButton) {
            lessonBuilderTabButton.click();
        }
    }, 0);
}
