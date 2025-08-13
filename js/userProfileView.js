// Bestand: js/userProfileView.js
import { getData, putData, getAllData, getOrCreateUserId } from '../database.js';
import { showNotification } from './notifications.js';

export async function initUserProfileView(showView, data) {
    // Correctie: Haal de userId uit de meegegeven data of gebruik de globale ID.
    const userId = data && data.userId ? data.userId : getOrCreateUserId();
    console.log(`Initializing User Profile View for user ${userId}`);

    const userProfileForm = document.getElementById('userProfileForm');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const userProfileTitle = document.getElementById('user-profile-title');
    const profilePictureElement = document.getElementById('profilePicture');
    const profilePictureUploadInput = document.getElementById('profilePictureUpload');

    /**
     * Laadt de gebruikersprofielgegevens uit de database en vult de formuliervelden.
     */
    async function loadUserProfile() {
        try {
            const profileData = await getData('userProfile', userId);
            if (profileData) {
                userProfileTitle.textContent = `${profileData.userName || 'Gebruiker'}'s Profiel`;
                // Vul alle formuliervelden in op basis van de geladen profielgegevens
                for (const key in profileData) {
                    const input = document.getElementById(key);
                    if (input) {
                        // Speciale behandeling voor radiobuttons of checkboxes indien aanwezig
                        if (input.type === 'checkbox') {
                            input.checked = profileData[key];
                        } else {
                            input.value = profileData[key];
                        }
                    }
                }
                // Laad profielfoto indien aanwezig
                if (profileData.profilePicture) {
                    profilePictureElement.src = profileData.profilePicture;
                }
            } else {
                // Als er geen userProfile bestaat, probeer dan basisinformatie uit registry te halen
                const registryData = await getData('registry', userId);
                if (registryData) {
                    userProfileTitle.textContent = `${registryData.name || 'Gebruiker'}'s Profiel`;
                    document.getElementById('userName').value = registryData.name || '';
                    document.getElementById('userEmail').value = registryData.email || '';
                    document.getElementById('userPhone').value = registryData.phone || '';
                    // Initialiseer met default profielfoto
                    profilePictureElement.src = "https://via.placeholder.com/128?text=Profiel";
                } else {
                    userProfileTitle.textContent = `Profiel`;
                    profilePictureElement.src = "https://via.placeholder.com/128?text=Profiel";
                }
            }
        } catch (error) {
            console.error("Error loading user profile:", error);
            showNotification('Error loading user profile.', 'error');
        }
    }

    /**
     * Laadt het toegewezen abonnement van de gebruiker.
     */
    async function loadAssignedSubscription() {
        try {
            const memberships = await getAllData('memberMemberships');
            // Zoek naar lidmaatschappen die gekoppeld zijn aan deze userId
            const userMembership = memberships.find(mem => mem.memberId === parseInt(userId));
            const section = document.getElementById('assigned-subscription-section');

            if (userMembership) {
                const subscription = await getData('subscriptions', userMembership.subscriptionId);
                if (subscription) {
                    section.innerHTML = `
                        <div class="bg-gray-700 p-4 rounded-lg">
                            <p><strong>Naam:</strong> ${subscription.name || 'N/A'}</p>
                            <p><strong>Status:</strong> ${userMembership.status || 'N/A'}</p>
                            <p><strong>Startdatum:</strong> ${userMembership.startDate || 'N/A'}</p>
                            <p><strong>Einddatum:</strong> ${userMembership.endDate || 'N/A'}</p>
                            <p><strong>Notities:</strong> ${userMembership.notes || 'Geen'}</p>
                        </div>
                    `;
                } else {
                    section.innerHTML = '<p class="text-gray-400">Abonnement niet gevonden.</p>';
                }
            } else {
                section.innerHTML = '<p class="text-gray-400">Geen abonnement toegewezen.</p>';
            }
        } catch (error) {
            console.error("Error loading assigned subscription:", error);
            showNotification('Error loading subscription.', 'error');
        }
    }

    /**
     * Laadt de trainingsgeschiedenis van de gebruiker.
     */
    async function loadTrainingHistory() {
        try {
            const sessions = await getAllData('trainingSessions');
            const userSessions = sessions.filter(session => session.userId === userId);
            const section = document.getElementById('training-history-section');

            if (userSessions.length > 0) {
                // Sorteer sessies van nieuw naar oud
                userSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
                section.innerHTML = userSessions.map(session => `
                    <div class="bg-gray-700 p-4 rounded-lg mb-2">
                        <p><strong>Datum:</strong> ${new Date(session.date).toLocaleDateString()}</p>
                        <p><strong>Type:</strong> ${session.type || 'N/A'}</p>
                        <p><strong>Duur:</strong> ${session.duration || '--'} minuten</p>
                        <p><strong>Gem. HR:</strong> ${session.avgHr || '--'} BPM</p>
                        <p><strong>RMSSD:</strong> ${session.rmssd ? session.rmssd.toFixed(2) : '--'} MS</p>
                    </div>
                `).join('');
            } else {
                section.innerHTML = '<p class="text-gray-400">Geen trainingsgeschiedenis beschikbaar.</p>';
            }
        } catch (error) {
            console.error("Error loading training history:", error);
            showNotification('Error loading training history.', 'error');
        }
    }

    /**
     * Laadt de activiteitenlog van de gebruiker.
     */
    async function loadActivityLog() {
        try {
            // Combineer relevante activiteitenlogs voor deze gebruiker
            const memberActivities = await getAllData('memberActivity'); // Algemene lidactiviteiten
            const foodLogs = await getAllData('foodLogs'); // Voedingslogs
            const sleepData = await getAllData('sleepData'); // Slaaplogs
            const meetings = await getAllData('meetings'); // Vergaderingen waar de gebruiker aan deelneemt

            let allUserActivities = [];

            // Voeg algemene lidactiviteiten toe
            memberActivities.filter(activity => activity.userId === userId).forEach(a => {
                allUserActivities.push({
                    date: a.date || a.timestamp,
                    activity: a.activity || a.description,
                    type: 'Algemene Activiteit'
                });
            });

            // Voeg voedingslogs toe
            foodLogs.filter(log => log.memberId === parseInt(userId)).forEach(log => {
                allUserActivities.push({
                    date: log.logDate,
                    activity: `Voedingslog: ${log.foodEntry.substring(0, 50)}${log.foodEntry.length > 50 ? '...' : ''}`,
                    type: 'Voeding'
                });
            });

            // Voeg slaaplogs toe
            sleepData.filter(log => log.userId === userId).forEach(log => { // Assuming sleepData has userId
                allUserActivities.push({
                    date: log.date,
                    activity: `Slaap: ${log.duration} uur, Kwaliteit: ${log.quality}/10`,
                    type: 'Slaap'
                });
            });

            // Voeg vergaderingen toe waar de gebruiker aan deelneemt
            meetings.filter(meeting => meeting.attendees && meeting.attendees.includes(userId)).forEach(m => { // Assuming attendees is a comma-separated string or array
                allUserActivities.push({
                    date: m.date,
                    activity: `Vergadering: ${m.subject}`,
                    type: 'Vergadering'
                });
            });


            // Sorteer alle activiteiten chronologisch (nieuwste eerst)
            allUserActivities.sort((a, b) => new Date(b.date) - new Date(a.date));

            const section = document.getElementById('activity-log-section');
            if (allUserActivities.length > 0) {
                section.innerHTML = allUserActivities.map(activity => `
                    <div class="bg-gray-700 p-4 rounded-lg mb-2">
                        <p><strong>Datum:</strong> ${new Date(activity.date).toLocaleString()}</p>
                        <p><strong>Activiteit:</strong> ${activity.activity}</p>
                        <p class="text-xs text-gray-500">Type: ${activity.type}</p>
                    </div>
                `).join('');
            } else {
                section.innerHTML = '<p class="text-gray-400">Geen activiteitenlog beschikbaar.</p>';
            }
        } catch (error) {
            console.error("Error loading activity log:", error);
            showNotification('Error loading activity log.', 'error');
        }
    }

    // Event listener voor het opslaan van het profiel
    if (userProfileForm) {
        saveProfileBtn.addEventListener('click', async () => {
            const profileData = { id: userId };
            userProfileForm.querySelectorAll('input, select, textarea').forEach(input => {
                // Sla alleen velden op die een ID hebben en niet de profielfoto upload input
                if (input.id && input.id !== 'profilePictureUpload') {
                    if (input.type === 'checkbox') {
                        profileData[input.id] = input.checked;
                    } else {
                        profileData[input.id] = input.value;
                    }
                }
            });
            // Voeg de profielfoto URL toe aan de op te slaan data
            profileData.profilePicture = profilePictureElement.src;
            // Zorg ervoor dat de naam en email ook worden opgeslagen in de registry voor consistentie
            const registryUpdate = {
                id: userId,
                name: profileData.userName,
                email: profileData.userEmail,
                phone: profileData.userPhone // Optioneel: ook telefoon updaten
            };


            try {
                await putData('userProfile', profileData);
                await putData('registry', registryUpdate); // Update ook de registry
                showNotification('Profiel opgeslagen!', 'success');
            } catch (error) {
                console.error("Error saving profile:", error);
                showNotification('Error saving profile.', 'error');
            }
        });
    }

    // Event listener voor het uploaden van de profielfoto
    if (profilePictureUploadInput) {
        profilePictureUploadInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    profilePictureElement.src = e.target.result;
                    showNotification('Profielfoto geladen. Vergeet niet op "Profiel Opslaan" te klikken.', 'info', 5000);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Event listeners voor het in- en uitklappen van secties
    document.querySelectorAll('[data-toggle]').forEach(element => {
        element.addEventListener('click', () => {
            const targetId = element.dataset.toggle;
            const targetElement = document.getElementById(targetId);
            const icon = element.querySelector('.toggle-icon');

            if (targetElement.classList.contains('hidden')) {
                // Inklappen
                targetElement.classList.remove('hidden');
                targetElement.classList.add('expanded');
                if (icon) icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
            } else {
                // Uitklappen
                targetElement.classList.remove('expanded');
                targetElement.classList.add('hidden');
                if (icon) icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
            }
        });
    });

    // Initialisatie: laad alle profielgegevens en gerelateerde data
    await loadUserProfile();
    await loadAssignedSubscription();
    await loadTrainingHistory();
    await loadActivityLog();

    // Open de eerste inklapbare sectie standaard
    const firstCollapsibleHeader = document.querySelector('[data-toggle="personal-info-section"]');
    if (firstCollapsibleHeader) {
        firstCollapsibleHeader.click(); // Simuleer een klik om de sectie te openen
    }
}
