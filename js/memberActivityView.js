// Bestand: js/views/memberActivityView.js
// Bevat logica voor het weergeven van lidmaatschapsactiviteiten.

import { getData, getAllData } from '../database.js';

export async function initMemberActivityView(showView, data) {
    console.log("Lid Activiteit View geïnitialiseerd.");
    const activityList = document.getElementById('activity-list');
    const userId = data && data.userId ? data.userId : null;

    try {
        let allActivities = [];

        // Fetch training sessions
        const trainingSessions = await getAllData('trainingSessions');
        const userTrainingSessions = userId ? trainingSessions.filter(s => s.userId === userId) : trainingSessions;
        allActivities = allActivities.concat(userTrainingSessions.map(s => ({
            date: s.date,
            activity: `Training Session: ${s.duration} min, Avg HR: ${s.avgHr}`,
            type: 'training'
        })));

        // Fetch rest measurements (free and advanced)
        const restSessionsFree = await getAllData('restSessionsFree');
        const userRestSessionsFree = userId ? restSessionsFree.filter(s => s.userId === userId) : restSessionsFree;
        allActivities = allActivities.concat(userRestSessionsFree.map(s => ({
            date: s.date,
            activity: `Rest Measurement (Free): HR: ${s.heartRate}, HRV: ${s.hrv}`,
            type: 'restMeasurement'
        })));

        const restSessionsAdvanced = await getAllData('restSessionsAdvanced');
        const userRestSessionsAdvanced = userId ? restSessionsAdvanced.filter(s => s.userId === userId) : restSessionsAdvanced;
        allActivities = allActivities.concat(userRestSessionsAdvanced.map(s => ({
            date: s.date,
            activity: `Rest Measurement (Advanced): RMSSD: ${s.rmssd}, Breath Rate: ${s.breathRate}`,
            type: 'restMeasurement'
        })));

        // Fetch lessons
        const lessons = await getAllData('lessons');
        const userLessons = userId ? lessons.filter(l => l.bookedBy === userId) : lessons; // Assuming 'bookedBy' field for user
        allActivities = allActivities.concat(userLessons.map(l => ({
            date: l.date,
            activity: `Lesson Booked: ${l.name} at ${l.time}`,
            type: 'lesson'
        })));

        // Fetch meetings
        const meetings = await getAllData('meetings');
        const userMeetings = userId ? meetings.filter(m => m.participants.includes(userId)) : meetings; // Assuming 'participants' array
        allActivities = allActivities.concat(userMeetings.map(m => ({
            date: m.date,
            activity: `Meeting: ${m.topic} with ${m.participants.length} participants`,
            type: 'meeting'
        })));

        // Fetch general member activities (if any)
        const memberActivities = await getAllData('memberActivity');
        const userMemberActivities = userId ? memberActivities.filter(a => a.userId === userId) : memberActivities;
        allActivities = allActivities.concat(userMemberActivities.map(a => ({
            date: a.date,
            activity: a.activity,
            type: 'general'
        })));

        // Sort all activities by date in descending order
        allActivities.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (userId) {
            const user = await getData('registry', userId);
            if (user) {
                document.getElementById('activity-title').textContent = `Activiteiten voor ${user.name}`;
            }
        }

        if (allActivities.length > 0) {
            activityList.innerHTML = allActivities.map(activity => `
                <div class="bg-gray-700 p-4 rounded-lg mb-2">
                    <p><strong>Datum:</strong> ${new Date(activity.date).toLocaleString()}</p>
                    <p><strong>Activiteit:</strong> ${activity.activity}</p>
                    <p class="text-xs text-gray-500">Type: ${activity.type}</p>
                </div>
            `).join('');
        } else {
            activityList.innerHTML = '<p class="text-gray-400">Geen activiteiten gevonden.</p>';
        }
    } catch (error) {
        console.error("Error loading activities:", error);
        activityList.innerHTML = '<p class="text-red-400">Fout bij het laden van activiteiten.</p>';
    }
}
