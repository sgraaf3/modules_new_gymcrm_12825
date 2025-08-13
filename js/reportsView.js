// Bestand: js/reportsView.js
// Bevat logica voor de interactieve HRV-rapportage en diepgaande analyses.

import { getAllData, getData, getOrCreateUserId } from '../database.js'; // Added getOrCreateUserId
import { showNotification } from './notifications.js';
import { calculateMetrics } from '../hrv_analysis_utils.js'; // Import calculateMetrics
import * as ReportRenderer from '../report_rendering_utils.js'; // Import all rendering utilities

// Global variables to manage the report state and Chart.js instances
let rrIntervalsOriginalData = []; // Stores parsed RR intervals (original raw data with index and timestamp)
let excludedOriginalIndices = new Set(); // Stores original indices of excluded RR intervals
let reportPages = []; // Stores an array of arrays, where each inner array is a page of unique analysis IDs
let currentPageIndex = 0; // Index of the currently visible report page

// DOM element references (will be assigned in initReportsView)
let dataFileInput;
let initialMessage;
let errorMessage;
let rrDataListContainer;
let resetExclusionsBtn;
let rrDataDisplay;
let dataMessage;
let pageOrientationSelect;
let mainPrintContainer;
let addAnalysisButtons;
let reportPagesWrapper; // The container for all report pages
let addNewPageBtn; // Button to add a new page
let prevPageBtn; // Previous page button
let nextPageBtn; // Next page button
let pageCounter; // Page counter display
let historicalSessionSelect; // New: Dropdown for historical sessions

/**
 * Initializes the Reports View, setting up event listeners and loading initial data.
 */
export async function initReportsView() {
    console.log("HRV Reports View geïnitialiseerd.");

    // Assign DOM elements
    dataFileInput = document.getElementById('dataFile');
    initialMessage = document.getElementById('initialMessage');
    errorMessage = document.getElementById('errorMessage');
    rrDataListContainer = document.getElementById('rrDataListContainer');
    resetExclusionsBtn = document.getElementById('resetExclusionsBtn');
    rrDataDisplay = document.getElementById('rrDataDisplay');
    dataMessage = document.getElementById('dataMessage');
    pageOrientationSelect = document.getElementById('pageOrientation');
    mainPrintContainer = document.querySelector('.main-container'); // Corrected selector for main container
    addAnalysisButtons = document.querySelectorAll('.add-analysis-options button');
    reportPagesWrapper = document.getElementById('reportPagesWrapper');
    addNewPageBtn = document.getElementById('addNewPageBtn');
    prevPageBtn = document.getElementById('prevPageBtn');
    nextPageBtn = document.getElementById('nextPageBtn');
    pageCounter = document.getElementById('pageCounter');
    historicalSessionSelect = document.getElementById('historicalSessionSelect'); // New: Get reference

    // Clear any existing chart instances from previous view renders
    // This is important if the user navigates away and comes back
    ReportRenderer.chartInstances = {}; // Reset chart instances object from the rendering utility

    // --- Data Management Event Listeners ---
    dataFileInput.addEventListener('change', handleDataFileUpload);
    resetExclusionsBtn.addEventListener('click', resetAllExclusions);

    // --- Historical Data Listener ---
    if (historicalSessionSelect) {
        historicalSessionSelect.addEventListener('change', loadHistoricalSession);
    }

    // --- Report Builder Event Listeners ---
    addAnalysisButtons.forEach(button => {
        button.addEventListener('click', () => addAnalysisToCurrentPage(button.dataset.analysisId));
    });
    addNewPageBtn.addEventListener('click', addNewReportPage);
    prevPageBtn.addEventListener('click', navigateReportPages);
    nextPageBtn.addEventListener('click', navigateReportPages);

    // --- Print Settings Event Listener ---
    pageOrientationSelect.addEventListener('change', handleOrientationChange);

    // Initial load logic
    await loadHistoricalSessionsIntoDropdown(); // NEW: Load sessions into dropdown first
    loadRrDataForReports(); // Load data from sessionStorage or localStorage
    applyOrientation(localStorage.getItem('printOrientation') || 'portrait'); // Apply saved orientation
    loadReportPagesFromStorage(); // Load saved report pages
    updateAddButtonsState(); // Update add button states based on selectedAnalysisOrder
    updateReportPageVisibility(); // Show the correct page
}


// --- Helper Functions ---
function showElement(element) { element.classList.remove('hidden'); }
function hideElement(element) { element.classList.add('hidden'); }

/**
 * Parses the uploaded file and populates `rrIntervalsOriginalData`.
 * Assumes CSV or TXT with optional timestamp (timestamp,rr_interval or just rr_interval).
 * @param {Event} event - The file input change event.
 */
function handleDataFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        hideElement(errorMessage);
        initialMessage.textContent = `File "${file.name}" loaded. Manage data points on the left, then build your report.`;
        showElement(initialMessage);
        excludedOriginalIndices.clear();
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rawLines = e.target.result.split('\n');
                let tempRrData = [];
                let hasTimestamps = false;

                rawLines.forEach((line, index) => {
                    const parts = line.trim().split(',');
                    let value;
                    let timestamp;

                    if (parts.length === 2) { // Assuming format: timestamp,rr_interval
                        timestamp = new Date(parts[0]).getTime(); // Convert timestamp string to milliseconds
                        value = parseFloat(parts[1]);
                        if (!isNaN(timestamp) && timestamp > 0) {
                            hasTimestamps = true;
                        } else {
                            timestamp = null; // Mark as invalid timestamp
                        }
                    } else if (parts.length === 1) { // Assuming format: rr_interval
                        value = parseFloat(parts[0]);
                    } else {
                        value = NaN; // Invalid format
                    }

                    // Filter out non-numeric, zero, or negative RR values
                    if (!isNaN(value) && value > 0) {
                        tempRrData.push({ value, timestamp: timestamp, originalIndex: index });
                    }
                });

                if (tempRrData.length === 0) {
                    throw new Error("No valid RR interval data found in the file. Please ensure the file contains positive numbers, one per line, or 'timestamp,rr_interval' pairs.");
                }

                // If no valid timestamps were found in the file, generate sequential ones
                if (!hasTimestamps) {
                    let currentTimestamp = Date.now() - (tempRrData.length * 1000); // Start from a past time
                    tempRrData = tempRrData.map(item => {
                        item.timestamp = currentTimestamp;
                        currentTimestamp += 1000; // Increment by 1 second for each interval
                        return item;
                    });
                    showNotification("No timestamps found in file, generating sequential timestamps for RR data.", 'info');
                }

                rrIntervalsOriginalData = tempRrData;
                console.log('Raw RR Intervals Loaded:', rrIntervalsOriginalData.slice(0, 10));
                
                // Store loaded data in localStorage for persistence across pages
                localStorage.setItem('hrvPrintData', JSON.stringify(rrIntervalsOriginalData)); // Store full objects
                localStorage.setItem('hrvExcludedIndices', JSON.stringify(Array.from(excludedOriginalIndices)));

                renderRrDataList();
                updateRrDataDisplay();
                // Re-render all analyses on all pages to reflect new data
                renderAllReportPages();
            } catch (error) {
                showNotification(`Error reading file: ${error.message}`, 'error');
                showElement(errorMessage);
                errorMessage.textContent = `Error reading file: ${error.message}`;
                hideElement(initialMessage);
                rrIntervalsOriginalData = [];
                localStorage.removeItem('hrvPrintData');
                localStorage.removeItem('hrvExcludedIndices');
                renderRrDataList();
                updateRrDataDisplay();
            }
        };
        reader.readAsText(file);
    } else {
        rrIntervalsOriginalData = [];
        localStorage.removeItem('hrvPrintData');
        localStorage.removeItem('hrvExcludedIndices');
        hideElement(initialMessage);
        showNotification("No file selected.", 'info');
        showElement(errorMessage);
        errorMessage.textContent = "No file selected.";
        renderRrDataList();
        updateRrDataDisplay();
    }
    // After new data upload, ensure previously added analysis buttons are re-enabled
    updateAddButtonsState();
    // Re-render analyses based on new data
    renderAllReportPages();
    updateReportPageVisibility();
}

