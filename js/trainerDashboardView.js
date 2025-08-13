// Bestand: js/trainerDashboardView.js
// Bevat logica voor het trainer dashboard, inclusief toegewezen leden, snelle sessie logging, en urenregistratie.

import { getData, getAllData, putData, getOrCreateUserId } from '../database.js';
import { showNotification } from './notifications.js';

let currentTrainerId = null; // The ID of the currently logged-in trainer
let assignedMembersCache = []; // Cache for members assigned to this trainer

/**
 * Initializes the Trainer Dashboard View.
 * @param {function} showViewCallback - Callback to navigate to other views.
 */
export async function initTrainerDashboardView(showViewCallback) {
    console.log("Trainer Dashboard View geïnitialiseerd.");

    // DOM Element References
    const trainerNameDisplay = document.getElementById('trainerNameDisplay');
    const assignedMembersListBody = document.getElementById('assignedMembersListBody');
    const manageAssignmentsBtn = document.getElementById('manageAssignmentsBtn');
    const logMemberSelect = document.getElementById('logMemberSelect');
    const sessionDurationInput = document.getElementById('sessionDuration');
    const sessionNotesInput = document.getElementById('sessionNotes');
    const logSessionBtn = document.getElementById('logSessionBtn');
    const hoursTodaySpan = document.getElementById('hoursToday');
    const hoursThisWeekSpan = document.getElementById('hoursThisWeek');
    const hoursTotalSpan = document.getElementById('hoursTotal');
    const viewHourReportsBtn = document.getElementById('viewHourReportsBtn');
    const memberProgressChartsContainer = document.getElementById('memberProgressChartsContainer');

    // Get the current user's ID (assuming the trainer is the logged-in user)
    currentTrainerId = getOrCreateUserId();

    // Event Listeners
    manageAssignmentsBtn.addEventListener('click', () => {
        if (showViewCallback) {
            showViewCallback('trainerManagementView'); // Navigate to trainer management view
        }
    });
    logSessionBtn.addEventListener('click', logSession);
    viewHourReportsBtn.addEventListener('click', () => {
        if (showViewCallback) {
            // Navigate to a dedicated hour reports view (to be implemented later)
            showNotification("Uren Rapporten functionaliteit nog te implementeren.", 'info');
        }
    });
    logMemberSelect.addEventListener('change', displayMemberProgressOverview);


    // Initial Data Load
    await loadTrainerProfile();
    await loadAssignedMembersList();
    await calculateAndDisplayHours();
}

/**
 * Loads and displays the current trainer's profile information.
 */
async function loadTrainerProfile() {
    try {
        const trainerProfile = await getData('userProfile', currentTrainerId);
        if (trainerProfile) {
            trainerNameDisplay.textContent = `${trainerProfile.firstName || ''} ${trainerProfile.lastName || ''}`;
        } else {
            trainerNameDisplay.textContent = 'Onbekende Trainer';
            showNotification("Trainer profiel niet gevonden.", 'warning');
        }
    } catch (error) {
        console.error("Fout bij laden trainer profiel:", error);
        showNotification("Fout bij laden trainer profiel.", 'error');
    }
}

/**
 * Loads and displays the list of members assigned to the current trainer.
 */
