// Bestand: js/views/financeView.js
// Bevat logica voor het beheren van financiële transacties (inkomsten, uitgaven),
// inclusief koppeling aan producten/diensten en leden/medewerkers.

import { getData, putData, deleteData, getAllData } from '../database.js';
import { showNotification } from './notifications.js'; // Importeer notificatiesysteem

export async function initFinanceView() {
    console.log("Financiën View geïnitialiseerd.");
    const financeView = document.getElementById('financeView');
    if (financeView.dataset.initialized) {
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

    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const currentMonthDisplay = document.getElementById('currentMonthDisplay');

    let currentDate = new Date();

    async function loadTransactions() {
        try {
            const allTransactions = await getAllData('finance');
            
            currentMonthDisplay.textContent = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

            const filteredTransactions = allTransactions.filter(t => {
                const transactionDate = new Date(t.date);
                return transactionDate.getFullYear() === currentDate.getFullYear() &&
                       transactionDate.getMonth() === currentDate.getMonth();
            });

            transactionsList.innerHTML = '';
            let totalIncome = 0;
            let totalExpense = 0;

            if (filteredTransactions.length === 0) {
                transactionsList.innerHTML = '<p class="text-gray-400">Geen transacties gevonden voor deze maand.</p>';
            } else {
                filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
                filteredTransactions.forEach(trans => {
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
            }

            totalIncomeDisplay.textContent = `€ ${totalIncome.toFixed(2)}`;
            totalExpenseDisplay.textContent = `€ ${totalExpense.toFixed(2)}`;
            netProfitDisplay.textContent = `€ ${(totalIncome - totalExpense).toFixed(2)}`;

            attachActionListeners();

        } catch (error) {
            console.error("Fout bij laden transacties:", error);
            showNotification("Fout bij laden transacties.", "error");
        }
    }

    function attachActionListeners() {
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
                if (confirm('Weet u zeker dat u deze transactie wilt verwijderen?')) {
                    try {
                        await deleteData('finance', transactionId);
                        showNotification('Transactie verwijderd!', 'success');
                        loadTransactions();
                    } catch (error) {
                        console.error("Fout bij verwijderen transactie:", error);
                        showNotification('Fout bij verwijderen transactie.', 'error');
                    }
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
                productService: transactionProductServiceInput.value,
                memberEmployee: transactionMemberEmployeeInput.value,
                date: new Date().toISOString()
            };
            try {
                await putData('finance', transaction);
                showNotification('Transactie opgeslagen!', 'success');
                financeTransactionForm.reset();
                transactionIdInput.value = '';
                loadTransactions();
            } catch (error) {
                console.error("Fout bij opslaan transactie:", error);
                showNotification('Fout bij opslaan transactie.', 'error');
            }
        });
    }

    if (clearTransactionFormBtn) {
        clearTransactionFormBtn.addEventListener('click', () => {
            financeTransactionForm.reset();
            transactionIdInput.value = '';
            showNotification('Formulier leeggemaakt.', 'info');
        });
    }

    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        loadTransactions();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        loadTransactions();
    });

    await loadTransactions();
    financeView.dataset.initialized = true;
}
