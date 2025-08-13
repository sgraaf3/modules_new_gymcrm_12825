// Bestand: js/views/popularityView.js
// Bevat logica voor het analyseren van populariteit van aanbod.

import { getAllData } from '../database.js';
import { showNotification } from './notifications.js';

let lessonPopularityChartInstance;
let programPopularityChartInstance;

export async function initPopularityView() {
    console.log("Populariteitssegmentatie View geïnitialiseerd.");

    const mostPopularLessonDisplay = document.getElementById('mostPopularLesson');
    const mostPopularProgramDisplay = document.getElementById('mostPopularProgram');
    const averageOccupancyDisplay = document.getElementById('averageOccupancy');
    const lessonPopularityChartCtx = document.getElementById('lessonPopularityChart')?.getContext('2d');
    const programPopularityChartCtx = document.getElementById('programPopularityChart')?.getContext('2d');
    const occupancyList = document.getElementById('occupancyList');

    async function loadPopularityData() {
        try {
            const lessons = await getAllData('lessons'); // Assuming 'lessons' store contains lesson data including bookings
            const assignedPrograms = await getAllData('assignedNutritionPrograms'); // Assuming this tracks program assignments
            const nutritionPrograms = await getAllData('nutritionPrograms'); // To get program names

            // --- Les Populariteit ---
            const lessonBookings = {}; // { lessonId: count }
            const lessonNames = {}; // { lessonId: name }
            lessons.forEach(lesson => {
                lessonNames[lesson.id] = lesson.name;
                // Assuming 'bookedBy' is an array of user IDs or a count.
                // For simplicity, let's count if 'bookedBy' exists and has entries.
                lessonBookings[lesson.id] = (lesson.bookedBy && Array.isArray(lesson.bookedBy)) ? lesson.bookedBy.length : 0;
            });

            let mostPopularLesson = 'N/A';
            let maxBookings = -1; // Initialize with -1 to handle cases with 0 bookings
            let lessonsWithBookings = false;

            for (const id in lessonBookings) {
                if (lessonBookings[id] > maxBookings) {
                    maxBookings = lessonBookings[id];
                    mostPopularLesson = lessonNames[id];
                    lessonsWithBookings = true;
                }
            }
            if (!lessonsWithBookings && lessons.length > 0) { // If there are lessons but no bookings
                mostPopularLesson = "Geen boekingen";
            } else if (lessons.length === 0) {
                mostPopularLesson = "Geen lessen";
            }
            if (mostPopularLessonDisplay) mostPopularLessonDisplay.textContent = mostPopularLesson;

            // Render Lesson Popularity Chart
            if (lessonPopularityChartCtx) {
                if (lessonPopularityChartInstance) lessonPopularityChartInstance.destroy();
                const chartLabels = Object.values(lessonNames);
                const chartData = Object.values(lessonBookings);

                lessonPopularityChartInstance = new Chart(lessonPopularityChartCtx, {
                    type: 'bar',
                    data: {
                        labels: chartLabels.length > 0 ? chartLabels : ['Geen lessen'],
                        datasets: [{
                            label: 'Aantal Boekingen',
                            data: chartData.length > 0 ? chartData : [0],
                            backgroundColor: '#60a5fa', // Blue
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'Boekingen' } }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            }

            // --- Programma Populariteit ---
            const programAssignments = {}; // { programId: count }
            const programNamesMap = {}; // { programId: name }

            nutritionPrograms.forEach(program => {
                programNamesMap[program.id] = program.name;
            });

            assignedPrograms.forEach(assignment => {
                programAssignments[assignment.programId] = (programAssignments[assignment.programId] || 0) + 1;
            });

            let mostPopularProgram = 'N/A';
            let maxAssignments = -1; // Initialize with -1
            let programsWithAssignments = false;

            for (const id in programAssignments) {
                if (programAssignments[id] > maxAssignments) {
                    maxAssignments = programAssignments[id];
                    mostPopularProgram = programNamesMap[id];
                    programsWithAssignments = true;
                }
            }
            if (!programsWithAssignments && nutritionPrograms.length > 0) { // If there are programs but no assignments
                mostPopularProgram = "Geen toewijzingen";
            } else if (nutritionPrograms.length === 0) {
                mostPopularProgram = "Geen programma's";
            }
            if (mostPopularProgramDisplay) mostPopularProgramDisplay.textContent = mostPopularProgram;

            // Render Program Popularity Chart
            if (programPopularityChartCtx) {
                if (programPopularityChartInstance) programPopularityChartInstance.destroy();
                const chartLabels = Object.values(programNamesMap);
                const chartData = Object.keys(programNamesMap).map(id => programAssignments[id] || 0);

                programPopularityChartInstance = new Chart(programPopularityChartCtx, {
                    type: 'bar',
                    data: {
                        labels: chartLabels.length > 0 ? chartLabels : ['Geen programma\'s'],
                        datasets: [{
                            label: 'Aantal Toewijzingen',
                            data: chartData.length > 0 ? chartData : [0],
                            backgroundColor: '#4ade80', // Green
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'Toewijzingen' } }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            }

            // --- Bezettingsgraad per Les ---
            occupancyList.innerHTML = '';
            let totalOccupancyPercentage = 0;
            let lessonsWithCapacity = 0;

            if (lessons.length === 0) {
                occupancyList.innerHTML = '<p class="text-gray-400">Geen lesdata gevonden voor bezettingsgraad.</p>';
            } else {
                lessons.forEach(lesson => {
                    // Assuming 'bookedBy' is an array of user IDs, so length is count
                    const currentBookings = (lesson.bookedBy && Array.isArray(lesson.bookedBy)) ? lesson.bookedBy.length : 0;
                    const capacity = lesson.totalPlaces || 1; // Default capacity to 1 to avoid division by zero

                    const occupancyPercentage = (capacity > 0) ? (currentBookings / capacity) * 100 : 0;

                    if (capacity > 0) {
                        totalOccupancyPercentage += occupancyPercentage;
                        lessonsWithCapacity++;
                    }

                    const occupancyCard = document.createElement('div');
                    occupancyCard.className = 'data-card';
                    occupancyCard.innerHTML = `
                        <div class="card-header"><h3>${lesson.name}</h3></div>
                        <div class="sub-value">Boekingen: ${currentBookings} / ${capacity}</div>
                        <div class="main-value">${occupancyPercentage.toFixed(1)}%</div>
                    `;
                    occupancyList.appendChild(occupancyCard);
                });
            }

            const overallAverageOccupancy = lessonsWithCapacity > 0 ? (totalOccupancyPercentage / lessonsWithCapacity) : 0;
            if (averageOccupancyDisplay) averageOccupancyDisplay.textContent = `${overallAverageOccupancy.toFixed(1)}%`;

        } catch (error) {
            console.error("Fout bij laden populariteitsdata:", error);
            showNotification("Fout bij laden populariteitsdata.", "error");
            // Set default values on error
            if (mostPopularLessonDisplay) mostPopularLessonDisplay.textContent = 'Fout';
            if (mostPopularProgramDisplay) mostPopularProgramDisplay.textContent = 'Fout';
            if (averageOccupancyDisplay) averageOccupancyDisplay.textContent = '--%';
            if (lessonPopularityChartInstance) lessonPopularityChartInstance.destroy();
            if (programPopularityChartInstance) programPopularityChartInstance.destroy();
            occupancyList.innerHTML = '<p class="text-red-400">Fout bij laden bezettingsgraad.</p>';
        }
    }

    await loadPopularityData();
}
