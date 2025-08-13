// Bestand: js/views/lessonSchedulerView.js
// Bevat logica voor het plannen en beheren van lessen.

import { getAllData } from '../database.js';

export async function initLessonSchedulerView() {
    console.log("Lesplanner View geïnitialiseerd.");

    const lessonsList = document.getElementById('lessonsList');

    async function loadLessons() {
        try {
            const lessons = await getAllData('lessons');
            lessonsList.innerHTML = '';

            if (lessons.length === 0) {
                lessonsList.innerHTML = '<p class="text-gray-400">Geen lessen gevonden.</p>';
                return;
            }

            lessons.forEach(lesson => {
                const lessonCard = document.createElement('div');
                lessonCard.className = 'data-card';
                lessonCard.innerHTML = `
                    <div class="card-header"><h3>${lesson.name} (${lesson.category})</h3></div>
                    <div class="sub-value">Docent: ${lesson.teacher || 'N.v.t.'}</div>
                    <div class="sub-value">Tijd: ${lesson.startTime || 'N.v.t.'} - ${lesson.endTime || 'N.v.t.'}</div>
                    <div class="sub-value">Lokaal: ${lesson.room || 'N.v.t.'}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-blue-400 hover:text-blue-300 text-sm" data-action="view-lesson-details" data-id="${lesson.id}">Details</button>
                    </div>
                `;
                lessonsList.appendChild(lessonCard);
            });

            lessonsList.querySelectorAll('[data-action="view-lesson-details"]').forEach(button => {
                button.addEventListener('click', (event) => {
                    const lessonId = event.target.dataset.id;
                    // Hier zou je een modal kunnen openen of naar een detailpagina navigeren
                    alert(`Details voor les met ID: ${lessonId}`);
                });
            });

        } catch (error) {
            console.error("Fout bij laden lessen:", error);
        }
    }

    await loadLessons();
}
