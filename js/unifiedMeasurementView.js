// Bestand: js/unifiedMeasurementView.js
// Beheert de weergave en logica voor de geconsolideerde meetpagina.

import { initRestMeasurementLiveView } from './restMeasurementLiveView.js';
import { initRestMeasurementLiveView_2 } from './restMeasurementLiveView_2.js';
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


    let htmlPath, initFunction;
    if (tabName === 'simple') {
        htmlPath = './views/restMeasurementLiveView.html';
        initFunction = initRestMeasurementLiveView;
    } else { // 'advanced'
        htmlPath = './views/restMeasurementLiveView_2.html';
        initFunction = initRestMeasurementLiveView_2;
    }

    try {
        let htmlContent;
        if (loadedHtmlContent[tabName]) {
            htmlContent = loadedHtmlContent[tabName]; // Use cached content
        } else {
            const response = await fetch(htmlPath);
            htmlContent = await response.text();
            // Remove the top-nav from the loaded content as unified view has its own
            htmlContent = htmlContent.replace(/<div class="top-nav">[\s\S]*?<\/div>/, '');
            loadedHtmlContent[tabName] = htmlContent; // Cache content
        }
        
        measurementContentDiv.innerHTML = htmlContent; // Inject HTML

        // Initialize the specific measurement view's JS logic
        // Pass the showViewCallback and the global bluetoothControllerInstance
        await initFunction(showViewCallback, bluetoothControllerInstance);

    } catch (error) {
        console.error(`Error loading measurement tab ${tabName}:`, error);
        measurementContentDiv.innerHTML = `<p class="text-red-400">Fout bij het laden van de metingsinterface: ${error.message}</p>`;
        showNotification(`Fout bij het laden van metingstabblad: ${tabName}`, 'error');
    } finally {
        // Hide loading spinner (already replaced by content, but good practice)
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
    }
}
