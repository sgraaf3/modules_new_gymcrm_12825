// Bestand: js/views/subscriptionsView.js
// Bevat logica voor het beheren van abonnementen (CRUD-operaties).

import { getData, putData, deleteData, getAllData } from '../database.js';
import { showNotification } from './notifications.js'; // Importeer notificatiesysteem

export async function initSubscriptionsView() {
    console.log("Abonnementen Beheer View geïnitialiseerd.");

    const subscriptionsList = document.getElementById('subscriptionsList');
    const subscriptionForm = document.getElementById('subscriptionForm');
    const subscriptionIdInput = document.getElementById('subscriptionId');
    const subscriptionNameInput = document.getElementById('subscriptionName');
    const subscriptionPriceInput = document.getElementById('subscriptionPrice');
    const subscriptionDurationInput = document.getElementById('subscriptionDuration');
    const subscriptionDescriptionInput = document.getElementById('subscriptionDescription');
    const clearSubscriptionFormBtn = document.getElementById('clearSubscriptionFormBtn');

    async function loadSubscriptions() {
        try {
            const subscriptions = await getAllData('subscriptions');
            subscriptionsList.innerHTML = ''; // Maak de bestaande lijst leeg

            if (subscriptions.length === 0) {
                subscriptionsList.innerHTML = '<p class="text-gray-400">Geen abonnementen gevonden.</p>';
                return;
            }

            subscriptions.forEach(sub => {
                const subscriptionCard = document.createElement('div');
                subscriptionCard.className = 'data-card';
                subscriptionCard.innerHTML = `
                    <div class="card-header"><h3>${sub.name}</h3></div>
                    <div class="main-value">€ ${sub.price.toFixed(2)}</div>
                    <div class="sub-value">${sub.duration} maanden</div>
                    <div class="sub-value">${sub.description}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-blue-400 hover:text-blue-300 text-sm mr-2" data-action="edit-subscription" data-id="${sub.id}">Bewerk</button>
                        <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-subscription" data-id="${sub.id}">Verwijder</button>
                    </div>
                `;
                subscriptionsList.appendChild(subscriptionCard);
            });

            // Voeg event listeners toe voor bewerk/verwijder knoppen
            subscriptionsList.querySelectorAll('[data-action="edit-subscription"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const subId = parseInt(event.target.dataset.id);
                    const subscription = await getData('subscriptions', subId);
                    if (subscription) {
                        subscriptionIdInput.value = subscription.id;
                        subscriptionNameInput.value = subscription.name;
                        subscriptionPriceInput.value = subscription.price;
                        subscriptionDurationInput.value = subscription.duration;
                        subscriptionDescriptionInput.value = subscription.description;
                    }
                });
            });

            subscriptionsList.querySelectorAll('[data-action="delete-subscription"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const subId = parseInt(event.target.dataset.id);
                    // Vervang confirm() door een custom modal of notificatie met actie
                    if (confirm('Weet u zeker dat u dit abonnement wilt verwijderen?')) { // Voor nu nog confirm
                        try {
                            await deleteData('subscriptions', subId);
                            showNotification('Abonnement verwijderd!', 'success');
                            loadSubscriptions(); // Herlaad de lijst
                        } catch (error) {
                            console.error("Fout bij verwijderen abonnement:", error);
                            showNotification('Fout bij verwijderen abonnement.', 'error');
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Fout bij laden abonnementen:", error);
            showNotification("Fout bij laden abonnementen.", "error");
        }
    }

    if (subscriptionForm) {
        subscriptionForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const subscription = {
                id: subscriptionIdInput.value ? parseInt(subscriptionIdInput.value, 10) : undefined,
                name: subscriptionNameInput.value,
                price: parseFloat(subscriptionPriceInput.value) || 0,
                duration: parseInt(subscriptionDurationInput.value) || 0,
                description: subscriptionDescriptionInput.value
            };

            if (isNaN(subscription.id)) {
                delete subscription.id;
            }
            try {
                await putData('subscriptions', subscription);
                showNotification('Abonnement opgeslagen!', 'success');
                subscriptionForm.reset();
                subscriptionIdInput.value = ''; // Maak verborgen ID leeg
                loadSubscriptions(); // Herlaad de lijst
            } catch (error) {
                console.error("Fout bij opslaan abonnement:", error);
                showNotification('Fout bij opslaan abonnement.', 'error');
            }
        });
    }

    // Voeg listener toe voor de "Formulier Leegmaken" knop
    if (clearSubscriptionFormBtn) {
        clearSubscriptionFormBtn.addEventListener('click', () => {
            subscriptionForm.reset();
            subscriptionIdInput.value = '';
            showNotification('Formulier leeggemaakt.', 'info');
        });
    }

    await loadSubscriptions(); // Laad abonnementen bij initialisatie van de view
}