async function loadAssignedMembersList() {
    assignedMembersListBody.innerHTML = '';
    logMemberSelect.innerHTML = '<option value="">-- Selecteer een lid --</option>';

    try {
        const allMembers = await getAllData('memberData');
        assignedMembersCache = allMembers.filter(member => member.trainerId === currentTrainerId);

        if (assignedMembersCache.length === 0) {
            assignedMembersListBody.innerHTML = '<tr><td colspan="3" class="py-3 px-6 text-center">Geen leden aan u toegewezen.</td></tr>';
            logMemberSelect.disabled = true;
            logSessionBtn.disabled = true;
            return;
        }

        logMemberSelect.disabled = false;
        logSessionBtn.disabled = false;

        assignedMembersCache.forEach(member => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-800 hover:bg-gray-800';
            row.innerHTML = `
                <td class="py-3 px-6 text-left">${member.name}</td>
                <td class="py-3 px-6 text-left">${member.email || '--'}</td>
                <td class="py-3 px-6 text-center">
                    <button class="table-action-button view-profile-button" data-member-id="${member.id}">Bekijk Profiel</button>
                </td>
            `;
            assignedMembersListBody.appendChild(row);

            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            logMemberSelect.appendChild(option);
        });

        // Add event listeners for "Bekijk Profiel" buttons
        assignedMembersListBody.querySelectorAll('.view-profile-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const memberId = parseInt(event.target.dataset.memberId);
                // Navigate to member's specific progress view or user profile view
                // Assuming memberSpecificprogressView can take a memberId as data
                if (showViewCallback) { // Assuming showViewCallback is available from init
                    showViewCallback('memberSpecificprogressView', { memberId: memberId });
                }
            });
        });

    } catch (error) {
        console.error("Fout bij laden toegewezen leden:", error);
        showNotification("Fout bij laden toegewezen leden.", 'error');
    }
}

/**
 * Logs a training session for a selected member.
 */
async function logSession() {
    const memberId = logMemberSelect.value;
    const duration = parseFloat(sessionDurationInput.value);
    const notes = sessionNotesInput.value.trim();

    if (!memberId || !duration || isNaN(duration) || duration <= 0) {
        showNotification("Selecteer een lid en voer een geldige duur in.", 'warning');
        return;
    }

    try {
        const member = assignedMembersCache.find(m => m.id === parseInt(memberId));
        if (!member) {
            showNotification("Geselecteerd lid niet gevonden.", 'error');
            return;
        }

        const newSession = {
            memberId: parseInt(memberId),
            trainerId: currentTrainerId,
            date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
            duration: duration, // in minutes
            notes: notes,
            type: 'manual_logged_session' // Custom type for trainer-logged sessions
        };

        const sessionId = await putData('trainingSessions', newSession); // Log in trainingSessions store
        showNotification(`Sessie voor ${member.name} succesvol gelogd!`, 'success');

        // Also log as trainer's work hours (attendance store)
        await putData('attendance', {
            userId: currentTrainerId,
            type: 'trainer_work',
            checkInTime: new Date().toISOString(),
            checkOutTime: new Date(Date.now() + duration * 60 * 1000).toISOString(), // Estimate checkout time
            duration: duration, // in minutes
            relatedSessionId: sessionId,
            memberId: parseInt(memberId)
        });
        showNotification(`Uren succesvol geregistreerd voor deze sessie.`, 'info');

        // Clear form
        logMemberSelect.value = '';
        sessionDurationInput.value = '';
        sessionNotesInput.value = '';

        await calculateAndDisplayHours(); // Recalculate hours after logging
    } catch (error) {
        console.error("Fout bij loggen sessie:", error);
        showNotification(`Fout bij loggen sessie: ${error.message}`, 'error');
    }
}

/**
 * Calculates and displays trainer's logged hours for today, this week, and total.
 */
async function calculateAndDisplayHours() {
    try {
        const allAttendance = await getAllData('attendance');
        const trainerAttendance = allAttendance.filter(entry => entry.userId === currentTrainerId && entry.type === 'trainer_work');

        let hoursToday = 0;
        let hoursThisWeek = 0;
        let hoursTotal = 0;

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday as start of week

        trainerAttendance.forEach(entry => {
            const entryDate = new Date(entry.checkInTime);
            const durationHours = (entry.duration || 0) / 60; // Convert minutes to hours

            hoursTotal += durationHours;

            if (entryDate.toISOString().split('T')[0] === today) {
                hoursToday += durationHours;
            }

            if (entryDate >= startOfWeek) {
                hoursThisWeek += durationHours;
            }
        });

        hoursTodaySpan.textContent = `${hoursToday.toFixed(1)} uur`;
        hoursThisWeekSpan.textContent = `${hoursThisWeek.toFixed(1)} uur`;
        hoursTotalSpan.textContent = `${hoursTotal.toFixed(1)} uur`;

    } catch (error) {
        console.error("Fout bij berekenen uren:", error);
        showNotification("Fout bij berekenen urenregistratie.", 'error');
    }
}

