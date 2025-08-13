// Bestand: js/views/notesView.js
// Bevat logica voor het beheren van notities.

import { getData, putData, deleteData, getAllData } from '../database.js';
import { showNotification } from './notifications.js'; // Importeer notificatiesysteem

export async function initNotesView() {
    console.log("Notities View geïnitialiseerd.");

    const notesList = document.getElementById('notesList');
    const noteForm = document.getElementById('noteForm');
    const noteIdInput = document.getElementById('noteId');
    const noteTitleInput = document.getElementById('noteTitle');
    const noteContentInput = document.getElementById('noteContent');
    const clearNoteFormBtn = document.getElementById('clearNoteFormBtn');

    /**
     * Laadt alle notities uit de database en toont ze in de lijst.
     */
    async function loadNotes() {
        try {
            const notes = await getAllData('notesData'); // 'notesData' is de store voor notities
            notesList.innerHTML = ''; // Maak de bestaande lijst leeg

            if (notes.length === 0) {
                notesList.innerHTML = '<p class="text-gray-400">Geen notities gevonden.</p>';
                return;
            }

            // Sorteer notities van nieuw naar oud
            notes.sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));

            notes.forEach(note => {
                const noteCard = document.createElement('div');
                noteCard.className = 'data-card';
                noteCard.innerHTML = `
                    <div class="card-header"><h3>${note.title}</h3></div>
                    <div class="sub-value">Aangemaakt op: ${new Date(note.dateCreated).toLocaleDateString()}</div>
                    <div class="sub-value">${note.content || 'Geen inhoud'}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-blue-400 hover:text-blue-300 text-sm mr-2" data-action="edit-note" data-id="${note.id}">Bewerk</button>
                        <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-note" data-id="${note.id}">Verwijder</button>
                    </div>
                `;
                notesList.appendChild(noteCard);
            });

            // Voeg event listeners toe voor bewerk/verwijder knoppen
            notesList.querySelectorAll('[data-action="edit-note"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const noteId = parseInt(event.target.dataset.id);
                    const note = await getData('notesData', noteId);
                    if (note) {
                        noteIdInput.value = note.id;
                        noteTitleInput.value = note.title;
                        noteContentInput.value = note.content;
                        showNotification('Notitie geladen voor bewerking.', 'info');
                    }
                });
            });

            notesList.querySelectorAll('[data-action="delete-note"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const noteId = parseInt(event.target.dataset.id);
                    // Voor nu nog confirm, conform projectrichtlijnen. Ideaal zou een custom modal zijn.
                    if (confirm('Weet u zeker dat u deze notitie wilt verwijderen?')) {
                        try {
                            await deleteData('notesData', noteId);
                            showNotification('Notitie verwijderd!', 'success');
                            loadNotes(); // Herlaad de lijst
                        } catch (error) {
                            console.error("Fout bij verwijderen notitie:", error);
                            showNotification('Fout bij verwijderen notitie.', 'error');
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Fout bij laden notities:", error);
            showNotification("Fout bij laden notities.", "error");
        }
    }

    // Event listener voor het opslaan/bewerken van een notitie
    if (noteForm) {
        noteForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const note = {
                id: noteIdInput.value ? parseInt(noteIdInput.value) : undefined, // Gebruik undefined voor autoIncrement bij nieuwe notities
                title: noteTitleInput.value,
                content: noteContentInput.value,
                dateCreated: new Date().toISOString() // Tijdstempel voor sortering
            };
            try {
                await putData('notesData', note);
                showNotification('Notitie opgeslagen!', 'success');
                noteForm.reset();
                noteIdInput.value = ''; // Maak verborgen ID leeg
                loadNotes(); // Herlaad de lijst
            } catch (error) {
                console.error("Fout bij opslaan notitie:", error);
                showNotification('Fout bij opslaan notitie.', 'error');
            }
        });
    }

    // Event listener voor de "Formulier Leegmaken" knop
    if (clearNoteFormBtn) {
        clearNoteFormBtn.addEventListener('click', () => {
            noteForm.reset();
            noteIdInput.value = ''; // Maak verborgen ID leeg
            showNotification('Formulier leeggemaakt.', 'info');
        });
    }

    // Initial load of notes when the view is initialized
    await loadNotes();
}
