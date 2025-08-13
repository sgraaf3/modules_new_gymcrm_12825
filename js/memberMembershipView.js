import { getData, putData, deleteData, getAllData } from '../database.js';
import { showNotification } from './notifications.js';

export async function initMemberMembershipView() {
    console.log("Member-Subscription Link View Initialized.");

    const memberSelect = document.getElementById('memberSelect');
    const subscriptionSelect = document.getElementById('subscriptionSelect');
    const memberMembershipForm = document.getElementById('memberMembershipForm');
    const memberMembershipIdInput = document.getElementById('memberMembershipId');
    const membershipStartDateInput = document.getElementById('membershipStartDate');
    const membershipEndDateInput = document.getElementById('membershipEndDate');
    const membershipStatusSelect = document.getElementById('membershipStatus');
    const membershipNotesInput = document.getElementById('membershipNotes');
    const clearMemberMembershipFormBtn = document.getElementById('clearMemberMembershipFormBtn');
    const membershipDetailsContainer = document.getElementById('membershipDetailsContainer');

    /**
     * Populeert de dropdowns voor leden en abonnementen.
     */
    async function populateDropdowns() {
        try {
            const members = await getAllData('registry');
            const subscriptions = await getAllData('subscriptions');

            memberSelect.innerHTML = '<option value="">Select a member</option>';
            members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = member.name;
                memberSelect.appendChild(option);
            });

            subscriptionSelect.innerHTML = '<option value="">Select a subscription</option>';
            subscriptions.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.id;
                option.textContent = sub.name;
                subscriptionSelect.appendChild(option);
            });

        } catch (error) {
            console.error("Error populating dropdowns:", error);
            showNotification('Error populating dropdowns.', 'error');
        }
    }

    /**
     * Laadt en toont alle lidmaatschapskoppelingen.
     */
    async function loadMemberMemberships() {
        try {
            const memberships = await getAllData('memberMemberships');
            membershipDetailsContainer.innerHTML = '';

            if (memberships.length === 0) {
                membershipDetailsContainer.innerHTML = '<p class="text-gray-400">No links found.</p>';
                return;
            }

            // Sorteer lidmaatschappen op startdatum, nieuwste eerst
            memberships.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

            for (const membership of memberships) {
                const member = await getData('registry', membership.memberId);
                const subscription = await getData('subscriptions', membership.subscriptionId);

                // Toon alleen als zowel lid als abonnement gevonden zijn
                if (member && subscription) {
                    const membershipCard = document.createElement('div');
                    membershipCard.className = 'data-card';
                    membershipCard.innerHTML = `
                        <div class="card-header"><h3>${member.name} - ${subscription.name}</h3></div>
                        <div class="sub-value">Start: ${membership.startDate || 'N/A'} | Eind: ${membership.endDate || 'N/A'}</div>
                        <div class="sub-value">Status: ${membership.status || 'N/A'}</div>
                        <div class="sub-value">Notities: ${membership.notes || 'Geen'}</div>
                        <div class="flex justify-end mt-2">
                            <button class="text-blue-400 hover:text-blue-300 text-sm mr-2" data-action="edit-member-membership" data-id="${membership.id}">Edit</button>
                            <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-member-membership" data-id="${membership.id}">Delete</button>
                        </div>
                    `;
                    membershipDetailsContainer.appendChild(membershipCard);
                }
            }

            // Voeg event listeners toe voor bewerk/verwijder knoppen
            membershipDetailsContainer.querySelectorAll('[data-action="edit-member-membership"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const membershipId = parseInt(event.target.dataset.id);
                    const membership = await getData('memberMemberships', membershipId);
                    if (membership) {
                        memberMembershipIdInput.value = membership.id;
                        memberSelect.value = membership.memberId;
                        subscriptionSelect.value = membership.subscriptionId;
                        membershipStartDateInput.value = membership.startDate;
                        membershipEndDateInput.value = membership.endDate;
                        membershipStatusSelect.value = membership.status;
                        membershipNotesInput.value = membership.notes;
                        showNotification('Lidmaatschapskoppeling geladen voor bewerking.', 'info');
                    }
                });
            });

            membershipDetailsContainer.querySelectorAll('[data-action="delete-member-membership"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const membershipId = parseInt(event.target.dataset.id);
                    // Voor nu nog confirm, conform projectrichtlijnen. Ideaal zou een custom modal zijn.
                    if (confirm('Are you sure you want to delete this link?')) {
                        try {
                            await deleteData('memberMemberships', membershipId);
                            showNotification('Koppeling verwijderd!', 'success');
                            loadMemberMemberships(); // Herlaad de lijst
                        } catch (error) {
                            console.error("Error deleting link:", error);
                            showNotification('Error deleting link.', 'error');
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Error loading links:", error);
            showNotification("Error loading links.", "error");
        }
    }

    // Event listener voor het opslaan/bewerken van een lidmaatschapskoppeling
    if (memberMembershipForm) {
        memberMembershipForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const membershipData = {
                id: memberMembershipIdInput.value ? parseInt(memberMembershipIdInput.value) : undefined, // AutoIncrement voor nieuwe koppelingen
                memberId: parseInt(memberSelect.value),
                subscriptionId: parseInt(subscriptionSelect.value),
                startDate: membershipStartDateInput.value,
                endDate: membershipEndDateInput.value,
                status: membershipStatusSelect.value,
                notes: membershipNotesInput.value
            };

            try {
                await putData('memberMemberships', membershipData);
                showNotification('Koppeling opgeslagen!', 'success');
                memberMembershipForm.reset();
                memberMembershipIdInput.value = ''; // Maak verborgen ID leeg
                loadMemberMemberships(); // Herlaad de lijst
            } catch (error) {
                console.error("Error saving link:", error);
                showNotification('Error saving link.', 'error');
            }
        });
    }

    // Event listener voor de "Clear Form" knop
    if (clearMemberMembershipFormBtn) {
        clearMemberMembershipFormBtn.addEventListener('click', () => {
            memberMembershipForm.reset();
            memberMembershipIdInput.value = ''; // Maak verborgen ID leeg
            showNotification('Form cleared.', 'info');
        });
    }

    // Initialisatie: populeren dropdowns en laden lidmaatschappen
    await populateDropdowns();
    await loadMemberMemberships();
}
