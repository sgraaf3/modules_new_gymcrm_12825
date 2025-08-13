// Bestand: js/views/meetingPlannerView.js
// Bevat logica voor het plannen van vergaderingen.

import { getData, putData, deleteData, getAllData } from '../database.js';
import { showNotification } from './notifications.js';

export async function initMeetingPlannerView() {
    console.log("Vergaderplanner View geïnitialiseerd.");

    const meetingForm = document.getElementById('meetingForm');
    const meetingsList = document.getElementById('meetingsList');
    const meetingIdInput = document.getElementById('meetingId');
    const meetingDateInput = document.getElementById('meetingDate');
    const meetingTimeInput = document.getElementById('meetingTime');
    const meetingSubjectInput = document.getElementById('meetingSubject');
    const meetingAttendeesInput = document.getElementById('meetingAttendees');
    const clearMeetingFormBtn = document.getElementById('clearMeetingFormBtn');

    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const currentMonthYearDisplay = document.getElementById('currentMonthYear');
    const calendarGrid = document.getElementById('calendarGrid');

    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    /**
     * Laadt alle vergaderingen uit de database en toont ze in de lijst.
     */
    async function loadMeetings() {
        try {
            const meetings = await getAllData('meetings');
            meetingsList.innerHTML = '';

            if (meetings.length === 0) {
                meetingsList.innerHTML = '<p class="text-gray-400">Geen vergaderingen gepland.</p>';
                return;
            }

            // Sorteer vergaderingen op datum en tijd
            meetings.sort((a, b) => {
                const dateA = new Date(`${a.date}T${a.time}`);
                const dateB = new Date(`${b.date}T${b.time}`);
                return dateA - dateB;
            });

            meetings.forEach(meeting => {
                const meetingCard = document.createElement('div');
                meetingCard.className = 'data-card';
                meetingCard.innerHTML = `
                    <div class="card-header"><h3>${meeting.subject}</h3></div>
                    <div class="sub-value">Datum: ${new Date(meeting.date).toLocaleDateString()} | Tijd: ${meeting.time}</div>
                    <div class="sub-value">Deelnemers: ${meeting.attendees || 'N.v.t.'}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-blue-400 hover:text-blue-300 text-sm mr-2" data-action="edit-meeting" data-id="${meeting.id}">Bewerk</button>
                        <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-meeting" data-id="${meeting.id}">Verwijder</button>
                    </div>
                `;
                meetingsList.appendChild(meetingCard);
            });

            // Voeg event listeners toe voor bewerk/verwijder knoppen
            meetingsList.querySelectorAll('[data-action="edit-meeting"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const meetingId = parseInt(event.target.dataset.id);
                    const meeting = await getData('meetings', meetingId);
                    if (meeting) {
                        meetingIdInput.value = meeting.id;
                        meetingDateInput.value = meeting.date;
                        meetingTimeInput.value = meeting.time;
                        meetingSubjectInput.value = meeting.subject;
                        meetingAttendeesInput.value = meeting.attendees;
                        showNotification('Vergadering geladen voor bewerking.', 'info');
                    }
                });
            });

            meetingsList.querySelectorAll('[data-action="delete-meeting"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const meetingId = parseInt(event.target.dataset.id);
                    // Voor nu nog confirm, conform projectrichtlijnen. Ideaal zou een custom modal zijn.
                    if (confirm('Weet u zeker dat u deze vergadering wilt verwijderen?')) {
                        try {
                            await deleteData('meetings', meetingId);
                            showNotification('Vergadering verwijderd!', 'success');
                            loadMeetings(); // Herlaad de lijst
                            renderCalendar(); // Herlaad de kalender
                        } catch (error) {
                            console.error("Fout bij verwijderen vergadering:", error);
                            showNotification('Fout bij verwijderen vergadering.', 'error');
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Fout bij laden vergaderingen:", error);
            showNotification("Fout bij laden vergaderingen.", "error");
        }
    }

    /**
     * Rendert de kalender voor de huidige maand en toont vergaderingen.
     */
    async function renderCalendar() {
        calendarGrid.innerHTML = `
            <div class="font-bold">Zo</div>
            <div class="font-bold">Ma</div>
            <div class="font-bold">Di</div>
            <div class="font-bold">Wo</div>
            <div class="font-bold">Do</div>
            <div class="font-bold">Vr</div>
            <div class="font-bold">Za</div>
        `; // Reset grid, keep headers

        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const startingDay = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.

        currentMonthYearDisplay.textContent = `${firstDayOfMonth.toLocaleString('nl-NL', { month: 'long' })} ${currentYear}`;

        // Voeg lege dagen toe voor de start van de maand
        for (let i = 0; i < startingDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'p-2 text-gray-600';
            calendarGrid.appendChild(emptyCell);
        }

        const allMeetings = await getAllData('meetings');

        // Vul de dagen van de maand
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentYear, currentMonth, day);
            const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD

            const dayCell = document.createElement('div');
            dayCell.className = 'p-2 border border-gray-700 rounded-md flex flex-col items-center justify-start min-h-[80px]';
            dayCell.innerHTML = `<span class="font-semibold text-gray-200">${day}</span>`;

            const meetingsOnThisDay = allMeetings.filter(m => m.date === formattedDate);

            if (meetingsOnThisDay.length > 0) {
                const meetingsContainer = document.createElement('div');
                meetingsContainer.className = 'flex flex-col items-center w-full mt-1';
                meetingsOnThisDay.forEach(meeting => {
                    const meetingDot = document.createElement('div');
                    meetingDot.className = 'w-2 h-2 rounded-full bg-blue-500 mb-1';
                    meetingDot.title = `${meeting.time} - ${meeting.subject}`; // Tooltip
                    meetingsContainer.appendChild(meetingDot);
                });
                dayCell.appendChild(meetingsContainer);
            }
            calendarGrid.appendChild(dayCell);
        }
    }

    // Event listener voor het opslaan/bewerken van een vergadering
    if (meetingForm) {
        meetingForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const meeting = {
                id: meetingIdInput.value ? parseInt(meetingIdInput.value) : undefined, // Gebruik undefined voor autoIncrement
                date: meetingDateInput.value,
                time: meetingTimeInput.value,
                subject: meetingSubjectInput.value,
                attendees: meetingAttendeesInput.value,
            };
            try {
                await putData('meetings', meeting);
                showNotification('Vergadering opgeslagen!', 'success');
                meetingForm.reset();
                meetingIdInput.value = '';
                loadMeetings(); // Herlaad de lijst
                renderCalendar(); // Herlaad de kalender
            } catch (error) {
                console.error("Fout bij opslaan vergadering:", error);
                showNotification('Fout bij opslaan vergadering.', 'error');
            }
        });
    }

    // Event listener voor de "Formulier Leegmaken" knop
    if (clearMeetingFormBtn) {
        clearMeetingFormBtn.addEventListener('click', () => {
            meetingForm.reset();
            meetingIdInput.value = '';
            showNotification('Formulier leeggemaakt.', 'info');
        });
    }

    // Navigatie knoppen voor de kalender
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            renderCalendar();
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            renderCalendar();
        });
    }

    // Initialisatie: laad vergaderingen en render de kalender
    await loadMeetings();
    await renderCalendar();
}
