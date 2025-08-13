// Bestand: js/views/lessonSchedulerView.js
// Bevat logica voor het plannen en beheren van lessen.

import { getAllData } from '../database.js';
import { showNotification } from './notifications.js'; // Importeer notificatiesysteem

export async function initLessonSchedulerView() {
    console.log("Lesplanner View geïnitialiseerd.");

    const lessonsList = document.getElementById('lessonsList');

    /**
     * Laadt alle lessen uit de database en toont ze in de lijst.
     */
    async function loadLessons() {
        try {
            const lessons = await getAllData('lessons'); // Haal lessen op uit IndexedDB
            lessonsList.innerHTML = ''; // Maak de bestaande lijst leeg

            if (lessons.length === 0) {
                lessonsList.innerHTML = '<p class="text-gray-400">Geen lessen gevonden.</p>';
                return;
            }

            // Sorteer lessen op naam voor een consistente weergave
            lessons.sort((a, b) => a.name.localeCompare(b.name));

            lessons.forEach(lesson => {
                const lessonCard = document.createElement('div');
                lessonCard.className = 'data-card';
                lessonCard.innerHTML = `
                    <div class="card-header"><h3>${lesson.name} (${lesson.category || 'Algemeen'})</h3></div>
                    <div class="sub-value">Docent: ${lesson.teacher || 'N.v.t.'}</div>
                    <div class="sub-value">Tijd: ${lesson.startTime || 'N.v.t.'} - ${lesson.endTime || 'N.v.t.'}</div>
                    <div class="sub-value">Lokaal: ${lesson.room || 'N.v.t.'}</div>
                    <div class="sub-value">Plekken: ${lesson.totalPlaces || '--'}</div>
                    <div class="sub-value">Uitleg: ${lesson.explanation || 'Geen uitleg'}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-blue-400 hover:text-blue-300 text-sm" data-action="view-lesson-details" data-id="${lesson.id}">Details</button>
                    </div>
                `;
                lessonsList.appendChild(lessonCard);
            });

            // Voeg event listeners toe voor de "Details" knoppen
            lessonsList.querySelectorAll('[data-action="view-lesson-details"]').forEach(button => {
                button.addEventListener('click', (event) => {
                    const lessonId = event.target.dataset.id;
                    // In een echte applicatie zou dit een modal openen of naar een detailpagina navigeren.
                    showNotification(`Details voor les met ID: ${lessonId} (functionaliteit nog te implementeren).`, 'info', 3000);
                });
            });

        } catch (error) {
            console.error("Fout bij laden lessen:", error);
            showNotification("Fout bij laden lessen.", "error");
        }
    }

    // Laad lessen bij initialisatie van de view
    await loadLessons();
}
