// Bestand: js/views/testingView.js
// Bevat logica voor het uitvoeren van tests en het weergeven van testresultaten.

import { putData, getData, getAllData, deleteData } from '../database.js';
import { showNotification } from './notifications.js';

export async function initTestingView() {
    console.log("Testen View geïnitialiseerd.");

    const startTestBtn = document.getElementById('startTestBtn');
    const stopTestBtn = document.getElementById('stopTestBtn');
    const testStatusDisplay = document.getElementById('testStatusDisplay');
    const testResultsDisplay = document.getElementById('testResultsDisplay');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const testProtocolSelect = document.getElementById('testProtocolSelect');

    const protocolForm = document.getElementById('protocolForm');
    const protocolIdInput = document.getElementById('protocolId');
    const protocolNameInput = document.getElementById('protocolName');
    const protocolDescriptionInput = document.getElementById('protocolDescription');
    const protocolTypeSelect = document.getElementById('protocolType');
    const clearProtocolFormBtn = document.getElementById('clearProtocolFormBtn');
    const existingProtocolsList = document.getElementById('existingProtocolsList');

    /**
     * Laadt en toont testprotocollen in de dropdown en de lijst van bestaande protocollen.
     */
    async function loadTestProtocols() {
        try {
            const protocols = await getAllData('testProtocols');
            testProtocolSelect.innerHTML = '<option value="">Selecteer een protocol</option>';
            existingProtocolsList.innerHTML = '';

            if (protocols.length === 0) {
                existingProtocolsList.innerHTML = '<p class="text-gray-400">Geen protocollen gevonden.</p>';
                return;
            }

            protocols.forEach(protocol => {
                const option = document.createElement('option');
                option.value = protocol.id;
                option.textContent = protocol.name;
                testProtocolSelect.appendChild(option);

                const protocolCard = document.createElement('div');
                protocolCard.className = 'data-card';
                protocolCard.innerHTML = `
                    <div class="card-header"><h3>${protocol.name} (${protocol.type})</h3></div>
                    <div class="sub-value">${protocol.description}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-blue-400 hover:text-blue-300 text-sm mr-2" data-action="edit-protocol" data-id="${protocol.id}">Bewerk</button>
                        <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-protocol" data-id="${protocol.id}">Verwijder</button>
                    </div>
                `;
                existingProtocolsList.appendChild(protocolCard);
            });

            // Voeg event listeners toe voor bewerk/verwijder knoppen op dynamisch geladen elementen
            existingProtocolsList.querySelectorAll('[data-action="edit-protocol"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const protocolId = parseInt(event.target.dataset.id);
                    const protocol = await getData('testProtocols', protocolId);
                    if (protocol) {
                        protocolIdInput.value = protocol.id;
                        protocolNameInput.value = protocol.name;
                        protocolDescriptionInput.value = protocol.description;
                        protocolTypeSelect.value = protocol.type;
                        showNotification('Protocol geladen voor bewerking.', 'info');
                    }
                });
            });

            existingProtocolsList.querySelectorAll('[data-action="delete-protocol"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const protocolId = parseInt(event.target.dataset.id);
                    // Voor nu nog confirm, conform projectrichtlijnen. Ideaal zou een custom modal zijn.
                    if (confirm('Weet u zeker dat u dit protocol wilt verwijderen?')) {
                        try {
                            await deleteData('testProtocols', protocolId);
                            showNotification('Protocol verwijderd!', 'success');
                            loadTestProtocols(); // Herlaad de lijst
                        } catch (error) {
                            console.error("Fout bij verwijderen protocol:", error);
                            showNotification('Fout bij verwijderen protocol.', 'error');
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Fout bij laden testprotocollen:", error);
            showNotification("Fout bij laden testprotocollen.", "error");
        }
    }

    // Event listener voor de "Start Test" knop
    if (startTestBtn) {
        startTestBtn.addEventListener('click', () => {
            const selectedProtocolId = testProtocolSelect.value;
            if (!selectedProtocolId) {
                showNotification('Selecteer alstublieft een testprotocol om te starten.', 'warning');
                return;
            }
            testStatusDisplay.textContent = 'Status: Test gestart...';
            startTestBtn.style.display = 'none';
            stopTestBtn.style.display = 'block';
            testResultsDisplay.innerHTML = '<p class="text-gray-400">Bezig met meten...</p>';
            generateReportBtn.style.display = 'none';
            showNotification('Test gestart!', 'info');

            // Simuleer een testduur en toon resultaten na afloop
            setTimeout(() => {
                testStatusDisplay.textContent = 'Status: Meting voltooid.';
                testResultsDisplay.innerHTML = `
                    <div class="test-results-grid">
                        <div class="test-result-card">
                            <h4>Resultaat 1</h4>
                            <p>Waarde: 123.4</p>
                        </div>
                        <div class="test-result-card">
                            <h4>Resultaat 2</h4>
                            <p>Waarde: 56.7</p>
                        </div>
                        <div class="test-result-card">
                            <h4>Resultaat 3</h4>
                            <p>Waarde: 89.0</p>
                        </div>
                    </div>
                    <p class="text-lg text-gray-300 mt-4">Test voltooid. Genereer een rapport voor gedetailleerde analyse.</p>
                `;
                generateReportBtn.style.display = 'block';
                stopTestBtn.style.display = 'none';
                startTestBtn.style.display = 'block';
                showNotification('Test voltooid!', 'success');
            }, 5000); // Simuleer 5 seconden meting
        });
    }

    // Event listener voor de "Stop Test" knop
    if (stopTestBtn) {
        stopTestBtn.addEventListener('click', () => {
            testStatusDisplay.textContent = 'Status: Test handmatig gestopt.';
            stopTestBtn.style.display = 'none';
            startTestBtn.style.display = 'block';
            testResultsDisplay.innerHTML = '<p class="text-lg text-gray-300">Test handmatig gestopt. Geen volledige resultaten beschikbaar.</p>';
            generateReportBtn.style.display = 'none'; // Verberg rapportknop bij handmatig stoppen
            showNotification('Test handmatig gestopt.', 'info');
            // Hier zou je eventueel de lopende setTimeout kunnen clearen als die er was
        });
    }

    // Event listener voor de "Genereer Rapport" knop
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', () => {
            showNotification('Rapport gegenereerd! (Deze functionaliteit is een placeholder en toont geen echt rapport).', 'info', 5000);
            // In een echte applicatie zou hier de logica komen om een PDF te genereren of naar een rapportweergave te navigeren.
        });
    }

    // Event listener voor het opslaan/bewerken van een protocol
    if (protocolForm) {
        protocolForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const protocol = {
                id: protocolIdInput.value ? parseInt(protocolIdInput.value) : undefined, // Gebruik undefined voor autoIncrement bij nieuwe protocollen
                name: protocolNameInput.value,
                description: protocolDescriptionInput.value,
                type: protocolTypeSelect.value
            };
            try {
                await putData('testProtocols', protocol);
                showNotification('Testprotocol opgeslagen!', 'success');
                protocolForm.reset();
                protocolIdInput.value = ''; // Maak verborgen ID leeg
                loadTestProtocols(); // Herlaad de lijsten
            } catch (error) {
                console.error("Fout bij opslaan testprotocol:", error);
                showNotification('Fout bij opslaan testprotocol.', 'error');
            }
        });
    }

    // Event listener voor de "Leeg Formulier" knop
    if (clearProtocolFormBtn) {
        clearProtocolFormBtn.addEventListener('click', () => {
            protocolForm.reset();
            protocolIdInput.value = ''; // Maak verborgen ID leeg
            showNotification('Formulier leeggemaakt.', 'info');
        });
    }

    // Laad protocollen bij initialisatie van de view
    await loadTestProtocols();
}
