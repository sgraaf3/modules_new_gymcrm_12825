// Bestand: scheduleDataManager.js
import { showMessage } from './viewRenderer.js';
import { populateDropZone } from './viewRenderer.js';

export function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function setupSaveButtons() {
    const saveDayBtn = document.getElementById('save-day-btn');
    const saveWeekBtn = document.getElementById('save-week-btn');
    const saveBlokBtn = document.getElementById('save-blok-btn');

    const currentDayNameInput = document.getElementById('current-day-name');
    const dayDropZone = document.getElementById('day-drop-zone');
    const currentWeekNameInput = document.getElementById('current-week-name');
    const weekDaySlots = document.querySelectorAll('.day-slot');
    const currentBlokNameInput = document.getElementById('current-blok-name');
    const currentBlokNotesInput = document.getElementById('current-blok-notes');
    const blokDropZone = document.getElementById('blok-drop-zone');

    saveDayBtn.addEventListener('click', () => {
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
                icon: item.querySelector('i').className,
                zoneColor: item.dataset.zoneColor || '',
                topPosition: parseFloat(item.style.top) || 0
            };
            if (item.dataset.type === 'hr-zone') {
                const durationInput = item.querySelector('[data-duration-input]');
                const progressionCheckbox = item.querySelector('[data-progression-checkbox]');
                const progressionValueInput = item.querySelector('[data-progression-value-input]');
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
            } else if (item.dataset.type === 'document-link') {
                activity.documentName = item.dataset.documentName;
            } else if (item.dataset.type === 'custom-training-measurement') {
                activity.customMeasurementType = item.dataset.customMeasurementType;
                activity.customMeasurementDefinition = JSON.parse(item.dataset.customMeasurementDefinition);
            } else if (item.dataset.type === 'custom-rest-measurement') {
                activity.customMeasurementType = item.dataset.customMeasurementType;
                activity.customMeasurementDescription = item.dataset.customMeasurementDescription;
                activity.customMeasurementGoals = item.dataset.customMeasurementGoals;
            }
            activities.push(activity);
        });

        if (hasError) return;
        if (activities.length === 0) {
            showMessage('Voeg activiteiten toe aan de dag.', 'error');
            return;
        }

        activities.sort((a, b) => a.topPosition - b.topPosition);

        const dayId = generateUniqueId();
        const newDay = { id: dayId, name: dayName, activities: activities };

        let savedDays = JSON.parse(localStorage.getItem('cardioDays') || '[]');
        savedDays.push(newDay);
        localStorage.setItem('cardioDays', JSON.stringify(savedDays));

        showMessage('Dag opgeslagen!', 'success');
        currentDayNameInput.value = '';
        dayDropZone.innerHTML = '<p class="text-gray-400 text-center">Sleep hartslagzones, rust, metingen of documenten hierheen om de dag te configureren.</p>';
        loadSavedDays();
    });

    saveWeekBtn.addEventListener('click', () => {
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

        let savedWeeks = JSON.PARSE(localStorage.getItem('cardioWeeks') || '[]');
        savedWeeks.push(newWeek);
        localStorage.setItem('cardioWeeks', JSON.stringify(savedWeeks));

        showMessage('Week opgeslagen!', 'success');
        currentWeekNameInput.value = '';
        weekDaySlots.forEach(slot => {
            slot.innerHTML = '<p class="text-gray-400 text-center text-sm">Sleep dag hier</p>';
        });
        loadSavedWeeks();
    });

    saveBlokBtn.addEventListener('click', () => {
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

        if (hasError) return;
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

        let savedBloks = JSON.parse(localStorage.getItem('cardioBloks') || '[]');
        savedBloks.push(newBlok);
        localStorage.setItem('cardioBloks', JSON.stringify(savedBloks));

        showMessage('Blok opgeslagen!', 'success');
        currentBlokNameInput.value = '';
        currentBlokNotesInput.value = '';
        blokDropZone.innerHTML = '<p class="text-gray-400 text-center">Sleep weken hierheen om het blok te configureren.</p>';
        loadSavedBloks();
    });
}

