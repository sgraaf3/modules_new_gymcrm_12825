// Bestand: js/invoicingView.js
// Bevat logica voor facturatiebeheer, inclusief genereren, weergeven en betalingen registreren.

import { getAllData, putData, deleteData, getData } from '../database.js';
import { showNotification } from './notifications.js';

let currentInvoiceToPay = null; // Global variable to store the invoice being processed for payment

/**
 * Initializes the Invoicing View.
 */
export async function initInvoicingView(showViewCallback) {
    console.log("Facturatie View geïnitialiseerd.");

    // DOM Element References
    const totalIncomeSpan = document.getElementById('totalIncome');
    const totalExpensesSpan = document.getElementById('totalExpenses');
    const netProfitSpan = document.getElementById('netProfit');
    const viewFinancialReportsBtn = document.getElementById('viewFinancialReportsBtn');

    const invoiceMemberSelect = document.getElementById('invoiceMemberSelect');
    const invoiceServiceSelect = document.getElementById('invoiceServiceSelect');
    const invoiceAmountInput = document.getElementById('invoiceAmount');
    const invoiceDescriptionInput = document.getElementById('invoiceDescription');
    const generateInvoiceBtn = document.getElementById('generateInvoiceBtn');
    const invoicesTableBody = document.getElementById('invoicesTableBody');

    const paymentModal = document.getElementById('paymentModal');
    const paymentModalCloseBtn = document.getElementById('paymentModalCloseBtn');
    const paymentInvoiceIdSpan = document.getElementById('paymentInvoiceId');
    const paymentInvoiceTotalSpan = document.getElementById('paymentInvoiceTotal');
    const paymentInvoicePaidSpan = document.getElementById('paymentInvoicePaid');
    const paymentAmountInput = document.getElementById('paymentAmount');
    const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
    const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');

    // Event Listeners
    generateInvoiceBtn.addEventListener('click', generateInvoice);
    paymentModalCloseBtn.addEventListener('click', () => paymentModal.classList.add('hidden'));
    cancelPaymentBtn.addEventListener('click', () => paymentModal.classList.add('hidden'));
    confirmPaymentBtn.addEventListener('click', confirmPayment);
    viewFinancialReportsBtn.addEventListener('click', () => {
        if (showViewCallback) {
            showViewCallback('reportsView'); // Navigate to the main reports view
        }
    });

    // Initial Data Load
    await loadFinancialSummary();
    await loadMembersAndServices();
    await loadInvoices();

    /**
     * Loads and displays the financial summary (total income, expenses, net profit).
     */
    async function loadFinancialSummary() {
        try {
            const allFinanceEntries = await getAllData('finance');
            let totalIncome = 0;
            let totalExpenses = 0;

            allFinanceEntries.forEach(entry => {
                if (entry.type === 'income') {
                    totalIncome += parseFloat(entry.amount || 0);
                } else if (entry.type === 'expense') {
                    totalExpenses += parseFloat(entry.amount || 0);
                }
            });

            const netProfit = totalIncome - totalExpenses;

            totalIncomeSpan.textContent = `€ ${totalIncome.toFixed(2)}`;
            totalExpensesSpan.textContent = `€ ${totalExpenses.toFixed(2)}`;
            netProfitSpan.textContent = `€ ${netProfit.toFixed(2)}`;

            // Apply color based on profit/loss
            if (netProfit > 0) {
                netProfitSpan.classList.remove('text-red-400');
                netProfitSpan.classList.add('text-green-400');
            } else if (netProfit < 0) {
                netProfitSpan.classList.remove('text-green-400');
                netProfitSpan.classList.add('text-red-400');
            } else {
                netProfitSpan.classList.remove('text-green-400', 'text-red-400');
                netProfitSpan.classList.add('text-blue-400'); // Neutral color
            }

        } catch (error) {
            console.error("Fout bij laden financiële samenvatting:", error);
            showNotification("Fout bij laden financiële samenvatting.", 'error');
        }
    }

    /**
     * Loads members and subscriptions/services to populate the dropdowns.
     */
    async function loadMembersAndServices() {
        try {
            const members = await getAllData('memberData');
            const subscriptions = await getAllData('subscriptions'); // Assuming subscriptions are the primary services

            // Populate Member Select
            invoiceMemberSelect.innerHTML = '<option value="">-- Selecteer een lid --</option>';
            members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = `${member.name} (${member.email})`;
                invoiceMemberSelect.appendChild(option);
            });

            // Populate Service Select (using subscriptions as services for now)
            invoiceServiceSelect.innerHTML = '<option value="">-- Selecteer een dienst --</option>';
            subscriptions.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.id; // Use subscription ID as service ID
                option.textContent = `Abonnement: ${sub.planName} (€${sub.price})`;
                invoiceServiceSelect.appendChild(option);
            });
            // You might also add other services from a different store if available (e.g., 'services' store)
            // Example: const otherServices = await getAllData('services');
            // otherServices.forEach(service => { /* add to dropdown */ });

        } catch (error) {
            console.error("Fout bij laden leden en diensten:", error);
            showNotification("Fout bij laden leden en diensten.", 'error');
        }
    }

    /**
     * Generates a new invoice and saves it to IndexedDB.
     */
    async function generateInvoice() {
        const memberId = invoiceMemberSelect.value;
        const serviceId = invoiceServiceSelect.value; // This is actually subscriptionId
        const amount = parseFloat(invoiceAmountInput.value);
        const description = invoiceDescriptionInput.value.trim();

        if (!memberId || !amount || isNaN(amount) || amount <= 0 || !description) {
            showNotification("Vul alle verplichte velden in (Lid, Bedrag, Omschrijving).", 'warning');
            return;
        }

        try {
            const member = await getData('memberData', parseInt(memberId));
            let serviceName = description; // Default to description if no service selected
            let servicePrice = amount;

            if (serviceId) {
                const subscription = await getData('subscriptions', parseInt(serviceId));
                if (subscription) {
                    serviceName = `Abonnement: ${subscription.planName}`;
                    servicePrice = subscription.price;
                    // If amount is manually entered, prioritize it, otherwise use subscription price
                    if (amount === 0 || isNaN(amount)) {
                        amount = servicePrice;
                        invoiceAmountInput.value = servicePrice.toFixed(2);
                    }
                }
            }

            const newInvoice = {
                memberId: parseInt(memberId),
                memberName: member ? member.name : 'Onbekend Lid',
                issueDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
                items: [{
                    serviceId: serviceId ? parseInt(serviceId) : null,
                    description: description,
                    amount: amount
                }],
                totalAmount: amount,
                amountPaid: 0,
                status: 'sent', // Default status
                paymentHistory: []
            };

            const invoiceId = await putData('invoices', newInvoice);
            showNotification(`Factuur #${invoiceId} succesvol gegenereerd!`, 'success');

            // Also add as income to finance store
            await putData('finance', {
                type: 'income',
                amount: amount,
                date: newInvoice.issueDate,
                description: `Factuur #${invoiceId} - ${newInvoice.memberName}`,
                invoiceId: invoiceId
            });

            // Clear form
            invoiceMemberSelect.value = '';
            invoiceServiceSelect.value = '';
            invoiceAmountInput.value = '';
            invoiceDescriptionInput.value = '';

            await loadFinancialSummary();
            await loadInvoices();

        } catch (error) {
            console.error("Fout bij genereren factuur:", error);
            showNotification(`Fout bij genereren factuur: ${error.message}`, 'error');
        }
    }

    /**
     * Loads and displays all invoices in the table.
     */
    async function loadInvoices() {
        try {
            const invoices = await getAllData('invoices');
            invoicesTableBody.innerHTML = '';

            if (invoices.length === 0) {
                invoicesTableBody.innerHTML = '<tr><td colspan="8" class="py-3 px-6 text-center">Geen facturen gevonden.</td></tr>';
                return;
            }

            invoices.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate)); // Sort by most recent

            for (const invoice of invoices) {
                const member = await getData('memberData', invoice.memberId);
                const memberName = member ? member.name : invoice.memberName || 'Onbekend Lid'; // Use stored name if member not found

                const row = document.createElement('tr');
                row.className = 'border-b border-gray-800 hover:bg-gray-800';

                let statusClass = '';
                let displayStatus = invoice.status;
                if (invoice.status === 'paid') {
                    statusClass = 'status-paid';
                } else if (invoice.amountPaid > 0 && invoice.amountPaid < invoice.totalAmount) {
                    statusClass = 'status-partially-paid';
                    displayStatus = 'gedeeltelijk betaald';
                } else if (new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid') {
                    statusClass = 'status-overdue';
                    displayStatus = 'achterstallig';
                } else if (invoice.status === 'sent') {
                    statusClass = 'status-sent';
                    displayStatus = 'verzonden';
                } else {
                    statusClass = 'status-pending'; // Default for other statuses
                    displayStatus = 'openstaand';
                }


                row.innerHTML = `
                    <td class="py-3 px-6 text-left">${invoice.id}</td>
                    <td class="py-3 px-6 text-left">${memberName}</td>
                    <td class="py-3 px-6 text-left">${invoice.issueDate}</td>
                    <td class="py-3 px-6 text-left">${invoice.dueDate}</td>
                    <td class="py-3 px-6 text-left">€ ${invoice.totalAmount.toFixed(2)}</td>
                    <td class="py-3 px-6 text-left">€ ${invoice.amountPaid.toFixed(2)}</td>
                    <td class="py-3 px-6 text-left ${statusClass}">${displayStatus.toUpperCase()}</td>
                    <td class="py-3 px-6 text-center">
                        ${invoice.status !== 'paid' ? `<button class="table-action-button pay-button" data-id="${invoice.id}">Betaal</button>` : ''}
                        <button class="table-action-button delete-button" data-id="${invoice.id}">Verwijder</button>
                    </td>
                `;
                invoicesTableBody.appendChild(row);
            }

            // Add event listeners for action buttons
            invoicesTableBody.querySelectorAll('.pay-button').forEach(button => {
                button.addEventListener('click', (event) => openPaymentModal(parseInt(event.target.dataset.id)));
            });
            invoicesTableBody.querySelectorAll('.delete-button').forEach(button => {
                button.addEventListener('click', (event) => deleteInvoice(parseInt(event.target.dataset.id)));
            });

        } catch (error) {
            console.error("Fout bij laden facturen:", error);
            showNotification("Fout bij laden facturen.", 'error');
        }
    }

    /**
     * Opens the payment modal for a specific invoice.
     * @param {number} invoiceId - The ID of the invoice to process.
     */
    async function openPaymentModal(invoiceId) {
        try {
            const invoice = await getData('invoices', invoiceId);
            if (!invoice) {
                showNotification("Factuur niet gevonden.", 'error');
                return;
            }
            currentInvoiceToPay = invoice; // Store the invoice globally for processing

            paymentInvoiceIdSpan.textContent = invoice.id;
            paymentInvoiceTotalSpan.textContent = `€ ${invoice.totalAmount.toFixed(2)}`;
            paymentInvoicePaidSpan.textContent = `€ ${invoice.amountPaid.toFixed(2)}`;
            paymentAmountInput.value = (invoice.totalAmount - invoice.amountPaid).toFixed(2); // Pre-fill with remaining amount

            paymentModal.classList.remove('hidden');
        } catch (error) {
            console.error("Fout bij openen betaalmodal:", error);
            showNotification("Fout bij openen betaalmodal.", 'error');
        }
    }

    /**
     * Confirms and processes a payment for the current invoice.
     */
    async function confirmPayment() {
        if (!currentInvoiceToPay) return;

        const paymentAmount = parseFloat(paymentAmountInput.value);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            showNotification("Voer een geldig bedrag in.", 'warning');
            return;
        }

        try {
            currentInvoiceToPay.amountPaid += paymentAmount;
            currentInvoiceToPay.paymentHistory.push({
                date: new Date().toISOString().split('T')[0],
                amount: paymentAmount
            });

            if (currentInvoiceToPay.amountPaid >= currentInvoiceToPay.totalAmount) {
                currentInvoiceToPay.status = 'paid';
                currentInvoiceToPay.amountPaid = currentInvoiceToPay.totalAmount; // Cap at total amount
            } else {
                currentInvoiceToPay.status = 'partially-paid';
            }

            await putData('invoices', currentInvoiceToPay);
            showNotification(`Betaling van € ${paymentAmount.toFixed(2)} succesvol geregistreerd voor factuur #${currentInvoiceToPay.id}.`, 'success');

            // Update finance income (if not already handled by initial invoice generation)
            // If you want to track each payment as a separate finance entry:
            await putData('finance', {
                type: 'payment_received',
                amount: paymentAmount,
                date: new Date().toISOString().split('T')[0],
                description: `Betaling voor Factuur #${currentInvoiceToPay.id} - ${currentInvoiceToPay.memberName}`,
                invoiceId: currentInvoiceToPay.id
            });


            paymentModal.classList.add('hidden');
            currentInvoiceToPay = null; // Clear stored invoice

            await loadFinancialSummary();
            await loadInvoices();

        } catch (error) {
            console.error("Fout bij bevestigen betaling:", error);
            showNotification(`Fout bij bevestigen betaling: ${error.message}`, 'error');
        }
    }

    /**
     * Deletes an invoice.
     * @param {number} invoiceId - The ID of the invoice to delete.
     */
    async function deleteInvoice(invoiceId) {
        if (!confirm("Weet u zeker dat u deze factuur wilt verwijderen?")) { // Use custom modal later
            return;
        }
        try {
            await deleteData('invoices', invoiceId);
            showNotification(`Factuur #${invoiceId} succesvol verwijderd.`, 'info');
            // Optionally, remove associated finance entries or mark them as cancelled
            await loadFinancialSummary();
            await loadInvoices();
        } catch (error) {
            console.error("Fout bij verwijderen factuur:", error);
            showNotification(`Fout bij verwijderen factuur: ${error.message}`, 'error');
        }
    }
}
