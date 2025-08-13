// Bestand: js/views/docsView.js
// Bevat logica voor het beheren van documenten en het koppelen ervan aan leden of lessen.

import { putData, getAllData, deleteData, getData } from '../database.js';
import { showNotification } from './notifications.js';

export async function initDocsView() {
    console.log("Documenten View geïnitialiseerd.");

    const documentForm = document.getElementById('documentForm');
    const documentIdInput = document.getElementById('documentId');
    const documentTitleInput = document.getElementById('documentTitle');
    const documentDescriptionInput = document.getElementById('documentDescription');
    const documentFileNameInput = document.getElementById('documentFileName'); // This is now a text input for filename/URL
    const documentCategoryInput = document.getElementById('documentCategory');
    const saveDocumentBtn = document.getElementById('saveDocumentBtn');
    const clearDocumentFormBtn = document.getElementById('clearDocumentFormBtn');
    const existingDocumentsList = document.getElementById('existingDocumentsList');

    const linkDocumentForm = document.getElementById('linkDocumentForm');
    const linkDocumentSelect = document.getElementById('linkDocumentSelect');
    const linkTargetTypeSelect = document.getElementById('linkTargetType');
    const linkMemberContainer = document.getElementById('linkMemberContainer');
    const linkMemberSelect = document.getElementById('linkMemberSelect');
    const linkLessonContainer = document.getElementById('linkLessonContainer');
    const linkLessonSelect = document.getElementById('linkLessonSelect');
    const linkedDocumentsList = document.getElementById('linkedDocumentsList');
    const linkDocumentBtn = document.getElementById('linkDocumentBtn');

    /**
     * Laadt alle documenten uit de database en toont ze in de lijst en dropdowns.
     */
    async function loadDocuments() {
        try {
            const documents = await getAllData('documents');
            existingDocumentsList.innerHTML = '';
            linkDocumentSelect.innerHTML = '<option value="">Selecteer een document</option>';

            if (documents.length === 0) {
                existingDocumentsList.innerHTML = '<p class="text-gray-400">Geen documenten gevonden.</p>';
                return;
            }

            documents.forEach(doc => {
                const docCard = document.createElement('div');
                docCard.className = 'data-card';
                docCard.innerHTML = `
                    <div class="card-header"><h3>${doc.title}</h3></div>
                    <div class="sub-value">${doc.description || 'Geen beschrijving'}</div>
                    <div class="sub-value">Bestand: ${doc.fileName || 'N/A'}</div>
                    <div class="sub-value">Categorie: ${doc.category || 'N/A'}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-blue-400 hover:text-blue-300 text-sm mr-2" data-action="edit-document" data-id="${doc.id}">Bewerk</button>
                        <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-document" data-id="${doc.id}">Verwijder</button>
                    </div>
                `;
                existingDocumentsList.appendChild(docCard);

                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = doc.title;
                linkDocumentSelect.appendChild(option);
            });

            // Voeg event listeners toe voor bewerk/verwijder knoppen
            existingDocumentsList.querySelectorAll('[data-action="edit-document"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const docId = parseInt(event.target.dataset.id);
                    const doc = await getData('documents', docId);
                    if (doc) {
                        documentIdInput.value = doc.id;
                        documentTitleInput.value = doc.title;
                        documentDescriptionInput.value = doc.description;
                        documentFileNameInput.value = doc.fileName;
                        documentCategoryInput.value = doc.category;
                        showNotification('Document geladen voor bewerking.', 'info');
                    }
                });
            });

            existingDocumentsList.querySelectorAll('[data-action="delete-document"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const docId = parseInt(event.target.dataset.id);
                    // Voor nu nog confirm, conform projectrichtlijnen. Ideaal zou een custom modal zijn.
                    if (confirm('Weet u zeker dat u dit document wilt verwijderen?')) {
                        try {
                            await deleteData('documents', docId);
                            showNotification('Document verwijderd!', 'success');
                            loadDocuments(); // Herlaad de lijst en dropdowns
                            loadLinkedDocuments(); // Update gekoppelde documenten
                        } catch (error) {
                            console.error("Fout bij verwijderen document:", error);
                            showNotification('Fout bij verwijderen document.', 'error');
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Fout bij laden documenten:", error);
            showNotification("Fout bij laden documenten.", "error");
        }
    }

    /**
     * Laadt leden en lessen om dropdowns voor koppeling te populeren.
     */
    async function loadMembersAndLessons() {
        try {
            const members = await getAllData('registry');
            const lessons = await getAllData('lessons');

            linkMemberSelect.innerHTML = '<option value="">Selecteer Lid</option>';
            members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = member.name;
                linkMemberSelect.appendChild(option);
            });

            linkLessonSelect.innerHTML = '<option value="">Selecteer Les</option>';
            lessons.forEach(lesson => {
                const option = document.createElement('option');
                option.value = lesson.id;
                option.textContent = lesson.name; // Assuming lesson has a name property
                linkLessonSelect.appendChild(option);
            });

        } catch (error) {
            console.error("Fout bij laden leden en lessen:", error);
            showNotification('Fout bij laden leden en lessen.', 'error');
        }
    }

    /**
     * Laadt en toont gekoppelde documenten.
     */
    async function loadLinkedDocuments() {
        try {
            const linkedDocs = await getAllData('linkedDocuments');
            linkedDocumentsList.innerHTML = '';

            if (linkedDocs.length === 0) {
                linkedDocumentsList.innerHTML = '<p class="text-gray-400">Geen gekoppelde documenten gevonden.</p>';
                return;
            }

            for (const link of linkedDocs) {
                const document = await getData('documents', link.documentId);
                let targetName = 'Onbekend';
                if (link.targetType === 'member') {
                    const member = await getData('registry', link.targetId);
                    targetName = member ? member.name : targetName;
                } else if (link.targetType === 'lesson') {
                    const lesson = await getData('lessons', link.targetId);
                    targetName = lesson ? lesson.name : targetName;
                }

                if (document) {
                    const linkCard = document.createElement('div');
                    linkCard.className = 'data-card';
                    linkCard.innerHTML = `
                        <div class="card-header"><h3>${document.title} gekoppeld aan ${targetName}</h3></div>
                        <div class="sub-value">Type: ${link.targetType} | Gekoppeld op: ${new Date(link.linkedDate).toLocaleDateString()}</div>
                        <div class="flex justify-end mt-2">
                            <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-link" data-id="${link.id}">Ontkoppel</button>
                        </div>
                    `;
                    linkedDocumentsList.appendChild(linkCard);
                }
            }

            // Voeg event listeners toe voor ontkoppelknoppen
            linkedDocumentsList.querySelectorAll('[data-action="delete-link"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const linkId = parseInt(event.target.dataset.id);
                    if (confirm('Weet u zeker dat u deze koppeling wilt verwijderen?')) {
                        try {
                            await deleteData('linkedDocuments', linkId);
                            showNotification('Koppeling verwijderd!', 'success');
                            loadLinkedDocuments(); // Herlaad de lijst
                        } catch (error) {
                            console.error("Fout bij verwijderen koppeling:", error);
                            showNotification('Fout bij verwijderen koppeling.', 'error');
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Fout bij laden gekoppelde documenten:", error);
            showNotification("Fout bij laden gekoppelde documenten.", "error");
        }
    }

    // Event listener voor het opslaan/bewerken van een document
    if (documentForm) {
        documentForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const documentData = {
                id: documentIdInput.value ? parseInt(documentIdInput.value) : undefined, // AutoIncrement voor nieuwe documenten
                title: documentTitleInput.value,
                description: documentDescriptionInput.value,
                fileName: documentFileNameInput.value, // Kan een URL of bestandsnaam zijn
                category: documentCategoryInput.value,
                dateAdded: new Date().toISOString() // Tijdstempel voor sortering/tracking
            };

            try {
                await putData('documents', documentData);
                showNotification('Document opgeslagen!', 'success');
                documentForm.reset();
                documentIdInput.value = ''; // Maak verborgen ID leeg
                loadDocuments(); // Herlaad de lijsten en dropdowns
            } catch (error) {
                console.error("Fout bij opslaan document:", error);
                showNotification('Fout bij opslaan document.', 'error');
            }
        });
    }

    // Event listener voor de "Formulier Leegmaken" knop (document formulier)
    if (clearDocumentFormBtn) {
        clearDocumentFormBtn.addEventListener('click', () => {
            documentForm.reset();
            documentIdInput.value = '';
            showNotification('Document formulier leeggemaakt.', 'info');
        });
    }

    // Event listener voor het schakelen tussen Lid/Les selectie in koppelformulier
    if (linkTargetTypeSelect) {
        linkTargetTypeSelect.addEventListener('change', (event) => {
            if (event.target.value === 'member') {
                linkMemberContainer.classList.remove('hidden');
                linkLessonContainer.classList.add('hidden');
            } else if (event.target.value === 'lesson') {
                linkMemberContainer.classList.add('hidden');
                linkLessonContainer.classList.remove('hidden');
            }
        });
        // Trigger change on load to set initial visibility
        linkTargetTypeSelect.dispatchEvent(new Event('change'));
    }

    // Event listener voor het koppelen van een document
    if (linkDocumentForm) {
        linkDocumentForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const selectedDocumentId = parseInt(linkDocumentSelect.value);
            const selectedTargetType = linkTargetTypeSelect.value;
            let selectedTargetId;

            if (selectedTargetType === 'member') {
                selectedTargetId = parseInt(linkMemberSelect.value);
            } else if (selectedTargetType === 'lesson') {
                selectedTargetId = parseInt(linkLessonSelect.value);
            }

            if (isNaN(selectedDocumentId) || isNaN(selectedTargetId)) {
                showNotification('Selecteer een document en een geldige koppeling.', 'warning');
                return;
            }

            const linkedDocumentData = {
                documentId: selectedDocumentId,
                targetType: selectedTargetType,
                targetId: selectedTargetId,
                linkedDate: new Date().toISOString() // Tijdstempel voor koppeling
            };

            try {
                await putData('linkedDocuments', linkedDocumentData);
                showNotification('Document gekoppeld!', 'success');
                linkDocumentForm.reset();
                loadLinkedDocuments(); // Herlaad de lijst
            } catch (error) {
                console.error("Fout bij koppelen document:", error);
                showNotification('Fout bij koppelen document.', 'error');
            }
        });
    }

    // Initialisatie: laad alle benodigde data
    await loadDocuments();
    await loadMembersAndLessons();
    await loadLinkedDocuments();
}