export function loadSavedDays() {
    const savedDaysList = document.getElementById('saved-days-list');
    savedDaysList.innerHTML = '';
    const savedDays = JSON.parse(localStorage.getItem('cardioDays') || '[]');
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
                <button class="remove-saved-item-btn text-red-400 hover:text-red-300" data-id="${day.id}" data-list="cardioDays"><i class="fas fa-times"></i></button>
            </div>
            <div class="text-xs text-gray-300 mt-2">
                ${day.activities.map(act => {
                    let activityText = `<span class="inline-block bg-gray-800 rounded-full px-2 py-1 text-xs font-semibold text-gray-300 mr-1 mb-1"><i class="${act.icon.split(' ')[1]} mr-1 ${act.zoneColor || ''}"></i>${act.name}`;
                    if (act.type === 'hr-zone') {
                        if (act.duration) { activityText += ` (${act.duration} min)`; }
                        if (act.progressionEnabled && act.progressionValue) { activityText += ` (+${act.progressionValue} min)`; }
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

export function loadSavedWeeks() {
    const savedWeeksList = document.getElementById('saved-weeks-list');
    savedWeeksList.innerHTML = '';
    const savedWeeks = JSON.parse(localStorage.getItem('cardioWeeks') || '[]');
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
                <button class="remove-saved-item-btn text-red-400 hover:text-red-300" data-id="${week.id}" data-list="cardioWeeks"><i class="fas fa-times"></i></button>
            </div>
            <div class="text-xs text-gray-300 mt-2">
                ${summaryText}
            </div>
        `;
        savedWeeksList.appendChild(weekCard);
    });
    addRemoveListenersToSavedItems();
}

export function loadSavedBloks() {
    const savedBloksList = document.getElementById('saved-bloks-list');
    savedBloksList.innerHTML = '';
    const savedBloks = JSON.parse(localStorage.getItem('cardioBloks') || '[]');
    if (savedBloks.length === 0) {
        savedBloksList.innerHTML = '<p class="text-gray-400 col-span-full">Nog geen blokken opgeslagen.</p>';
        return;
    }
    savedBloks.forEach(blok => {
        const blokCard = document.createElement('div');
        blokCard.className = 'dropped-item flex flex-col p-3 rounded-md bg-gray-700';
        blokCard.dataset.id = blok.id;
        blokCard.dataset.name = blok.name;
        blokCard.dataset.type = 'blok';

        const configuredWeeksSummary = blok.weeks.map(week => `${week.name} (${week.repetitions}x)`).join(', ');
        const summaryText = configuredWeeksSummary || 'Geen weken geconfigureerd';
        const notesText = blok.notes ? `<div class="text-xs text-gray-400 mt-1">Notities: ${blok.notes.substring(0, 50)}${blok.notes.length > 50 ? '...' : ''}</div>` : '';


        blokCard.innerHTML = `
            <div class="flex items-center justify-between w-full">
                <span><i class="fas fa-layer-group mr-2 text-cyan-300"></i>${blok.name}</span>
                <button class="remove-saved-item-btn" data-id="${blok.id}" data-list="cardioBloks"><i class="fas fa-times"></i></button>
            </div>
            <div class="text-xs text-gray-300 mt-2">
                ${summaryText}
            </div>
            ${notesText}
        `;
        savedBloksList.appendChild(blokCard);
    });
    addRemoveListenersToSavedItems();
}

function addRemoveListenersToSavedItems() {
    document.querySelectorAll('.remove-saved-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const idToRemove = e.target.closest('button').dataset.id;
            const listName = e.target.closest('button').dataset.list;
            
            let savedItems = JSON.parse(localStorage.getItem(listName) || '[]');
            savedItems = savedItems.filter(item => item.id !== idToRemove);
            localStorage.setItem(listName, JSON.stringify(savedItems));
            
            showMessage('Item verwijderd!', 'info');
            if (listName === 'cardioDays') loadSavedDays();
            if (listName === 'cardioWeeks') loadSavedWeeks();
            if (listName === 'cardioBloks') loadSavedBloks();
            if (listName === 'customMeasurements') loadCustomMeasurements();
        });
    });
}