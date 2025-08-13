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
        const subscriptions = await getAllData('subscriptions');
        const activeSubs = subscriptions.filter(sub => sub.status === 'Active').length; // Aanname: 'status' veld in abonnementen
        if (overviewActiveSubscriptions) overviewActiveSubscriptions.textContent = activeSubs;

        // Totaal Inkomen (Deze Maand)
        const transactions = await getAllData('finance');
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
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
        const totalHr = userProfiles.reduce((sum, profile) => sum + (parseFloat(profile.userAvgDailyHR) || 0), 0);
        const avgHr = userProfiles.length > 0 ? (totalHr / userProfiles.length).toFixed(0) : '--';
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
        const schedules = await getAllData('schedules');
        const lessonSchedules = await getAllData('lessonSchedules'); // Aanname: 'lessonSchedules' store bestaat
        const upcomingItems = [];
        const now = new Date();

        schedules.forEach(schedule => {
            // Aanname: schema's hebben een 'dateCreated' of 'nextOccurrence' veld
            // Voor dit voorbeeld gebruiken we een placeholder voor de datum
            upcomingItems.push({
                type: 'Schema',
                name: schedule.name,
                date: 'Toekomstige datum (placeholder)'
            });
        });

        lessonSchedules.forEach(lesson => {
            // Aanname: lessen hebben een 'date' en 'time' veld
            const lessonDateTime = new Date(`${lesson.date}T${lesson.time}`);
            if (lessonDateTime > now) {
                upcomingItems.push({
                    type: 'Les',
                    name: lesson.name,
                    date: lessonDateTime.toLocaleString()
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
                    itemEntry.textContent = `${item.type}: ${item.name} (${item.date})`;
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
