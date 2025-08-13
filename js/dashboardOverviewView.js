// Bestand: js/views/dashboardOverviewView.js
// Bevat logica voor een algemeen dashboardoverzicht, dat gegevens van verschillende stores aggregeert.

import { getAllData } from '../database.js';
import { showNotification } from './notifications.js'; // Importeer notificatiesysteem

export async function initDashboardOverviewView() {
    console.log("Dashboard Overzicht View geïnitialiseerd.");

    const overviewTotalMembers = document.getElementById('overviewTotalMembers');
    const overviewActiveSubscriptions = document.getElementById('overviewActiveSubscriptions');
    const overviewMonthlyIncome = document.getElementById('overviewMonthlyIncome');
    const overviewRecentActivities = document.getElementById('overviewRecentActivities');
    const overviewOpenNotes = document.getElementById('overviewOpenNotes');
    const overviewAvgHrMembers = document.getElementById('overviewAvgHrMembers');
    const overviewWeeklyTrainingSessions = document.getElementById('overviewWeeklyTrainingSessions');
    const overviewNewMembersMonth = document.getElementById('overviewNewMembersMonth');
    const overviewRecentLogs = document.getElementById('overviewRecentLogs');
    const overviewUpcomingSchedules = document.getElementById('overviewUpcomingSchedules');

    try {
        // Totaal Leden
        const members = await getAllData('registry');
        if (overviewTotalMembers) overviewTotalMembers.textContent = members.length;

        // Actieve Abonnementen
        const memberMemberships = await getAllData('memberMemberships');
        const activeMembershipsCount = memberMemberships.filter(mem => mem.status === 'Active').length;
        if (overviewActiveSubscriptions) overviewActiveSubscriptions.textContent = activeMembershipsCount;

        // Totaal Inkomen (Deze Maand)
        const transactions = await getAllData('finance');
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        let monthlyIncome = 0;
        transactions.forEach(trans => {
            const transDate = new Date(trans.date);
            if (trans.type === 'income' && transDate.getMonth() === currentMonth && transDate.getFullYear() === currentYear) {
                monthlyIncome += trans.amount;
            }
        });
        if (overviewMonthlyIncome) overviewMonthlyIncome.textContent = `€ ${monthlyIncome.toFixed(2)}`;

        // Recente Activiteiten (afgelopen 24 uur)
        const activities = await getAllData('activitiesData'); // Gebruik 'activitiesData' store
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const recentActivitiesCount = activities.filter(activity => new Date(activity.timestamp) > oneDayAgo).length; // Aanname: 'timestamp' veld in activiteiten
        if (overviewRecentActivities) overviewRecentActivities.textContent = recentActivitiesCount;

        // Openstaande Notities (aanname: notities hebben geen 'status' veld, dus toon totaal)
        const notes = await getAllData('notesData');
        if (overviewOpenNotes) overviewOpenNotes.textContent = notes.length; // Of filter op een 'completed' status als die bestaat

        // Gemiddelde HR Leden (KPI)
        const userProfiles = await getAllData('userProfile');
        const validHrProfiles = userProfiles.filter(profile => typeof parseFloat(profile.userAvgDailyHR) === 'number' && !isNaN(parseFloat(profile.userAvgDailyHR)));
        const totalHr = validHrProfiles.reduce((sum, profile) => sum + parseFloat(profile.userAvgDailyHR), 0);
        const avgHr = validHrProfiles.length > 0 ? (totalHr / validHrProfiles.length).toFixed(0) : '--';
        if (overviewAvgHrMembers) overviewAvgHrMembers.textContent = `${avgHr} BPM`;

        // Totaal Trainingssessies (Week) (KPI)
        const trainingSessions = await getAllData('trainingSessions'); // Aanname: 'trainingSessions' store bestaat
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const weeklyTrainingSessionsCount = trainingSessions.filter(session => new Date(session.date) > oneWeekAgo).length; // Aanname: 'date' veld in trainingSessions
        if (overviewWeeklyTrainingSessions) overviewWeeklyTrainingSessions.textContent = weeklyTrainingSessionsCount;

        // Nieuwe Leden (Deze Maand) (KPI)
        const newMembersMonth = members.filter(member => {
            const joinDate = new Date(member.joinDate);
            return joinDate.getMonth() === currentMonth && joinDate.getFullYear() === currentYear;
        }).length;
        if (overviewNewMembersMonth) overviewNewMembersMonth.textContent = newMembersMonth;

        // Recente Logboekvermeldingen
        const logs = await getAllData('logs');
        const recentLogs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5); // Toon de laatste 5
        if (overviewRecentLogs) {
            overviewRecentLogs.innerHTML = '';
            if (recentLogs.length === 0) {
                overviewRecentLogs.innerHTML = '<p class="text-gray-400">Geen recente logboekvermeldingen.</p>';
            } else {
                recentLogs.forEach(log => {
                    const logEntry = document.createElement('div');
                    logEntry.className = 'text-sm text-gray-300 border-b border-gray-700 last:border-b-0 pb-1 pt-1';
                    logEntry.textContent = `${new Date(log.timestamp).toLocaleTimeString()}: ${log.message}`;
                    overviewRecentLogs.appendChild(logEntry);
                });
            }
        }

        // Aankomende Geplande Items (bijv. van 'schedules' en 'lessonSchedules')
        const schedules = await getAllData('schedules'); // Algemene schema's
        const lessonSchedules = await getAllData('lessonSchedules'); // Lesroosters (week-gebaseerd)
        const meetings = await getAllData('meetings'); // Vergaderingen

        let upcomingItems = [];

        // Voeg algemene schema's toe (als ze een 'nextOccurrence' of vergelijkbaar veld hebben)
        // Voor nu, een placeholder:
        schedules.forEach(schedule => {
            // Aanname: schema's hebben een 'dateCreated' of 'nextOccurrence' veld
            // Voor dit voorbeeld gebruiken we een placeholder voor de datum
            upcomingItems.push({
                type: 'Algemeen Schema',
                name: schedule.name,
                date: 'Toekomstige datum (placeholder)' // Moet worden bijgewerkt met echte planning
            });
        });

        // Voeg lessen uit lesroosters toe (uit de huidige week of toekomstige weken)
        // Dit is complexer omdat lessonSchedules week-objecten zijn. We moeten in de schedule-objecten duiken.
        const allLessonSchedules = await getAllData('lessonSchedules');
        allLessonSchedules.forEach(weekSchedule => {
            if (weekSchedule.schedule) {
                for (const dayOfWeek in weekSchedule.schedule) {
                    weekSchedule.schedule[dayOfWeek].forEach(lesson => {
                        // Creëer een dummy datum voor de les om te sorteren
                        // Dit is een simpele benadering, echte implementatie zou de weeknummer en dag van de week omzetten naar een concrete datum
                        const dummyDate = new Date(); // Gebruik huidige datum als basis
                        dummyDate.setDate(dummyDate.getDate() + (Math.floor(Math.random() * 30))); // Random toekomstige datum
                        dummyDate.setHours(parseInt(lesson.startTime.split(':')[0]), parseInt(lesson.startTime.split(':')[1]));

                        if (dummyDate > now) { // Alleen toekomstige lessen
                            upcomingItems.push({
                                type: 'Les',
                                name: lesson.name,
                                date: dummyDate.toLocaleString(),
                                time: lesson.startTime
                            });
                        }
                    });
                }
            }
        });

        // Voeg vergaderingen toe
        meetings.forEach(meeting => {
            const meetingDateTime = new Date(`${meeting.date}T${meeting.time}`);
            if (meetingDateTime > now) { // Alleen toekomstige vergaderingen
                upcomingItems.push({
                    type: 'Vergadering',
                    name: meeting.subject,
                    date: meetingDateTime.toLocaleString(),
                    time: meeting.time
                });
            }
        });

        upcomingItems.sort((a, b) => new Date(a.date) - new Date(b.date)); // Sorteer op datum
        const top5Upcoming = upcomingItems.slice(0, 5); // Toon de volgende 5

        if (overviewUpcomingSchedules) {
            overviewUpcomingSchedules.innerHTML = '';
            if (top5Upcoming.length === 0) {
                overviewUpcomingSchedules.innerHTML = '<p class="text-gray-400">Geen aankomende geplande items.</p>';
            } else {
                top5Upcoming.forEach(item => {
                    const itemEntry = document.createElement('div');
                    itemEntry.className = 'text-sm text-gray-300 border-b border-gray-700 last:border-b-0 pb-1 pt-1';
                    itemEntry.textContent = `${item.type}: ${item.name} (${new Date(item.date).toLocaleDateString()} ${item.time || ''})`;
                    overviewUpcomingSchedules.appendChild(itemEntry);
                });
            }
        }

    } catch (error) {
        console.error("Fout bij het laden van dashboard overzicht gegevens:", error);
        showNotification("Fout bij het laden van dashboard overzicht gegevens.", "error");
        // Zorg ervoor dat alle elementen een fallback waarde krijgen bij een fout
        if (overviewTotalMembers) overviewTotalMembers.textContent = '--';
        if (overviewActiveSubscriptions) overviewActiveSubscriptions.textContent = '--';
        if (overviewMonthlyIncome) overviewMonthlyIncome.textContent = '€ --.--';
        if (overviewRecentActivities) overviewRecentActivities.textContent = '--';
        if (overviewOpenNotes) overviewOpenNotes.textContent = '--';
        if (overviewAvgHrMembers) overviewAvgHrMembers.textContent = '-- BPM';
        if (overviewWeeklyTrainingSessions) overviewWeeklyTrainingSessions.textContent = '--';
        if (overviewNewMembersMonth) overviewNewMembersMonth.textContent = '--';
        if (overviewRecentLogs) overviewRecentLogs.innerHTML = '<p class="text-gray-400">Fout bij laden logs.</p>';
        if (overviewUpcomingSchedules) overviewUpcomingSchedules.innerHTML = '<p class="text-gray-400">Fout bij laden planning.</p>';
    }
}