/**
 * Renders the list of RR intervals for exclusion/inclusion.
 */
function renderRrDataList() {
    rrDataListContainer.innerHTML = '';
    if (rrIntervalsOriginalData.length === 0) {
        rrDataListContainer.innerHTML = '<p class="text-gray-400 text-sm italic">No data loaded yet. Upload a file above.</p>';
        return;
    }

    rrIntervalsOriginalData.forEach(item => {
        const span = document.createElement('span');
        span.className = 'rr-item';
        if (excludedOriginalIndices.has(item.originalIndex)) {
            span.classList.add('excluded');
        }
        const date = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'No Time';
        span.textContent = `${item.value.toFixed(2)} ms (${date})`;
        span.onclick = () => toggleExclusion(span, item.originalIndex);
        rrDataListContainer.appendChild(span);
    });
}

/**
 * Toggles the exclusion status of an RR interval.
 * @param {HTMLElement} element - The DOM element representing the RR interval.
 * @param {number} originalIndex - The original index of the RR interval in `rrIntervalsOriginalData`.
 */
function toggleExclusion(element, originalIndex) {
    if (excludedOriginalIndices.has(originalIndex)) {
        excludedOriginalIndices.delete(originalIndex);
        element.classList.remove('excluded');
    } else {
        excludedOriginalIndices.add(originalIndex);
        element.classList.add('excluded');
    }
    console.log("Excluded indices:", Array.from(excludedOriginalIndices));
    
    // Store updated exclusions
    localStorage.setItem('hrvExcludedIndices', JSON.stringify(Array.from(excludedOriginalIndices)));
    // Re-render all analyses on all pages to reflect new filtered data
    renderAllReportPages();
}

/**
 * Resets all excluded RR intervals.
 */
function resetAllExclusions() {
    excludedOriginalIndices.clear();
    localStorage.setItem('hrvExcludedIndices', JSON.stringify(Array.from(excludedOriginalIndices)));
    renderRrDataList();
    showNotification("All exclusions reset.", 'info');
    renderAllReportPages(); // Re-render all analyses
}

/**
 * Gets the filtered RR interval data based on exclusions.
 * @returns {Array<object>} An array of RR interval objects ({value, timestamp, originalIndex}) that are not excluded.
 */
function getFilteredData() {
    return rrIntervalsOriginalData
        .filter(item => !excludedOriginalIndices.has(item.originalIndex));
}

/**
 * Updates the display of loaded RR data in the settings section.
 */
function updateRrDataDisplay() {
    const data = getFilteredData(); // Display filtered data in the settings section
    if (data.length > 0) {
        rrDataDisplay.textContent = data.map(item => `${item.value.toFixed(2)}ms`).join(', ');
        dataMessage.textContent = `Successfully loaded ${data.length} RR intervals.`;
    } else {
        rrDataDisplay.textContent = 'No RR data available or all excluded.';
        dataMessage.textContent = 'Please upload a file or adjust exclusions.';
    }
    updateAddButtonsState(); // Update button states after data display update
}

/**
 * Loads RR data and excluded indices from sessionStorage (for immediate transfer)
 * or localStorage (for persistence across sessions).
 */
function loadRrDataForReports() {
    const lastMeasurementRrData = sessionStorage.getItem('lastMeasurementRrData');

    if (lastMeasurementRrData) {
        rrIntervalsOriginalData = JSON.parse(lastMeasurementRrData);
        sessionStorage.removeItem('lastMeasurementRrData'); // Clear it after loading
        showNotification("Loaded RR data from last measurement.", 'info');
        excludedOriginalIndices.clear(); // Clear exclusions for new measurement data
        localStorage.removeItem('hrvExcludedIndices'); // Clear stored exclusions too
    } else {
        const hrvPrintData = localStorage.getItem('hrvPrintData');
        const hrvExcludedIndices = localStorage.getItem('hrvExcludedIndices');

        if (hrvPrintData) {
            rrIntervalsOriginalData = JSON.parse(hrvPrintData);
            if (hrvExcludedIndices) {
                excludedOriginalIndices = new Set(JSON.parse(hrvExcludedIndices));
            }
        } else {
            rrIntervalsOriginalData = [];
            excludedOriginalIndices.clear();
        }
    }
    renderRrDataList();
    updateRrDataDisplay();
}

/**
 * Loads historical measurement sessions from IndexedDB and populates the dropdown.
 */
