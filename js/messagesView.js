// Bestand: js/views/messagesView.js
// Bevat logica voor het berichtensysteem.

import { getData, putData, deleteData, getAllData, getOrCreateUserId } from '../database.js';
import { showNotification } from './notifications.js';

export async function initMessagesView() {
    console.log("Berichtenscherm View geïnitialiseerd.");

    const messageForm = document.getElementById('messageForm');
    const messageIdInput = document.getElementById('messageId');
    const messageRecipientInput = document.getElementById('messageRecipient');
    const messageSubjectInput = document.getElementById('messageSubject');
    const messageContentInput = document.getElementById('messageContent');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const clearMessageFormBtn = document.getElementById('clearMessageFormBtn');
    const receivedMessagesList = document.getElementById('receivedMessagesList');
    const sentMessagesList = document.getElementById('sentMessagesList');

    const currentUserId = getOrCreateUserId();

    /**
     * Populeert de ontvanger dropdown met alle geregistreerde gebruikers.
     */
    async function populateRecipientsDropdown() {
        try {
            const users = await getAllData('registry'); // Haal alle geregistreerde gebruikers op
            messageRecipientInput.innerHTML = '<option value="">Selecteer ontvanger</option><option value="all">Alle gebruikers</option>'; // Reset en voeg standaardopties toe

            users.forEach(user => {
                // Voorkom dat de huidige gebruiker zichzelf een bericht stuurt via deze dropdown
                if (user.id !== currentUserId) {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = user.name;
                    messageRecipientInput.appendChild(option);
                }
            });
        } catch (error) {
            console.error("Fout bij populeren ontvanger dropdown:", error);
            showNotification('Fout bij laden gebruikers voor berichten.', 'error');
        }
    }

    /**
     * Laadt en toont ontvangen en verzonden berichten.
     */
    async function loadMessages() {
        try {
            const allMessages = await getAllData('messages');
            receivedMessagesList.innerHTML = '';
            sentMessagesList.innerHTML = '';

            // Filter berichten voor de huidige gebruiker
            const received = allMessages.filter(msg => msg.recipientId === currentUserId || msg.recipientId === 'all');
            const sent = allMessages.filter(msg => msg.senderId === currentUserId);

            if (received.length === 0) {
                receivedMessagesList.innerHTML = '<p class="text-gray-400">Geen ontvangen berichten.</p>';
            } else {
                received.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sorteer nieuwste eerst
                for (const msg of received) {
                    const sender = await getData('registry', msg.senderId);
                    const senderName = sender ? sender.name : 'Onbekend';
                    const messageCard = document.createElement('div');
                    messageCard.className = 'data-card';
                    messageCard.innerHTML = `
                        <div class="card-header"><h3>${msg.subject}</h3></div>
                        <div class="sub-value">Van: ${senderName} | Datum: ${new Date(msg.timestamp).toLocaleString()}</div>
                        <div class="sub-value">${msg.content}</div>
                        <div class="flex justify-end mt-2">
                            <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-message" data-id="${msg.id}" data-list="received">Verwijder</button>
                        </div>
                    `;
                    receivedMessagesList.appendChild(messageCard);
                }
            }

            if (sent.length === 0) {
                sentMessagesList.innerHTML = '<p class="text-gray-400">Geen verzonden berichten.</p>';
            } else {
                sent.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sorteer nieuwste eerst
                for (const msg of sent) {
                    const recipient = msg.recipientId === 'all' ? 'Alle gebruikers' : (await getData('registry', msg.recipientId))?.name || 'Onbekend';
                    const messageCard = document.createElement('div');
                    messageCard.className = 'data-card';
                    messageCard.innerHTML = `
                        <div class="card-header"><h3>${msg.subject}</h3></div>
                        <div class="sub-value">Aan: ${recipient} | Datum: ${new Date(msg.timestamp).toLocaleString()}</div>
                        <div class="sub-value">${msg.content}</div>
                        <div class="flex justify-end mt-2">
                            <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-message" data-id="${msg.id}" data-list="sent">Verwijder</button>
                        </div>
                    `;
                    sentMessagesList.appendChild(messageCard);
                }
            }

            // Voeg event listeners toe voor verwijderknoppen
            document.querySelectorAll('[data-action="delete-message"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const messageId = parseInt(event.target.dataset.id);
                    // Voor nu nog confirm, conform projectrichtlijnen. Ideaal zou een custom modal zijn.
                    if (confirm('Weet u zeker dat u dit bericht wilt verwijderen?')) {
                        try {
                            await deleteData('messages', messageId);
                            showNotification('Bericht verwijderd!', 'success');
                            loadMessages(); // Herlaad de lijsten
                        } catch (error) {
                            console.error("Fout bij verwijderen bericht:", error);
                            showNotification('Fout bij verwijderen bericht.', 'error');
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Fout bij laden berichten:", error);
            showNotification("Fout bij laden berichten.", "error");
        }
    }

    // Event listener voor het versturen van berichten
    if (messageForm) {
        messageForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const message = {
                id: messageIdInput.value ? parseInt(messageIdInput.value) : undefined, // Gebruik undefined voor autoIncrement
                senderId: currentUserId,
                recipientId: messageRecipientInput.value === 'all' ? 'all' : parseInt(messageRecipientInput.value),
                subject: messageSubjectInput.value,
                content: messageContentInput.value,
                timestamp: new Date().toISOString()
            };

            try {
                await putData('messages', message);
                showNotification('Bericht verzonden!', 'success');
                messageForm.reset();
                messageIdInput.value = ''; // Maak verborgen ID leeg
                loadMessages(); // Herlaad de lijsten
            } catch (error) {
                console.error("Fout bij verzenden bericht:", error);
                showNotification('Fout bij verzenden bericht.', 'error');
            }
        });
    }

    // Event listener voor de "Formulier Leegmaken" knop
    if (clearMessageFormBtn) {
        clearMessageFormBtn.addEventListener('click', () => {
            messageForm.reset();
            messageIdInput.value = ''; // Maak verborgen ID leeg
            showNotification('Formulier leeggemaakt.', 'info');
        });
    }

    // Initialisatie: populeren dropdown en laden berichten
    await populateRecipientsDropdown();
    await loadMessages();
}
