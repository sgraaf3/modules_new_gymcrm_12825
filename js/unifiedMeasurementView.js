// Bestand: js/unifiedMeasurementView.js
// Beheert de weergave en logica voor de geconsolideerde meetpagina.

import { showNotification } from './notifications.js';

// Global variables to store the current active tab and loaded content/init functions
let currentActiveTab = 'simple'; // 'simple' or 'advanced'
let loadedHtmlContent = {}; // Cache for loaded HTML
let bluetoothControllerInstance; // Reference to the global BluetoothController from app.js

/**
 * Initializes the Unified Measurement View.
 * @param {function} showViewCallback - Callback to navigate to other views.
 * @param {object} bluetoothController - The global BluetoothController instance.
 */
export async function initUnifiedMeasurementView(showViewCallback, bluetoothController) {
    console.log("Unified Measurement View geïnitialiseerd.");

    // Store the global BluetoothController instance
    bluetoothControllerInstance = bluetoothController;

    const measurementContentDiv = document.getElementById('measurementContent');
    const tabSimpleButton = document.getElementById('tabSimpleMeasurement');
    const tabAdvancedButton = document.getElementById('tabAdvancedMeasurement');
    const loadingSpinner = measurementContentDiv.querySelector('.loading-spinner');

    // Event listeners for tab buttons
    tabSimpleButton.addEventListener('click', () => switchMeasurementTab('simple', showViewCallback));
    tabAdvancedButton.addEventListener('click', () => switchMeasurementTab('advanced', showViewCallback));

    // Load the initial tab based on saved preference or default to simple
    const savedTab = localStorage.getItem('unifiedMeasurementTab') || 'simple';
    await switchMeasurementTab(savedTab, showViewCallback);
}

/**
 * Switches the active measurement tab and loads/initializes its content.
 * @param {string} tabName - 'simple' or 'advanced'.
 * @param {function} showViewCallback - Callback to navigate to other views.
 */
async function switchMeasurementTab(tabName, showViewCallback) {
    currentActiveTab = tabName;
    localStorage.setItem('unifiedMeasurementTab', tabName); // Save preference

    const measurementContentDiv = document.getElementById('measurementContent');
    const tabSimpleButton = document.getElementById('tabSimpleMeasurement');
    const tabAdvancedButton = document.getElementById('tabAdvancedMeasurement');
    const loadingSpinner = measurementContentDiv.querySelector('.loading-spinner');

    // Update active button styling
    tabSimpleButton.classList.remove('active');
    tabAdvancedButton.classList.remove('active');
    if (tabName === 'simple') {
        tabSimpleButton.classList.add('active');
    } else {
        tabAdvancedButton.classList.add('active');
    }

    // Show loading spinner
    if (loadingSpinner) loadingSpinner.classList.remove('hidden');
    measurementContentDiv.innerHTML = loadingSpinner ? loadingSpinner.outerHTML : '<p class="text-gray-400 text-center py-8">Laden...</p>';


}