async function loadHistoricalSessionsIntoDropdown() {
    if (!historicalSessionSelect) return;

    historicalSessionSelect.innerHTML = '<option value="">-- Load from History --</option>';
    historicalSessionSelect.disabled = true; // Disable while loading
    let allSessions = [];

    try {
        const freeSessions = await getAllData('restSessionsFree');
        const advancedSessions = await getAllData('restSessionsAdvanced');
        
        allSessions = [
            ...freeSessions.map(s => ({ ...s, store: 'restSessionsFree', displayType: 'Simple' })),
            ...advancedSessions.map(s => ({ ...s, store: 'restSessionsAdvanced', displayType: 'Advanced' }))
        ];

        allSessions.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending

        if (allSessions.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No historical data found.";
            historicalSessionSelect.appendChild(option);
        } else {
            allSessions.forEach(session => {
                const option = document.createElement('option');
                option.value = `${session.store}|${session.id}`; // Store name and ID
                option.textContent = `${session.displayType} Measurement - ${session.date} (${session.duration?.toFixed(0) || '--'} min)`;
                historicalSessionSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error loading historical sessions:", error);
        showNotification("Failed to load historical measurement sessions.", 'error');
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "Error loading history.";
        historicalSessionSelect.appendChild(option);
    } finally {
        historicalSessionSelect.disabled = false; // Re-enable dropdown
    }
}

/**
 * Loads a selected historical session's RR data.
 */
async function loadHistoricalSession(event) {
    const selectedValue = event.target.value;
    if (!selectedValue) {
        rrIntervalsOriginalData = []; // Clear current data if no selection
        excludedOriginalIndices.clear();
        localStorage.removeItem('hrvPrintData');
        localStorage.removeItem('hrvExcludedIndices');
        renderRrDataList();
        updateRrDataDisplay();
        renderAllReportPages();
        showNotification("Cleared current RR data.", 'info');
        return;
    }

    const [storeName, sessionId] = selectedValue.split('|');
    if (!storeName || !sessionId) {
        showNotification("Invalid historical session selected.", 'error');
        return;
    }

    try {
        const session = await getData(storeName, parseInt(sessionId)); // Ensure ID is parsed as int
        if (session) {
            // Prefer rawRrData, fall back to filteredRrData
            const rrDataToLoad = session.rawRrData || session.filteredRrData;
            const timestampsToLoad = session.timestamps;

            if (rrDataToLoad && rrDataToLoad.length > 0) {
                // Reconstruct rrIntervalsOriginalData with originalIndex and timestamps
                rrIntervalsOriginalData = rrDataToLoad.map((value, index) => ({
                    value: value,
                    timestamp: timestampsToLoad ? new Date(timestampsToLoad[index]).getTime() : (new Date().getTime() - (rrDataToLoad.length - 1 - index) * 1000), // Use existing timestamp or estimate
                    originalIndex: index
                }));
                excludedOriginalIndices.clear(); // Clear exclusions for new data
                localStorage.setItem('hrvPrintData', JSON.stringify(rrIntervalsOriginalData));
                localStorage.removeItem('hrvExcludedIndices'); // Clear stored exclusions

                renderRrDataList();
                updateRrDataDisplay();
                renderAllReportPages();
                showNotification(`Loaded ${rrDataToLoad.length} RR intervals from historical session.`, 'success');
            } else {
                showNotification("Selected historical session has no RR interval data.", 'warning');
                rrIntervalsOriginalData = [];
                excludedOriginalIndices.clear();
                localStorage.removeItem('hrvPrintData');
                localStorage.removeItem('hrvExcludedIndices');
                renderRrDataList();
                updateRrDataDisplay();
                renderAllReportPages();
            }
        } else {
            showNotification("Historical session not found.", 'error');
        }
    } catch (error) {
        console.error("Error loading historical session:", error);
        showNotification("Failed to load historical session data.", 'error');
    }
}


// --- Analysis Configuration Map ---
// This map defines the properties and rendering functions for each analysis type.
// It uses functions from report_rendering_utils.js
const analysisConfigs = {
    poincare: {
        renderGraph: (data, id) => ReportRenderer.renderPoincarePlot(data.map(d => d.value), id),
        renderTable: (data, id) => ReportRenderer.renderPoincareTable(data.map(d => d.value), id),
        renderText: ReportRenderer.renderPoincareText,
        getChartId: (uniqueId) => `poincareCanvas-${uniqueId}`,
        title: 'Poincaré Plot',
        dataType: 'hrv'
    },
    histogram: {
        renderGraph: (data, id) => ReportRenderer.renderHistogram(data.map(d => d.value), id, 'RR Interval (ms)'),
        renderTable: (data, id) => ReportRenderer.renderHistogramTable(data.map(d => d.value), id, 'RR Interval'),
        renderText: ReportRenderer.renderRrHistogramText,
        getChartId: (uniqueId) => `histogramCanvas-${uniqueId}`,
        title: 'RR Interval Histogram',
        dataType: 'hrv'
    },
    hr_histogram: {
        renderGraph: (data, id) => ReportRenderer.renderHistogram(data.map(d => 60000 / d.value), id, 'Heart Rate (BPM)'),
        renderTable: (data, id) => ReportRenderer.renderHistogramTable(data.map(d => 60000 / d.value), id, 'Heart Rate'),
        renderText: ReportRenderer.renderHrHistogramText,
        getChartId: (uniqueId) => `hrHistogramCanvas-${uniqueId}`,
        title: 'Heart Rate Histogram',
        dataType: 'hrv'
    },
    time_series: {
        renderGraph: (data, id) => ReportRenderer.renderRrTimeSeries(data.map(d => d.value), id, data.map(d => d.timestamp)),
        renderTable: (data, id) => ReportRenderer.renderRrTimeSeriesTable(data.map(d => d.value), id, data.map(d => d.timestamp)),
        renderText: ReportRenderer.renderRrTimeSeriesText,
        getChartId: (uniqueId) => `timeSeriesCanvas-${uniqueId}`,
        title: 'RR Interval Time Series',
        dataType: 'hrv'
    },
    hr_time_series: {
        renderGraph: (data, id) => ReportRenderer.renderHrTimeSeries(data.map(d => 60000 / d.value), id, data.map(d => d.timestamp)),
        renderTable: (data, id) => ReportRenderer.renderHrTimeSeriesTable(data.map(d => 60000 / d.value), id, data.map(d => d.timestamp)),
        renderText: ReportRenderer.renderHrTimeSeriesText,
        getChartId: (uniqueId) => `hrTimeSeriesCanvas-${uniqueId}`,
        title: 'Heart Rate Time Series',
        dataType: 'hrv'
    },
    successive_diff_histogram: {
        renderGraph: (data, id) => ReportRenderer.renderSuccessiveDifferencesHistogram(data.map(d => d.value), id),
        renderTable: (data, id) => ReportRenderer.renderSuccessiveDifferencesTable(data.map(d => d.value), id),
        renderText: ReportRenderer.renderSuccessiveDifferencesHistogramText,
        getChartId: (uniqueId) => `successiveDiffHistogramCanvas-${uniqueId}`,
        title: 'Successive Differences Histogram',
        dataType: 'hrv'
    },
    general_summary: {
        // Pass calculateMetrics to displayGeneralSummary
        renderGraph: (data, id) => ReportRenderer.displayGeneralSummary(data.map(d => d.value), id, calculateMetrics),
        renderTable: (data, id) => ReportRenderer.displayGeneralSummary(data.map(d => d.value), id, calculateMetrics),
        renderText: ReportRenderer.renderGeneralSummaryText,
        getChartId: (uniqueId) => `generalSummaryContent-${uniqueId}`, // No chart, but need an ID for content div
        title: 'General Summary Statistics',
        dataType: 'hrv'
    },
    all_rr_data_view: {
        renderGraph: (data, id) => ReportRenderer.displayAllRRDataRaw(data, id),
        renderTable: (data, id) => ReportRenderer.displayAllRRDataRaw(data, id),
        renderText: ReportRenderer.renderAllRrDataRawText,
        getChartId: (uniqueId) => `allRrDataContent-${uniqueId}`, // No chart, but need an ID for content div
        title: 'All RR Data (Raw)',
        dataType: 'hrv_raw' // Special type to indicate raw data with timestamps
    },
    // New Comprehensive User Report
    comprehensive_user_report: {
        renderGraph: async (data, id) => ReportRenderer.renderComprehensiveUserReport(id), // Orchestrates multiple sections
        renderTable: async (data, id) => ReportRenderer.renderComprehensiveUserReport(id), // Same for table view
        renderText: ReportRenderer.renderComprehensiveUserReportText,
        getChartId: (uniqueId) => `comprehensiveReportContent-${uniqueId}`,
        title: 'Comprehensive User Report',
        dataType: 'comprehensive',
        uniqueGlobal: true // This report should only be added once globally
    },
    // New List Reports (fetching from IndexedDB)
    all_user_settings_report: {
        renderGraph: async (data, id) => ReportRenderer.renderUserSettingsReport(await getAllData('userProfile'), id),
        renderTable: async (data, id) => ReportRenderer.renderUserSettingsReport(await getAllData('userProfile'), id),
        renderText: ReportRenderer.renderUserSettingsText,
        getChartId: (uniqueId) => `userSettingsReportContent-${uniqueId}`,
        title: 'All User Settings',
        dataType: 'indexedDB_list',
        storeName: 'userProfile',
        uniqueGlobal: true // This report should only be added once globally
    },
    all_members_report: {
        renderGraph: async (data, id) => ReportRenderer.renderMembersReport(await getAllData('memberData'), id),
        renderTable: async (data, id) => ReportRenderer.renderMembersReport(await getAllData('memberData'), id),
        renderText: ReportRenderer.renderMembersText,
        getChartId: (uniqueId) => `membersReportContent-${uniqueId}`,
        title: 'All Members',
        dataType: 'indexedDB_list',
        storeName: 'memberData',
        uniqueGlobal: true // This report should only be added once globally
    },
    all_subscriptions_report: {
        renderGraph: async (data, id) => ReportRenderer.renderSubscriptionsReport(await getAllData('subscriptions'), id),
        renderTable: async (data, id) => ReportRenderer.renderSubscriptionsReport(await getAllData('subscriptions'), id),
        renderText: ReportRenderer.renderSubscriptionsText,
        getChartId: (uniqueId) => `subscriptionsReportContent-${uniqueId}`,
        title: 'All Subscriptions',
        dataType: 'indexedDB_list',
        storeName: 'subscriptions',
        uniqueGlobal: true // This report should only be added once globally
    },
    all_financials_report: {
        renderGraph: async (data, id) => ReportRenderer.renderFinancialsReport(await getAllData('finance'), id),
        renderTable: async (data, id) => ReportRenderer.renderFinancialsReport(await await getAllData('finance'), id),
        renderText: ReportRenderer.renderFinancialsText,
        getChartId: (uniqueId) => `financialsReportContent-${uniqueId}`,
        title: 'All Financials',
        dataType: 'indexedDB_list',
        storeName: 'finance',
        uniqueGlobal: true // This report should only be added once globally
    }
};

// --- Report Builder Core Logic ---

let analysisInstanceCounter = 0; // To ensure unique IDs for multiple instances of the same analysis type
let draggedElement = null; // Element currently being dragged

/**
 * Adds an analysis type to the current report page.
 * @param {string} analysisId - The ID of the analysis type (e.g., 'poincare').
 */
async function addAnalysisToCurrentPage(analysisId) {
    if (reportPages.length === 0) {
        addNewReportPage(); // Add a page if none exist
    }

    const baseAnalysisId = analysisId; // The ID from the button
    const config = analysisConfigs[baseAnalysisId];

    if (config.dataType === 'hrv' && rrIntervalsOriginalData.length === 0) {
        showNotification("Please upload valid RR data before adding HRV analyses.", 'warning');
        return;
    }

    // Check if this report type is unique globally and already added
    if (config.uniqueGlobal && reportPages.flat().some(id => id.startsWith(baseAnalysisId))) {
        showNotification(`${config.title} can only be added once to the report.`, 'warning');
        return;
    }
    
    analysisInstanceCounter++;
    const uniqueAnalysisId = `${analysisId}-${analysisInstanceCounter}`; // Create unique ID for this instance

    reportPages[currentPageIndex].push(uniqueAnalysisId); // Add unique ID to the current page's analysis list
    
    // Disable the add button if this analysis type is meant to be unique per page (for HRV charts)
    // or unique globally (for comprehensive/list reports)
    updateAddButtonsState();

    saveReportPagesToStorage();
    await renderCurrentReportPage(); // Re-render the current page to reflect changes
    showNotification(`Added ${analysisConfigs[analysisId].title} to page ${currentPageIndex + 1}.`, 'success');
}

/**
 * Removes an analysis from the report builder.
 * @param {string} uniqueAnalysisIdToRemove - The unique ID of the analysis instance to remove.
 */
function removeAnalysisFromReport(uniqueAnalysisIdToRemove) {
    // Determine the base analysis ID to re-enable the add button
    const baseAnalysisId = uniqueAnalysisIdToRemove.split('-')[0];

    // Remove from the current page's list of analyses
    reportPages[currentPageIndex] = reportPages[currentPageIndex].filter(id => id !== uniqueAnalysisIdToRemove);
    
    // Re-enable the corresponding original "Add" button if no other instance of this base analysis type exists
    // (either on current page for HRV or globally for comprehensive/list reports)
    updateAddButtonsState();

    saveReportPagesToStorage();
    renderCurrentReportPage(); // Re-render the current page
    showNotification(`Removed ${analysisConfigs[baseAnalysisId].title} from page ${currentPageIndex + 1}.`, 'info');
}

/**
 * Renders the current report page with its analyses.
 */
async function renderCurrentReportPage() {
    reportPagesWrapper.innerHTML = ''; // Clear existing pages

    if (reportPages.length === 0) {
        showElement(document.getElementById('noAnalysesMessage')); // Show "no analyses" message
        hideElement(prevPageBtn);
        hideElement(nextPageBtn);
        pageCounter.textContent = '0 / 0';
        return;
    } else {
        hideElement(document.getElementById('noAnalysesMessage'));
        showElement(prevPageBtn);
        showElement(nextPageBtn);
    }

    // Create and append all pages, but only make the current one visible
    for (const [pageIndex, pageAnalyses] of reportPages.entries()) {
        const pageDiv = document.createElement('div');
        pageDiv.className = `report-page bg-gray-900 border-2 border-gray-700 rounded-lg shadow-xl p-6 relative flex flex-col gap-4 ${pageIndex === currentPageIndex ? 'active' : 'hidden'}`;
        pageDiv.dataset.pageIndex = pageIndex;

        // Add remove page button
        if (reportPages.length > 1) { // Only show remove button if there's more than one page
            const removePageBtn = document.createElement('button');
            removePageBtn.className = 'remove-page-button absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold opacity-70 hover:opacity-100 transition-opacity';
            removePageBtn.innerHTML = '&times;';
            removePageBtn.title = 'Remove this page';
            removePageBtn.onclick = () => removeReportPage(pageIndex);
            pageDiv.appendChild(removePageBtn);
        }

        if (pageAnalyses.length === 0) {
            pageDiv.innerHTML += '<p class="text-gray-400 text-center mt-8">Drag analysis blocks here or add them using the buttons above.</p>';
        } else {
            for (const uniqueAnalysisId of pageAnalyses) {
                const baseAnalysisId = uniqueAnalysisId.split('-')[0];
                const config = analysisConfigs[baseAnalysisId];
                if (!config) continue;

                const contentDivId = `content-${uniqueAnalysisId}`;
                const chartId = config.getChartId(uniqueAnalysisId);

                const analysisBox = document.createElement('div');
                analysisBox.className = 'analysis-box bg-gray-800 rounded-lg shadow-md p-4 flex flex-col gap-3 cursor-grab';
                analysisBox.setAttribute('draggable', 'true');
                analysisBox.dataset.analysisId = uniqueAnalysisId;
                analysisBox.id = `analysis-box-${uniqueAnalysisId}`;

                // Default to graph view for newly added analyses, or use stored preference
                // For comprehensive and list reports, 'graph' is essentially the table view
                const defaultContentType = (config.dataType === 'comprehensive' || config.dataType === 'indexedDB_list') ? 'table' : 'graph';
                const storedContentType = localStorage.getItem(`analysisBox-${uniqueAnalysisId}-contentType`) || defaultContentType;

                const graphBtnClass = storedContentType === 'graph' ? 'active' : '';
                const tableBtnClass = storedContentType === 'table' ? 'active' : '';
                const textBtnClass = storedContentType === 'text' ? 'active' : '';

                analysisBox.innerHTML = `
                    <div class="flex items-center">
                        <h3 class="text-lg font-bold text-gray-100 flex-grow">${config.title}</h3>
                        <button class="remove-analysis-button bg-red-500 text-white p-1 rounded-md text-xs hover:bg-red-600 transition-colors" data-analysis-id="${uniqueAnalysisId}">Remove</button>
                    </div>
                    <div class="analysis-options-buttons flex gap-2 justify-center">
                        <button class="option-button bg-gray-600 text-white p-2 rounded-md text-sm hover:bg-gray-700 transition-colors ${graphBtnClass}" data-content-type="graph" data-analysis-id="${uniqueAnalysisId}">Graph</button>
                        <button class="option-button bg-gray-600 text-white p-2 rounded-md text-sm hover:bg-gray-700 transition-colors ${tableBtnClass}" data-content-type="table" data-analysis-id="${uniqueAnalysisId}">Table</button>
                        <button class="option-button bg-gray-600 text-white p-2 rounded-md text-sm hover:bg-gray-700 transition-colors ${textBtnClass}" data-content-type="text" data-analysis-id="${uniqueAnalysisId}">Text</button>
                    </div>
                    <div class="analysis-content-display min-h-[200px] bg-gray-900 rounded-md p-3 border border-gray-700 flex items-center justify-center" id="${contentDivId}">
                        <!-- Content will be rendered here -->
                    </div>
                `;
                pageDiv.appendChild(analysisBox);

                // Attach event listeners for internal buttons (Graph/Table/Text)
                analysisBox.querySelectorAll('.option-button').forEach(button => {
                    button.addEventListener('click', handleAnalysisOptionClick);
                });

                // Attach event listener for the "Remove" button on the analysis box
                analysisBox.querySelector('.remove-analysis-button').addEventListener('click', (event) => {
                    const idToRemove = event.target.dataset.analysisId;
                    removeAnalysisFromReport(idToRemove);
                });

                // Initial render of content for the active page
                if (pageIndex === currentPageIndex) {
                    const dataForAnalysis = getFilteredData(); // HRV data (array of {value, timestamp, originalIndex})
                    
                    // Render based on the stored content type
                    // Add a loading indicator before rendering complex reports
                    const loadingIndicator = document.createElement('p');
                    loadingIndicator.className = 'text-gray-400 text-center py-8';
                    loadingIndicator.textContent = 'Loading data...';
                    contentDiv.innerHTML = loadingIndicator.outerHTML;

                    try {
                        if (storedContentType === 'graph' && config.renderGraph) {
                            await config.renderGraph(config.dataType === 'hrv' || config.dataType === 'hrv_raw' ? dataForAnalysis : null, chartId);
                        } else if (storedContentType === 'table' && config.renderTable) {
                            await config.renderTable(config.dataType === 'hrv' || config.dataType === 'hrv_raw' ? dataForAnalysis : null, contentDiv.id);
                        } else if (storedContentType === 'text' && config.renderText) {
                            await config.renderText(contentDiv.id);
                        }
                    } catch (renderError) {
                        console.error(`Error rendering content for ${uniqueAnalysisId}:`, renderError);
                        contentDiv.innerHTML = `<p class="text-red-400">Error rendering content: ${renderError.message}</p>`;
                    }
                }
            }
        }
        reportPagesWrapper.appendChild(pageDiv);
    }

    // Set up drag and drop listeners for the current active page
    addDragDropListenersToPage(reportPagesWrapper.querySelector('.report-page.active'));

    updateReportPageVisibility(); // Update page counter and navigation buttons
}

/**
 * Updates the visibility of report pages.
 * Only the current page is visible.
 */
function updateReportPageVisibility() {
    const pages = reportPagesWrapper.querySelectorAll('.report-page');
    pages.forEach((page, index) => {
        if (index === currentPageIndex) {
            page.classList.remove('hidden');
            page.classList.add('active');
        } else {
            page.classList.add('hidden');
            page.classList.remove('active');
        }
    });

    pageCounter.textContent = `${reportPages.length > 0 ? currentPageIndex + 1 : 0} / ${reportPages.length}`;
    prevPageBtn.disabled = currentPageIndex === 0;
    nextPageBtn.disabled = currentPageIndex >= reportPages.length - 1;

    // If no pages, disable add analysis buttons
    if (reportPages.length === 0) {
        addAnalysisButtons.forEach(btn => btn.disabled = true);
    } else {
        addAnalysisButtons.forEach(btn => btn.disabled = false);
    }
    updateAddButtonsState(); // Re-evaluate add button states
}

/**
 * Adds a new blank report page.
 */
function addNewReportPage() {
    reportPages.push([]); // Add an empty array for the new page
    currentPageIndex = reportPages.length - 1; // Navigate to the new page
    saveReportPagesToStorage();
    renderCurrentReportPage();
    updateReportPageVisibility();
    showNotification(`New report page added (Page ${currentPageIndex + 1}).`, 'success');
}

/**
 * Removes a report page.
 * @param {number} indexToRemove - The index of the page to remove.
 */
function removeReportPage(indexToRemove) {
    if (reportPages.length === 1) {
        showNotification("Cannot remove the last page. Add a new page first if you want to replace it.", 'warning');
        return;
    }

    // Destroy all chart instances on the page being removed
    reportPages[indexToRemove].forEach(uniqueAnalysisId => {
        const baseAnalysisId = uniqueAnalysisId.split('-')[0];
        const config = analysisConfigs[baseAnalysisId];
        if (config && config.getChartId) {
            ReportRenderer.clearChart(config.getChartId(uniqueAnalysisId));
        }
    });

    reportPages.splice(indexToRemove, 1); // Remove the page
    if (currentPageIndex >= reportPages.length) {
        currentPageIndex = reportPages.length - 1; // Adjust current page if the last one was removed
    }
    saveReportPagesToStorage();
    renderCurrentReportPage();
    updateReportPageVisibility();
    updateAddButtonsState(); // Re-evaluate add button states
    showNotification(`Report page ${indexToRemove + 1} removed.`, 'info');
}


/**
 * Navigates to the previous or next report page.
 * @param {Event} event - The click event from prev/next buttons.
 */
async function navigateReportPages(event) {
    const direction = event.currentTarget.id === 'prevPageBtn' ? -1 : 1;
    if (reportPages.length === 0) return;

    const newIndex = currentPageIndex + direction;
    if (newIndex >= 0 && newIndex < reportPages.length) {
        currentPageIndex = newIndex;
        await renderCurrentReportPage(); // Re-render the new current page
        updateReportPageVisibility();
    }
}

/**
 * Attaches drag and drop event listeners to analysis boxes within a specific page.
 * @param {HTMLElement} pageElement - The DOM element of the current report page.
 */
function addDragDropListenersToPage(pageElement) {
    if (!pageElement) return;

    const boxes = pageElement.querySelectorAll('.analysis-box');
    boxes.forEach(box => {
        box.addEventListener('dragstart', (e) => {
            draggedElement = box;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', box.dataset.analysisId); // Set data for drag
            setTimeout(() => box.classList.add('dragging'), 0); // Add class after a brief delay
        });

        box.addEventListener('dragenter', (e) => {
            e.preventDefault(); // Allow drop
            if (e.target.closest('.analysis-box') && e.target.closest('.analysis-box') !== draggedElement) {
                e.target.closest('.analysis-box').classList.add('drag-over');
            }
        });

        box.addEventListener('dragover', (e) => {
            e.preventDefault(); // Allow drop
            e.dataTransfer.dropEffect = 'move';
            const targetBox = e.target.closest('.analysis-box');
            if (targetBox && targetBox !== draggedElement) {
                const rect = targetBox.getBoundingClientRect();
                const next = (e.clientY - rect.top) / rect.height > 0.5;
                pageElement.insertBefore(draggedElement, next && targetBox.nextSibling ? targetBox.nextSibling : targetBox);
            }
        });

        box.addEventListener('dragleave', (e) => {
            e.target.closest('.analysis-box')?.classList.remove('drag-over');
        });

        box.addEventListener('dragend', () => {
            if (draggedElement) {
                draggedElement.classList.remove('dragging');
                draggedElement = null;
            }
            // Update the reportPages array for the current page based on the new DOM order
            const newOrder = [];
            pageElement.querySelectorAll('.analysis-box').forEach(el => {
                newOrder.push(el.dataset.analysisId);
            });
            reportPages[currentPageIndex] = newOrder;
            saveReportPagesToStorage();
            // No need to re-render the whole page, as DOM is already updated by drag-and-drop
            // Just ensure chart sizes are correct if they were affected
            pageElement.querySelectorAll('canvas').forEach(canvas => {
                if (ReportRenderer.chartInstances[canvas.id]) {
                    ReportRenderer.chartInstances[canvas.id].resize();
                }
            });
        });
    });
}

/**
 * Handles clicks on the Graph/Table/Text buttons for each analysis box.
 * @param {Event} event - The click event.
 */
async function handleAnalysisOptionClick(event) {
    const button = event.target;
    const contentType = button.dataset.contentType;
    const uniqueAnalysisId = button.dataset.analysisId;
    const baseAnalysisId = uniqueAnalysisId.split('-')[0];

    const analysisBox = button.closest('.analysis-box');
    if (!analysisBox) return;

    // Save the active content type to localStorage for persistence
    localStorage.setItem(`analysisBox-${uniqueAnalysisId}-contentType`, contentType);

    // Deactivate all buttons within the same analysis box
    analysisBox.querySelectorAll('.option-button').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active'); // Activate the clicked button

    const config = analysisConfigs[baseAnalysisId];
    const contentDiv = analysisBox.querySelector('.analysis-content-display');
    const chartId = config.getChartId(uniqueAnalysisId); // Get unique chart ID

    const hrvDataForAnalysis = getFilteredData(); // HRV data (array of {value, timestamp, originalIndex})

    // Clear previous chart instance if switching to non-graph view or re-rendering graph
    ReportRenderer.clearChart(chartId);

    if (config.dataType === 'hrv' && hrvDataForAnalysis.length === 0 && baseAnalysisId !== 'all_rr_data_view') {
         contentDiv.innerHTML = '<p class="text-red-400">No valid RR data available after exclusions for this analysis.</p>';
         return;
    }

    // Add a loading indicator before rendering complex reports
    const loadingIndicator = document.createElement('p');
    loadingIndicator.className = 'text-gray-400 text-center py-8';
    loadingIndicator.textContent = 'Loading data...';
    contentDiv.innerHTML = loadingIndicator.outerHTML;

    try {
        if (contentType === 'graph' && config.renderGraph) {
            await config.renderGraph(config.dataType === 'hrv' || config.dataType === 'hrv_raw' ? hrvDataForAnalysis : null, chartId);
        } else if (contentType === 'table' && config.renderTable) {
            await config.renderTable(config.dataType === 'hrv' || config.dataType === 'hrv_raw' ? hrvDataForAnalysis : null, contentDiv.id);
        } else if (contentType === 'text' && config.renderText) {
            await config.renderText(contentDiv.id);
        }
    } catch (renderError) {
        console.error(`Error rendering content for ${uniqueAnalysisId}:`, renderError);
        contentDiv.innerHTML = `<p class="text-red-400">Error rendering content: ${renderError.message}</p>`;
    }
}

/**
 * Updates the disabled state of "Add Analysis" buttons.
 * If an analysis type is already added to the *current page*, its button is disabled.
 */
function updateAddButtonsState() {
    addAnalysisButtons.forEach(button => {
        const analysisId = button.dataset.analysisId;
        const config = analysisConfigs[analysisId];

        let isAddedToCurrentPage = false;
        if (reportPages[currentPageIndex]) {
            isAddedToCurrentPage = reportPages[currentPageIndex].some(id => id.startsWith(analysisId));
        }
        
        // Check for global uniqueness for comprehensive/list reports
        const isUniqueGlobalAdded = config.uniqueGlobal && reportPages.flat().some(id => id.startsWith(analysisId));

        // Disable button if it's already on the current page (for HRV charts)
        // OR if it's a globally unique report and already added anywhere
        button.classList.toggle('added', isAddedToCurrentPage || isUniqueGlobalAdded);
        button.disabled = isAddedToCurrentPage || isUniqueGlobalAdded; 

        // Also disable HRV-related buttons if no HRV data is loaded
        if (config && (config.dataType === 'hrv' || config.dataType === 'hrv_raw') && rrIntervalsOriginalData.length === 0) {
            button.disabled = true;
        }
    });
}

// --- Local Storage Management for Report Pages ---
const REPORT_PAGES_STORAGE_KEY = 'hrvReportPages';

/**
 * Saves the current state of reportPages to localStorage.
 */
function saveReportPagesToStorage() {
    localStorage.setItem(REPORT_PAGES_STORAGE_KEY, JSON.stringify(reportPages));
}

/**
 * Loads reportPages from localStorage.
 */
function loadReportPagesFromStorage() {
    const savedPages = localStorage.getItem(REPORT_PAGES_STORAGE_KEY);
    if (savedPages) {
        reportPages = JSON.parse(savedPages);
        // Find the highest analysisInstanceCounter to ensure unique IDs continue
        let maxCounter = 0;
        reportPages.flat().forEach(uniqueId => {
            const parts = uniqueId.split('-');
            if (parts.length > 1) {
                maxCounter = Math.max(maxCounter, parseInt(parts[parts.length - 1]));
            }
        });
        analysisInstanceCounter = maxCounter;

        if (reportPages.length > 0) {
            currentPageIndex = 0; // Start at the first page
        } else {
            reportPages = [[]]; // Start with one empty page if no pages were saved
            currentPageIndex = 0;
        }
    } else {
        reportPages = [[]]; // Start with one empty page
        currentPageIndex = 0;
    }
    renderCurrentReportPage(); // Render the initial page
}

/**
 * Renders all report pages. This is primarily for printing where all pages need to be in DOM.
 */
async function renderAllReportPages() {
    reportPagesWrapper.innerHTML = ''; // Clear existing pages

    if (reportPages.length === 0) {
        showElement(document.getElementById('noAnalysesMessage'));
        hideElement(prevPageBtn);
        hideElement(nextPageBtn);
        pageCounter.textContent = '0 / 0';
        return;
    } else {
        hideElement(document.getElementById('noAnalysesMessage'));
        showElement(prevPageBtn);
        showElement(nextPageBtn);
    }

    for (const [pageIndex, pageAnalyses] of reportPages.entries()) {
        const pageDiv = document.createElement('div');
        // For full rendering (e.g., print), all pages are 'active' in terms of content generation
        // but 'hidden' for display purposes, to be made visible by print media queries.
        pageDiv.className = `report-page bg-gray-900 border-2 border-gray-700 rounded-lg shadow-xl p-6 relative flex flex-col gap-4 ${pageIndex === currentPageIndex ? 'active' : 'hidden'} print-page-visible`; // Added print-page-visible for print media query
        pageDiv.dataset.pageIndex = pageIndex;

        // Add remove page button (only if more than one page)
        if (reportPages.length > 1) {
            const removePageBtn = document.createElement('button');
            removePageBtn.className = 'remove-page-button absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold opacity-70 hover:opacity-100 transition-opacity print:hidden';
            removePageBtn.innerHTML = '&times;';
            removePageBtn.title = 'Remove this page';
            removePageBtn.onclick = () => removeReportPage(pageIndex);
            pageDiv.appendChild(removePageBtn);
        }

        if (pageAnalyses.length === 0) {
            pageDiv.innerHTML += '<p class="text-gray-400 text-center mt-8">Drag analysis blocks here or add them using the buttons above.</p>';
        } else {
            for (const uniqueAnalysisId of pageAnalyses) {
                const baseAnalysisId = uniqueAnalysisId.split('-')[0];
                const config = analysisConfigs[baseAnalysisId];
                if (!config) continue;

                const contentDivId = `content-${uniqueAnalysisId}`;
                const chartId = config.getChartId(uniqueAnalysisId);

                const analysisBox = document.createElement('div');
                analysisBox.className = 'analysis-box bg-gray-800 rounded-lg shadow-md p-4 flex flex-col gap-3 cursor-grab';
                analysisBox.setAttribute('draggable', 'true');
                analysisBox.dataset.analysisId = uniqueAnalysisId;
                analysisBox.id = `analysis-box-${uniqueAnalysisId}`;

                // Determine the active content type for this analysis box (default to graph)
                const storedContentType = localStorage.getItem(`analysisBox-${uniqueAnalysisId}-contentType`);
                const defaultContentType = (config.dataType === 'comprehensive' || config.dataType === 'indexedDB_list') ? 'table' : 'graph';
                const contentType = storedContentType || defaultContentType;

                const graphBtnClass = contentType === 'graph' ? 'active' : '';
                const tableBtnClass = contentType === 'table' ? 'active' : '';
                const textBtnClass = contentType === 'text' ? 'active' : '';


                analysisBox.innerHTML = `
                    <div class="flex items-center">
                        <h3 class="text-lg font-bold text-gray-100 flex-grow">${config.title}</h3>
                        <button class="remove-analysis-button bg-red-500 text-white p-1 rounded-md text-xs hover:bg-red-600 transition-colors print:hidden" data-analysis-id="${uniqueAnalysisId}">Remove</button>
                    </div>
                    <div class="analysis-options-buttons flex gap-2 justify-center print:hidden">
                        <button class="option-button bg-gray-600 text-white p-2 rounded-md text-sm hover:bg-gray-700 transition-colors ${graphBtnClass}" data-content-type="graph" data-analysis-id="${uniqueAnalysisId}">Graph</button>
                        <button class="option-button bg-gray-600 text-white p-2 rounded-md text-sm hover:bg-gray-700 transition-colors ${tableBtnClass}" data-content-type="table" data-analysis-id="${uniqueAnalysisId}">Table</button>
                        <button class="option-button bg-gray-600 text-white p-2 rounded-md text-sm hover:bg-gray-700 transition-colors ${textBtnClass}" data-content-type="text" data-analysis-id="${uniqueAnalysisId}">Text</button>
                    </div>
                    <div class="analysis-content-display min-h-[200px] bg-gray-900 rounded-md p-3 border border-gray-700 flex items-center justify-center" id="${contentDivId}">
                        <!-- Content will be rendered here -->
                    </div>
                `;
                pageDiv.appendChild(analysisBox);

                // Attach event listeners for internal buttons (Graph/Table/Text)
                analysisBox.querySelectorAll('.option-button').forEach(button => {
                    button.addEventListener('click', handleAnalysisOptionClick);
                });

                // Attach event listener for the "Remove" button on the analysis box
                analysisBox.querySelector('.remove-analysis-button').addEventListener('click', (event) => {
                    const idToRemove = event.target.dataset.analysisId;
                    removeAnalysisFromReport(idToRemove);
                });

                // Render content for printing (all content types should be rendered based on their active state)
                const hrvDataForAnalysis = getFilteredData(); // HRV data
                
                // Add a loading indicator before rendering complex reports
                const loadingIndicator = document.createElement('p');
                loadingIndicator.className = 'text-gray-400 text-center py-8';
                loadingIndicator.textContent = 'Loading data...';
                const currentContentDiv = document.getElementById(contentDivId);
                if (currentContentDiv) {
                    currentContentDiv.innerHTML = loadingIndicator.outerHTML;
                }

                try {
                    if (config.dataType === 'hrv' || config.dataType === 'hrv_raw') {
                        if (hrvDataForAnalysis.length > 0) {
                            if (contentType === 'graph' && config.renderGraph) {
                                await config.renderGraph(hrvDataForAnalysis, chartId);
                            } else if (contentType === 'table' && config.renderTable) {
                                await config.renderTable(hrvDataForAnalysis, contentDiv.id);
                            } else if (contentType === 'text' && config.renderText) {
                                await config.renderText(contentDiv.id);
                            }
                        } else {
                            if (currentContentDiv) currentContentDiv.innerHTML = '<p class="text-red-400">No valid RR data available after exclusions for this analysis.</p>';
                        }
                    } else { // For IndexedDB data types
                        if (contentType === 'graph' && config.renderGraph) {
                            await config.renderGraph(null, chartId); // Pass null for data, function fetches internally
                        } else if (contentType === 'table' && config.renderTable) {
                            await config.renderTable(null, contentDiv.id);
                        } else if (contentType === 'text' && config.renderText) {
                            await config.renderText(contentDiv.id);
                        }
                    }
                } catch (renderError) {
                    console.error(`Error rendering content for ${uniqueAnalysisId}:`, renderError);
                    if (currentContentDiv) currentContentDiv.innerHTML = `<p class="text-red-400">Error rendering content: ${renderError.message}</p>`;
                }
            }
        }
        reportPagesWrapper.appendChild(pageDiv);
    }

    // Set up drag and drop listeners for the current active page
    addDragDropListenersToPage(reportPagesWrapper.querySelector('.report-page.active'));

    updateReportPageVisibility(); // Update page counter and navigation buttons
}


// --- Print Functionality ---
/**
 * Applies the selected page orientation to the print container.
 * @param {string} orientation - 'portrait' or 'landscape'.
 */
function applyOrientation(orientation) {
    if (orientation === 'landscape') {
        mainPrintContainer.classList.add('landscape-view');
        document.body.classList.add('landscape-mode'); // For @page rule
    } else {
        mainPrintContainer.classList.remove('landscape-view');
        document.body.classList.remove('landscape-mode'); // For @page rule
    }
}

/**
 * Handles the change event for the page orientation select dropdown.
 * @param {Event} event - The change event.
 */
function handleOrientationChange(event) {
    const selectedOrientation = event.target.value;
    localStorage.setItem('printOrientation', selectedOrientation); // Save preference
    applyOrientation(selectedOrientation); // Apply immediately
}

// Event listener for the main Print button
document.getElementById('printBtn').addEventListener('click', async () => {
    // Render all pages and their contents for printing.
    // This will temporarily make all pages and their content visible in the DOM,
    // which the print CSS will then handle for page breaks.
    await renderAllReportPages();

    // Add a small delay to allow charts to render before printing
    setTimeout(() => {
        window.print();
    }, 500); // Adjust delay as needed
});

// Clean up after print
window.onafterprint = () => {
    // After printing, revert to showing only the current active page
    renderCurrentReportPage();
};
