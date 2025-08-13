// Bestand: widgets.js
import { getData, putData, deleteData, getAllData, getUserRole, setUserRole } from './database.js';
import { BluetoothController } from './bluetooth.js';
import { Bodystandard, VO2, RuntimesVo2 } from './modules.js';

let hrBreathChart;
let historicalHrChart, historicalRmssdChart, historicalSdnnChart, historicalBreathRateChart;
let trainingHrChart;

export function initHrDataCharts() {
    const hrDataView = document.getElementById('hrDataView');
    if (!hrDataView || hrDataView.dataset.chartsInitialized) return;

    const hrBreathCtx = document.getElementById('hrBreathChart')?.getContext('2d');
    if (hrBreathCtx) {
        hrBreathChart = new Chart(hrBreathCtx, {
            type: 'line',
            data: {
                labels: ['0s', '10s', '20s', '30s', '40s', '50s', '60s'],
                datasets: [
                    {
                        label: 'Hartslag (BPM)',
                        data: [60, 62, 61, 63, 65, 64, 66],
                        borderColor: '#60a5fa',
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: 'Ademhalingsfrequentie (BPM)',
                        data: [12, 13, 12.5, 13.5, 14, 13, 12],
                        borderColor: '#4ade80',
                        tension: 0.4,
                        fill: false
                    }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const historicalHrCtx = document.getElementById('historicalHrChart')?.getContext('2d');
    if (historicalHrCtx) {
        historicalHrChart = new Chart(historicalHrCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Gemiddelde HR',
                    data: [70, 72, 68, 75, 71, 69],
                    borderColor: '#60a5fa',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const historicalRmssdCtx = document.getElementById('historicalRmssdChart')?.getContext('2d');
    if (historicalRmssdCtx) {
        historicalRmssdChart = new Chart(historicalRmssdCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'RMSSD',
                    data: [40, 42, 38, 45, 41, 39],
                    borderColor: '#4ade80',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const historicalSdnnCtx = document.getElementById('historicalSdnnChart')?.getContext('2d');
    if (historicalSdnnCtx) {
        historicalSdnnChart = new Chart(historicalSdnnCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'SDNN',
                    data: [50, 55, 48, 58, 52, 50],
                    borderColor: '#facc15',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const historicalBreathRateCtx = document.getElementById('historicalBreathRateChart')?.getContext('2d');
    if (historicalBreathRateCtx) {
        historicalBreathRateChart = new Chart(historicalBreathRateCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Ademhalingsfrequentie',
                    data: [14, 13.5, 14.2, 13.8, 14.5, 13.9],
                    borderColor: '#c084fc',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    hrDataView.dataset.chartsInitialized = true;
}

export function initUserProgressCharts() {
    const userProgressView = document.getElementById('memberSpecificprogressView');
    if (!userProgressView || userProgressView.dataset.chartsInitialized) return;

    const userProgressMainCtx = document.getElementById('userProgressMainChart')?.getContext('2d');
    if (userProgressMainCtx) {
        userProgressMainChart = new Chart(userProgressMainCtx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
                datasets: [{
                    label: 'Algemene Progressie Score',
                    data: [65, 70, 72, 75, 78, 80],
                    borderColor: '#34d399',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    userProgressView.dataset.chartsInitialized = true;
}

export async function initFinanceView() {
    const financeView = document.getElementById('financeView');
    if (!financeView || financeView.dataset.initialized) return;

    const financeTransactionForm = document.getElementById('financeTransactionForm');
    const transactionsList = document.getElementById('transactionsList');
    const transactionIdInput = document.getElementById('transactionId');
    const transactionTypeInput = document.getElementById('transactionType');
    const transactionAmountInput = document.getElementById('transactionAmount');
    const transactionDescriptionInput = document.getElementById('transactionDescription');

    async function loadTransactions() {
        const transactions = await getAllData('finance');
        transactionsList.innerHTML = '';
        let totalIncome = 0;
        let totalExpense = 0;

        if (transactions.length === 0) {
            transactionsList.innerHTML = '<p class="text-gray-400">Geen transacties gevonden.</p>';
        } else {
            transactions.forEach(transaction => {
                const transactionCard = document.createElement('div');
                transactionCard.className = 'data-card';
                const amountClass = transaction.type === 'income' ? 'text-green-400' : 'text-red-400';
                const sign = transaction.type === 'income' ? '+' : '-';
                transactionCard.innerHTML = `
                    <div class="card-header"><h3>${transaction.description}</h3></div>
                    <div class="main-value ${amountClass}">${sign} € ${transaction.amount.toFixed(2)}</div>
                    <div class="sub-value">${new Date(transaction.date).toLocaleDateString()}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-transaction" data-id="${transaction.id}">Verwijder</button>
                    </div>
                `;
                transactionsList.appendChild(transactionCard);

                if (transaction.type === 'income') {
                    totalIncome += transaction.amount;
                } else {
                    totalExpense += transaction.amount;
                }
            });
        }

        document.querySelector('#financeView .data-card .main-value.text-green-400').textContent = `€ ${totalIncome.toFixed(2)}`;
        document.querySelector('#financeView .data-card .main-value.text-red-400').textContent = `€ ${totalExpense.toFixed(2)}`;
        document.querySelector('#financeView .data-card:nth-child(3) .main-value').textContent = `€ ${(totalIncome - totalExpense).toFixed(2)}`;

        transactionsList.querySelectorAll('[data-action="delete-transaction"]').forEach(button => {
            button.addEventListener('click', async (event) => {
                const transactionId = parseInt(event.target.dataset.id);
                if (confirm('Weet u zeker dat u deze transactie wilt verwijderen?')) {
                    await deleteData('finance', transactionId);
                    loadTransactions();
                }
            });
        });
    }

    if (financeTransactionForm) {
        financeTransactionForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const transaction = {
                id: transactionIdInput.value ? parseInt(transactionIdInput.value) : undefined,
                type: transactionTypeInput.value,
                amount: parseFloat(transactionAmountInput.value),
                description: transactionDescriptionInput.value,
                date: new Date().toISOString()
            };
            await putData('finance', transaction);
            alert('Transactie opgeslagen!');
            financeTransactionForm.reset();
            transactionIdInput.value = '';
            loadTransactions();
        });
    }

    loadTransactions();
    financeView.dataset.initialized = true;
}

export async function initNutritionView() {
    const nutritionProgramForm = document.getElementById('nutritionProgramForm');
    const nutritionProgramsList = document.getElementById('nutritionProgramsList');
    const programIdInput = document.getElementById('programId');
    const programNameInput = document.getElementById('programName');
    const programDescriptionInput = document.getElementById('programDescription');

    async function loadNutritionPrograms() {
        const programs = await getAllData('nutritionPrograms');
        nutritionProgramsList.innerHTML = '';
        if (programs.length === 0) {
            nutritionProgramsList.innerHTML = '<p class="text-gray-400">Geen voedingsprogrammas gevonden.</p>';
            return;
        }
        programs.forEach(program => {
            const programCard = document.createElement('div');
            programCard.className = 'data-card';
            programCard.innerHTML = `
                <div class="card-header"><h3>Programma: ${program.name}</h3></div>
                <div class="sub-value">${program.description}</div>
                <div class="flex justify-end mt-2">
                    <button class="text-blue-400 hover:text-blue-300 text-sm mr-2" data-action="edit-program" data-id="${program.id}">Bewerk</button>
                    <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-program" data-id="${program.id}">Verwijder</button>
                </div>
            `;
            nutritionProgramsList.appendChild(programCard);
        });

        nutritionProgramsList.querySelectorAll('[data-action="edit-program"]').forEach(button => {
            button.addEventListener('click', async (event) => {
                const programId = parseInt(event.target.dataset.id);
                const program = await getData('nutritionPrograms', programId);
                if (program) {
                    programIdInput.value = program.id;
                    programNameInput.value = program.name;
                    programDescriptionInput.value = program.description;
                }
            });
        });

        nutritionProgramsList.querySelectorAll('[data-action="delete-program"]').forEach(button => {
            button.addEventListener('click', async (event) => {
                const programId = parseInt(event.target.dataset.id);
                if (confirm('Weet u zeker dat u dit programma wilt verwijderen?')) {
                    await deleteData('nutritionPrograms', programId);
                    loadNutritionPrograms();
                }
            });
        });
    }

    if (nutritionProgramForm) {
        nutritionProgramForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const program = {
                id: programIdInput.value ? parseInt(programIdInput.value) : undefined,
                name: programNameInput.value,
                description: programDescriptionInput.value
            };
            await putData('nutritionPrograms', program);
            alert('Voedingsprogramma opgeslagen!');
            nutritionProgramForm.reset();
            programIdInput.value = '';
            loadNutritionPrograms();
        });
        await loadNutritionPrograms();
    }
}



export function initSchedulesView() {
    console.log("Schema Beheerder weergave geïnitialiseerd.");
    // De UI-logica voor het laden van schema's uit de database zou hier komen
}

export function initLessonSchedulerView() {
    console.log("Lesplanner weergave geïnitialiseerd.");
    // De UI-logica voor het laden van lessen uit de database zou hier komen
}

export function initScheduleBuilderView() {
    const availableModules = document.getElementById('available-modules');
    const mySchedule = document.getElementById('my-schedule');
    const saveScheduleBtn = document.getElementById('saveScheduleBtn');

    if (availableModules && mySchedule) {
        let draggedItem = null;

        availableModules.addEventListener('dragstart', (e) => {
            draggedItem = e.target.closest('.drag-item');
            if (draggedItem) {
                e.dataTransfer.setData('text/plain', draggedItem.dataset.moduleType);
                setTimeout(() => {
                    draggedItem.classList.add('hidden');
                }, 0);
            }
        });

        availableModules.addEventListener('dragend', () => {
            if (draggedItem) {
                draggedItem.classList.remove('hidden');
                draggedItem = null;
            }
        });

        mySchedule.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        mySchedule.addEventListener('dragenter', (e) => {
            e.preventDefault();
            mySchedule.classList.add('border-blue-300');
        });

        mySchedule.addEventListener('dragleave', () => {
            mySchedule.classList.remove('border-blue-300');
        });

        mySchedule.addEventListener('drop', (e) => {
            e.preventDefault();
            mySchedule.classList.remove('border-blue-300');

            const moduleType = e.dataTransfer.getData('text/plain');
            if (moduleType) {
                const newItem = document.createElement('div');
                newItem.className = 'drag-item bg-gray-600 p-3 mb-2 rounded-md shadow flex items-center justify-between cursor-grab';
                newItem.setAttribute('draggable', 'true');
                newItem.dataset.moduleType = moduleType;

                let iconClass = '';
                let text = '';
                switch (moduleType) {
                    case 'Rest': iconClass = 'fas fa-bed text-blue-300'; text = 'Rustsessie'; break;
                    case 'Training': iconClass = 'fas fa-dumbbell text-purple-300'; text = 'Trainingssessie'; break;
                    case 'Nutrition': iconClass = 'fas fa-apple-alt text-yellow-300'; text = 'Voedingsplan'; break;
                    case 'Test': iconClass = 'fas fa-running text-red-300'; text = 'Testmeting'; break;
                    default: iconClass = 'fas fa-question text-gray-300'; text = 'Onbekende Module';
                }
                newItem.innerHTML = `<span><i class="${iconClass} mr-2"></i>${text}</span><i class="fas fa-grip-vertical text-gray-400"></i>`;
                mySchedule.appendChild(newItem);

                const placeholder = mySchedule.querySelector('p.text-gray-400');
                if (placeholder) {
                    placeholder.remove();
                }
            }
        });

        saveScheduleBtn.addEventListener('click', async () => {
            const scheduleItems = Array.from(mySchedule.querySelectorAll('.drag-item')).map(item => item.dataset.moduleType);
            if (scheduleItems.length > 0) {
                const scheduleName = prompt('Geef een naam op voor dit schema:');
                if (scheduleName) {
                    const newSchedule = {
                        name: scheduleName,
                        modules: scheduleItems,
                        dateCreated: new Date().toISOString()
                    };
                    await putData('schedules', newSchedule);
                    alert('Schema opgeslagen!');
                }
            } else {
                alert('Voeg modules toe aan uw schema voordat u opslaat.');
            }
        });
    }
    console.log("Schema Bouwer weergave geïnitialiseerd.");
}

export function initLessonScheduleBuilderView() {
    console.log("Lesrooster Bouwer weergave geïnitialiseerd.");
}

export function initMeetingPlannerView() {
    console.log("Vergaderplanner weergave geïnitialiseerd.");
}

export function initSubscriptionsView() {
    console.log("Abonnementen Beheer weergave geïnitialiseerd.");
}

export function initLogsView() {
    console.log("Logs weergave geïnitialiseerd.");
}

export function initRegistryView() {
    console.log("Register Beheer weergave geïnitialiseerd.");
}

export function initMemberMembershipView() {
    console.log("Lidmaatschap Beheer weergave geïnitialiseerd.");
}

export function initDocsView() {
    console.log("Documenten weergave geïnitialiseerd.");
}

export function initAdminOnlyView() {
    const accessSecretDbBtn = document.getElementById('accessSecretDbBtn');
    const secretDataDisplay = document.getElementById('secretDataDisplay');

    if (accessSecretDbBtn) {
        accessSecretDbBtn.addEventListener('click', async () => {
            const secretId = 'adminSecret';
            let secretData = await getData('adminSecretData', secretId);
            if (!secretData) {
                secretData = { id: secretId, value: 'This is a highly confidential admin secret from IndexedDB!' };
                await putData('adminSecretData', secretData);
            }
            secretDataDisplay.textContent = JSON.stringify(secretData, null, 2);
        });
    }
    console.log("Admin Only View geïnitialiseerd.");
}

export function initToggleFunctionalityView() {
    const enableTrainingModule = document.getElementById('enableTrainingModule');
    const enableNutritionModule = document.getElementById('enableNutritionModule');
    const enableReportsModule = document.getElementById('enableReportsModule');
    const saveToggleSettingsBtn = document.getElementById('saveToggleSettingsBtn');
    const toggleSettingsId = 'appToggleSettings';

    if (saveToggleSettingsBtn) {
        const settings = getData('toggleSettings', toggleSettingsId);
        if (settings) {
            settings.then(s => {
                if(s) {
                    enableTrainingModule.checked = s.enableTrainingModule || false;
                    enableNutritionModule.checked = s.enableNutritionModule || false;
                    enableReportsModule.checked = s.enableReportsModule || false;
                }
            });
        }
        
        saveToggleSettingsBtn.addEventListener('click', async () => {
            const settings = {
                id: toggleSettingsId,
                enableTrainingModule: enableTrainingModule.checked,
                enableNutritionModule: enableNutritionModule.checked,
                enableReportsModule: enableReportsModule.checked,
            };
            await putData('toggleSettings', settings);
            alert('Instellingen opgeslagen!');
        });
    }
    console.log("Functionaliteit Schakelen weergave geïnitialiseerd.");
}

export function initDashboardOverviewView() {
    console.log("Dashboard Overzicht weergave geïnitialiseerd.");
}

export function initSportView() {
    console.log("Sport weergave geïnitialiseerd.");
}

export function initActivitiesView() {
    console.log("Activiteiten weergave geïnitialiseerd.");
}

export function initPermissionsView() {
    console.log("Permissies weergave geïnitialiseerd.");
}

export function initNotesView() {
    console.log("Notities weergave geïnitialiseerd.");
}

export function initActionCenterView() {
    console.log("Actie Centrum weergave geïnitialiseerd.");
}

export function initMessagesView() {
    console.log("Berichtenscherm weergave geïnitialiseerd.");
}

export function initSleepView() {
    console.log("Slaap weergave geïnitialiseerd.");
}

export function initLiveTrainingView() {
    console.log("Live Training weergave geïnitialiseerd.");
}

export function initRestMeasurementLiveView() {
    console.log("Rust & Herstel Meting weergave geïnitialiseerd.");
}

export function initTrainingView() {
    console.log("Training weergave geïnitialiseerd.");
}

export function resetTrainingHrChart() {
    console.log("Training HR-grafiek gereset.");
    // Logica om de trainingsgrafiek te resetten zou hier komen
}