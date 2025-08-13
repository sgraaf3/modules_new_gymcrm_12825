// Bestand: js/views/financeView.js
// Bevat logica voor het beheren van financiële transacties (inkomsten, uitgaven),
// inclusief koppeling aan producten/diensten en leden/medewerkers.

import { getData, putData, deleteData, getAllData } from '../database.js';
import { showNotification } from './notifications.js'; // Importeer notificatiesysteem

export async function initFinanceView() {
    console.log("Financiën View geïnitialiseerd.");
    const financeView = document.getElementById('financeView');
    // Voorkom dubbele initialisatie van listeners als de view opnieuw wordt geladen zonder refresh
    if (financeView.dataset.initialized) {
        await loadTransactions(); // Laad transacties opnieuw indien al geïnitialiseerd
        return;
    }

    const financeTransactionForm = document.getElementById('financeTransactionForm');
    const transactionsList = document.getElementById('transactionsList');
    const transactionIdInput = document.getElementById('transactionId');
    const transactionTypeInput = document.getElementById('transactionType');
    const transactionAmountInput = document.getElementById('transactionAmount');
    const transactionDescriptionInput = document.getElementById('transactionDescription');
    const transactionProductServiceInput = document.getElementById('transactionProductService');
    const transactionMemberEmployeeInput = document.getElementById('transactionMemberEmployee');
    const clearTransactionFormBtn = document.getElementById('clearTransactionFormBtn');

    const totalIncomeDisplay = document.getElementById('totalIncomeDisplay');
    const totalExpenseDisplay = document.getElementById('totalExpenseDisplay');
    const netProfitDisplay = document.getElementById('netProfitDisplay');

    /**
     * Laadt alle transacties uit de database, berekent totalen en toont ze in de lijst.
     */
    async function loadTransactions() {
        try {
            const transactions = await getAllData('finance');
            transactionsList.innerHTML = ''; // Maak de bestaande lijst leeg
            let totalIncome = 0;
            let totalExpense = 0;

            if (transactions.length === 0) {
                transactionsList.innerHTML = '<p class="text-gray-400">Geen transacties gevonden.</p>';
                if (totalIncomeDisplay) totalIncomeDisplay.textContent = '€ 0.00';
                if (totalExpenseDisplay) totalExpenseDisplay.textContent = '€ 0.00';
                if (netProfitDisplay) netProfitDisplay.textContent = '€ 0.00';
                return;
            }

            // Sorteer transacties van nieuw naar oud
            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            transactions.forEach(trans => {
                const transactionCard = document.createElement('div');
                transactionCard.className = 'data-card';
                const amountClass = trans.type === 'income' ? 'text-green-400' : 'text-red-400';
                const sign = trans.type === 'income' ? '+' : '-';
                transactionCard.innerHTML = `
                    <div class="card-header"><h3>${trans.description}</h3></div>
                    <div class="main-value ${amountClass}">${sign} € ${trans.amount.toFixed(2)}</div>
                    <div class="sub-value">Datum: ${new Date(trans.date).toLocaleDateString()}</div>
                    <div class="sub-value">Product/Dienst: ${trans.productService || 'N.v.t.'}</div>
                    <div class="sub-value">Betrokken: ${trans.memberEmployee || 'N.v.t.'}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-blue-400 hover:text-blue-300 text-sm mr-2" data-action="edit-transaction" data-id="${trans.id}">Bewerk</button>
                        <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-transaction" data-id="${trans.id}">Verwijder</button>
                    </div>
                `;
                transactionsList.appendChild(transactionCard);

                if (trans.type === 'income') {
                    totalIncome += trans.amount;
                } else {
                    totalExpense += trans.amount;
                }
            });

            if (totalIncomeDisplay) totalIncomeDisplay.textContent = `€ ${totalIncome.toFixed(2)}`;
            if (totalExpenseDisplay) totalExpenseDisplay.textContent = `€ ${totalExpense.toFixed(2)}`;
            if (netProfitDisplay) netProfitDisplay.textContent = `€ ${(totalIncome - totalExpense).toFixed(2)}`;

            // Koppel event listeners voor bewerk/verwijder knoppen
            transactionsList.querySelectorAll('[data-action="edit-transaction"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const transactionId = parseInt(event.target.dataset.id);
                    const transaction = await getData('finance', transactionId);
                    if (transaction) {
                        transactionIdInput.value = transaction.id;
                        transactionTypeInput.value = transaction.type;
                        transactionAmountInput.value = transaction.amount;
                        transactionDescriptionInput.value = transaction.description;
                        transactionProductServiceInput.value = transaction.productService;
                        transactionMemberEmployeeInput.value = transaction.memberEmployee;
                        showNotification('Transactie geladen voor bewerking.', 'info');
                    }
                });
            });

            transactionsList.querySelectorAll('[data-action="delete-transaction"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const transactionId = parseInt(event.target.dataset.id);
                    // Voor nu nog confirm, conform projectrichtlijnen. Ideaal zou een custom modal zijn.
                    if (confirm('Weet u zeker dat u deze transactie wilt verwijderen?')) {
                        try {
                            await deleteData('finance', transactionId);
                            showNotification('Transactie verwijderd!', 'success');
                            loadTransactions(); // Herlaad de lijst
                        } catch (error) {
                            console.error("Fout bij verwijderen transactie:", error);
                            showNotification('Fout bij verwijderen transactie.', 'error');
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Fout bij laden transacties:", error);
            showNotification("Fout bij laden transacties.", "error");
        }
    }

    // Event listener voor het opslaan/bewerken van een transactie
    if (financeTransactionForm) {
        financeTransactionForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const transaction = {
                id: transactionIdInput.value ? parseInt(transactionIdInput.value) : undefined, // AutoIncrement voor nieuwe transacties
                type: transactionTypeInput.value,
                amount: parseFloat(transactionAmountInput.value),
                description: transactionDescriptionInput.value,
                productService: transactionProductServiceInput.value,
                memberEmployee: transactionMemberEmployeeInput.value,
                date: new Date().toISOString() // Tijdstempel voor sortering/tracking
            };
            try {
                await putData('finance', transaction);
                showNotification('Transactie opgeslagen!', 'success');
                financeTransactionForm.reset();
                transactionIdInput.value = ''; // Maak verborgen ID leeg
                loadTransactions(); // Herlaad de lijst
            } catch (error) {
                console.error("Fout bij opslaan transactie:", error);
                showNotification('Fout bij opslaan transactie.', 'error');
            }
        });
    }

    // Event listener voor de "Formulier Leegmaken" knop
    if (clearTransactionFormBtn) {
        clearTransactionFormBtn.addEventListener('click', () => {
            financeTransactionForm.reset();
            transactionIdInput.value = ''; // Maak verborgen ID leeg
            showNotification('Formulier leeggemaakt.', 'info');
        });
    }

    // Initial load of transactions when the view is initialized
    await loadTransactions();
    financeView.dataset.initialized = true; // Markeer als geïnitialiseerd
}