/**
 * Displays a summary of the selected member's progress, potentially with charts.
 */
async function displayMemberProgressOverview() {
    const memberId = logMemberSelect.value;
    memberProgressChartsContainer.innerHTML = ''; // Clear previous content

    if (!memberId) {
        memberProgressChartsContainer.innerHTML = '<p class="text-gray-400 col-span-full text-center">Selecteer een lid om gedetailleerde voortgang te zien, of beheer toewijzingen.</p>';
        return;
    }

    const member = assignedMembersCache.find(m => m.id === parseInt(memberId));
    if (!member) {
        memberProgressChartsContainer.innerHTML = '<p class="text-red-400 col-span-full text-center">Lidgegevens niet gevonden.</p>';
        return;
    }

    memberProgressChartsContainer.innerHTML = `<p class="text-gray-400 col-span-full text-center">Laden voortgang voor ${member.name}...</p>`;

    try {
        // Fetch relevant data for the selected member
        const memberTrainingSessions = await getAllData('trainingSessions');
        const memberActivities = await getAllData('memberActivity');
        const memberSleepData = await getAllData('sleepData');
        const memberCustomMeasurements = await getAllData('customMeasurements');

        const filteredTrainingSessions = memberTrainingSessions.filter(s => s.memberId === member.id);
        const filteredActivities = memberActivities.filter(a => a.memberId === member.id);
        const filteredSleepData = memberSleepData.filter(s => s.memberId === member.id);
        const filteredCustomMeasurements = memberCustomMeasurements.filter(m => m.memberId === member.id);

        let progressHtml = `<h3 class="text-lg font-bold text-gray-100 mb-3 col-span-full">Voortgang voor ${member.name}</h3>`;

        // Example: Display recent training sessions
        if (filteredTrainingSessions.length > 0) {
            const recentSessions = filteredTrainingSessions.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
            progressHtml += `
                <div class="data-card bg-gray-900 p-4 rounded-lg shadow-sm">
                    <h4 class="text-md font-semibold text-gray-200 mb-2">Recente Trainingen</h4>
                    <ul class="text-sm text-gray-300">
                        ${recentSessions.map(s => `<li>${s.date}: ${s.duration} min, Avg HR: ${s.avgHr} BPM</li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            progressHtml += `<p class="text-gray-400 text-sm col-span-full">Geen recente trainingen gevonden voor dit lid.</p>`;
        }

        // Example: Display recent sleep data
        if (filteredSleepData.length > 0) {
            const recentSleep = filteredSleepData.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
            progressHtml += `
                <div class="data-card bg-gray-900 p-4 rounded-lg shadow-sm">
                    <h4 class="text-md font-semibold text-gray-200 mb-2">Recente Slaap</h4>
                    <ul class="text-sm text-gray-300">
                        ${recentSleep.map(s => `<li>${s.date}: ${s.durationHours} uur, Kwaliteit: ${s.quality}</li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            progressHtml += `<p class="text-gray-400 text-sm col-span-full">Geen recente slaapdata gevonden voor dit lid.</p>`;
        }

        // Add more sections as needed (e.g., charts for trends, custom measurements)
        // You can use Chart.js here to render specific progress charts for the selected member.
        // Example: A simple line chart for HR trends over sessions for this member
        // This would require a canvas element in the HTML and Chart.js logic.

        memberProgressChartsContainer.innerHTML = progressHtml;

    } catch (error) {
        console.error("Fout bij laden leden voortgang:", error);
        memberProgressChartsContainer.innerHTML = `<p class="text-red-400 col-span-full text-center">Fout bij laden voortgang: ${error.message}</p>`;
        showNotification("Fout bij laden leden voortgang.", 'error');
    }
}
