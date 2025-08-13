// Bestand: js/notifications.js
// Beheert het tonen van interactieve notificaties aan de gebruiker.

const notificationContainer = document.getElementById('notificationContainer');

/**
 * Toont een notificatiebericht.
 * @param {string} message Het bericht dat getoond moet worden.
 * @param {string} type Het type notificatie ('success', 'error', 'info', 'warning'). Bepaalt de kleur.
 * @param {number} duration De duur in milliseconden voordat de notificatie verdwijnt (standaard 3000ms).
 */
export function showNotification(message, type = 'info', duration = 3000) {
    if (!notificationContainer) {
        console.warn('Notification container niet gevonden. Notificatie kan niet worden weergegeven:', message);
        return;
    }

    const notificationElement = document.createElement('div');
    notificationElement.className = `
        p-3 rounded-lg shadow-md text-white cursor-pointer
        flex items-center justify-between space-x-4
        transform translate-x-full opacity-0 transition-all duration-300 ease-out
    `;

    // Bepaal de achtergrondkleur op basis van het type
    let bgColorClass = 'bg-gray-700';
    switch (type) {
        case 'success':
            bgColorClass = 'bg-green-600';
            break;
        case 'error':
            bgColorClass = 'bg-red-600';
            break;
        case 'warning':
            bgColorClass = 'bg-yellow-600';
            break;
        case 'info':
        default:
            bgColorClass = 'bg-blue-600';
            break;
    }
    notificationElement.classList.add(bgColorClass);

    notificationElement.innerHTML = `
        <span>${message}</span>
        <button class="ml-4 text-white opacity-75 hover:opacity-100 focus:outline-none close-btn">
            <i class="fas fa-times"></i>
        </button>
    `;

    notificationContainer.appendChild(notificationElement);

    // Forceer reflow om de transitie te activeren
    void notificationElement.offsetWidth;

    // Start de animatie in
    notificationElement.classList.remove('translate-x-full', 'opacity-0');
    notificationElement.classList.add('translate-x-0', 'opacity-100');

    // Verwijder notificatie na 'duration'
    const timeoutId = setTimeout(() => {
        hideNotification(notificationElement);
    }, duration);

    // Verwijder notificatie bij klik op de sluitknop of de notificatie zelf
    notificationElement.querySelector('.close-btn').addEventListener('click', () => {
        clearTimeout(timeoutId); // Stop de automatische timer
        hideNotification(notificationElement);
    });
    // Optioneel: notificatie verdwijnt ook bij klikken op de body van de notificatie
    // notificationElement.addEventListener('click', () => {
    //     clearTimeout(timeoutId);
    //     hideNotification(notificationElement);
    // });
}

/**
 * Verbergt en verwijdert een notificatie-element uit de DOM.
 * @param {HTMLElement} element Het notificatie-element dat verborgen moet worden.
 */
function hideNotification(element) {
    element.classList.remove('translate-x-0', 'opacity-100');
    element.classList.add('translate-x-full', 'opacity-0');

    element.addEventListener('transitionend', () => {
        element.remove();
    }, { once: true }); // Zorg ervoor dat de listener maar één keer wordt geactiveerd
}
