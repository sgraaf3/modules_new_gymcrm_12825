// Bestand: app.js
// Dit bestand fungeert als de centrale applicatie-controller en router.
// Het beheert de navigatie tussen verschillende views en initialiseert globale functionaliteiten.
console.log('app.js: Script execution started.');

import { getData, putData, deleteData, getAllData, getOrCreateUserId, setUserRole } from './database.js'; // Removed getUserRole as it's not used here
import { BluetoothController } from './bluetooth.js';
import { getHrZone } from './js/measurement_utils.js';
import { showNotification } from './js/notifications.js';

// Importeer de initialisatiefuncties voor alle afzonderlijke views
import { initDashboardView } from './js/dashboardView.js';
import { initUserProfileView } from './js/userProfileView.js';
import { initUnifiedMeasurementView } from './js/unifiedMeasurementView.js';
import { initLiveTrainingView } from './js/liveTrainingView.js';
import { initHrDataView } from './js/hrDataView.js';
import { initTestingView } from './js/testingView.js';
import { initTrainingView } from './js/trainingView.js';
import { initNutritionView } from './js/nutritionView.js';
import { initSleepView } from './js/sleepView.js';
import { initTrainingReportsView } from './js/trainingReportsView.js';

import { initDashboardReportsView } from './js/dashboardReportsView.js';
import { initSchedulesView } from './js/schedulesView.js';
import { initLessonSchedulerView } from './js/lessonSchedulerView.js';
import * as LessonScheduleBuilder from './js/lessonScheduleBuilder.js';
import { initMeetingPlannerView } from './js/meetingPlannerView.js';
import { initLessonPlannerView } from './js/lessonPlannerView.js';
import { initMessagesView } from './js/messagesView.js';
import { initMemberSpecificprogressView, showDetailedGraph } from './js/memberSpecificprogressView.js';
import { initMemberActivityView } from './js/memberActivityView.js';
import { initPopularityView } from './js/popularityView.js';
import { initMemberSettingsView } from './js/memberSettingsView.js';
import { initSubscriptionsView } from './js/subscriptionsView.js';
import { initLogsView } from './js/logsView.js';
import { initRegistryView } from './js/registryView.js';
import { initMemberMembershipView } from './js/memberMembershipView.js';
import { initFinanceView } from './js/financeView.js';
import { initDocsView } from './js/docsView.js';
import { initAdminOnlyView } from './js/adminOnlyView.js';
import { initToggleFunctionalityView } from './js/toggleFunctionalityView.js';
import { initGymSectionsView } from './js/gymSectionsView.js';
import { initDashboardOverviewView } from './js/dashboardOverviewView.js';
import { initSportView } from './js/sportView.js';
import { initActivitiesView } from './js/activitiesView.js';
import { initPermissionsView } from './js/permissionsView.js';
import { initNotesView } from './js/notesView.js';
import { initActionCenterView } from './js/actionCenterView.js';
import { initScheduleBuilderView } from './js/scheduleBuilderView.js';

// Import the new Invoicing View
import { initInvoicingView } from './js/invoicingView.js';

// Import Trainer Management and Trainer Dashboard Views
import { initTrainerManagementView } from './js/trainerManagementView.js'; // NIEUW
import { initTrainerDashboardView } from './js/trainerDashboardView.js'; // NIEUW


// Gebruikers-ID beheer (globaal)
const currentAppUserId = getOrCreateUserId();
window.getUserId = () => currentAppUserId; // Maak globaal beschikbaar

// Mapping van viewIds naar hun HTML-pad en initialisatiefunctie
// Dit object definieert welke HTML-file geladen moet worden en welke JS-functie deze moet initialiseren.
const viewConfig = {
    'dashboardView': { html: './views/dashboardView.html', init: initDashboardView },
    'userProfileView': { html: './views/userProfileView.html', init: initUserProfileView },
    'unifiedMeasurementView': { html: './views/unifiedMeasurementView.html', init: initUnifiedMeasurementView },
    'liveTrainingView': { html: './views/liveTrainingView.html', init: initLiveTrainingView },
    'hrDataView': { html: './views/hrDataView.html', init: initHrDataView },
    'testingView': { html: './views/testingView.html', init: initTestingView },
    'trainingView': { html: './views/trainingView.html', init: initTrainingView },
    'nutritionView': { html: './views/nutritionView.html', init: initNutritionView },
    'sleepView': { html: './views/sleepView.html', init: initSleepView },
        'trainingReportsView': { html: 'views/trainingReportsView.html', init: initTrainingReportsView },
    'dashboardReportsView': { html: 'views/dashboardReportsView.html', init: initDashboardReportsView },
    'schedulesView': { html: 'views/schedulesView.html', init: initSchedulesView },
    'lessonSchedulerView': { html: 'views/lessonSchedulerView.html', init: initLessonSchedulerView },
    'lessonScheduleBuilderView': { html: './views/lessonScheduleBuilder.html', init: LessonScheduleBuilder.initLessonScheduleBuilderView },
    'meetingPlannerView': { html: './views/meetingPlannerView.html', init: initMeetingPlannerView },
    'lessonPlannerView': { html: './views/lessonPlannerView.html', init: initLessonPlannerView },
    'messagesView': { html: './views/messagesView.html', init: initMessagesView },
    'memberSpecificprogressView': { html: './views/memberSpecificprogressView.html', init: initMemberSpecificprogressView },
    'webGraphsView': { html: './views/webGraphsView.html', init: showDetailedGraph },
    'memberActivityView': { html: './views/memberActivityView.html', init: initMemberActivityView },
    'popularityView': { html: './views/popularityView.html', init: initPopularityView },
    'memberSettingsView': { html: 'views/memberSettingsView.html', init: initMemberSettingsView },
    'subscriptionsView': { html: './views/subscriptionsView.html', init: initSubscriptionsView },
    'logsView': { html: './views/logsView.html', init: initLogsView },
    'registryView': { html: './views/registryView.html', init: initRegistryView },
    'memberMembershipView': { html: './views/memberMembershipView.html', init: initMemberMembershipView },
    'financeView': { html: './views/financeView.html', init: initFinanceView },
    'docsView': { html: './views/docsView.html', init: initDocsView },
    'adminOnlyView': { html: './views/adminOnlyView.html', init: initAdminOnlyView },
    'toggleFunctionalityView': { html: './views/toggleFunctionalityView.html', init: initToggleFunctionalityView },
    'gymSectionsView': { html: './views/gymSectionsView.html', init: initGymSectionsView },
    'dashboardOverviewView': { html: './views/dashboardOverviewView.html', init: initDashboardOverviewView },
    'sportView': { html: './views/sportView.html', init: initSportView },
    'activitiesView': { html: './views/activitiesView.html', init: initActivitiesView },
    'permissionsView': { html: './views/permissionsView.html', init: initPermissionsView },
    'notesView': { html: './views/notesView.html', init: initNotesView },
    'actionCenterView': { html: './views/actionCenterView.html', init: initActionCenterView },
    'scheduleBuilderView': { html: './views/scheduleBuilderView.html', init: initScheduleBuilderView },
    'invoicingView': { html: './views/invoicingView.html', init: initInvoicingView },
    'trainerManagementView': { html: './views/trainerManagementView.html', init: initTrainerManagementView }, // NIEUW
    'trainerDashboardView': { html: './views/trainerDashboardView.html', init: initTrainerDashboardView }, // NIEUW
};

document.addEventListener('DOMContentLoaded', async () => {
    const mainContentArea = document.getElementById('main-content-area');

    // Instantiate BluetoothController globally once
    const bluetoothController = new BluetoothController();

    async function showView(viewId, data = null) {
        const config = viewConfig[viewId];
        if (!config) {
            console.error(`View met ID '${viewId}' niet gevonden in configuratie.`);
            showNotification(`Fout: Pagina '${viewId}' niet gevonden.`, 'error');
            return;
        }

        try {
            const response = await fetch(config.html);
            const htmlContent = await response.text();
            mainContentArea.innerHTML = htmlContent;

            document.querySelectorAll('.bottom-nav-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.targetView === viewId) {
                    item.classList.add('active');
                }
            });

            if (config.init) {
                // Pass the global bluetoothController instance to the init function
                await config.init(showView, data, bluetoothController);
            }

            // Algemene terug-naar-dashboard knop
            document.querySelectorAll('[data-action="backToDashboard"]').forEach(button => {
                button.addEventListener('click', () => {
                    showView('dashboardView');
                });
            });

            // Algemene dashboard widget card listeners (voor navigatie naar gedetailleerde views)
            document.querySelectorAll('.dashboard-widget-card').forEach(card => {
                card.addEventListener('click', (event) => {
                    const targetViewId = event.currentTarget.dataset.targetView;
                    const graphType = event.currentTarget.dataset.graphType;
                    if (targetViewId === 'webGraphsView' && graphType) {
                        showView(targetViewId, { graphType: graphType });
                    } else if (targetViewId) { // Zorg ervoor dat targetViewId bestaat
                        showView(targetViewId);
                    }
                });
            });

            // Algemene bottom-nav item listeners
            document.querySelectorAll('.bottom-nav-item').forEach(item => {
                item.addEventListener('click', (event) => {
                    const targetViewId = event.currentTarget.dataset.targetView;
                    if (targetViewId) {
                        showView(targetViewId);
                    }
                });
            });

        } catch (error) {
            console.error(`Fout bij het laden van view '${viewId}':`, error);
            mainContentArea.innerHTML = `<div class="p-4 text-red-400">Fout bij het laden van de pagina: ${viewId}. Controleer de console voor details.</div>`;
            showNotification(`Fout bij het laden van pagina: ${viewId}`, 'error');
        }
    }

    // Start de applicatie met het dashboard
    showView('dashboardView');

    // --- Globale Bluetooth Widget Logica (blijft in app.js omdat het een zwevende widget is) ---
    const bluetoothWidget = document.getElementById('bluetoothWidget');
    const openBluetoothWidgetBtn = document.getElementById('openBluetoothWidget');
    const toggleBluetoothWidgetBtn = document.getElementById('toggleBluetoothWidget');

    // Data collection for global widget
    let globalWidgetRrData = [];
    let globalWidgetTimestamps = [];
    let globalWidgetMeasurementStartTime;
    let globalWidgetMeasurementInterval;

    const connectionStatusDisplay = bluetoothWidget.querySelector('#connectionStatusDisplay');
    const liveHrDisplay = bluetoothWidget.querySelector('#liveHrDisplay');
    const liveHrZoneDisplay = bluetoothWidget.querySelector('#liveHrZoneDisplay');
    const liveAvgRrDisplay = bluetoothWidget.querySelector('#liveAvgRrDisplay');
    const liveRmssdDisplay = bluetoothWidget.querySelector('#liveRmssdDisplay');
    const liveBreathRateDisplay = bluetoothWidget.querySelector('#liveBreathRateDisplay');
    const liveTimerDisplay = bluetoothWidget.querySelector('#liveTimerDisplay');
    const startMeasurementBtnLive = bluetoothWidget.querySelector('#startMeasurementBtnLive');
    const stopMeasurementBtnLive = bluetoothWidget.querySelector('#stopMeasurementBtnLive');
    const bluetoothErrorTooltip = document.getElementById('bluetoothErrorTooltip'); // Get the tooltip element

    function updateGlobalWidgetTimer() {
        if (globalWidgetMeasurementStartTime) {
            const elapsedSeconds = Math.floor((Date.now() - globalWidgetMeasurementStartTime) / 1000);
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            liveTimerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }

    bluetoothController.onStateChange = async (state, deviceName) => {
        connectionStatusDisplay.textContent = `Status: ${state} ${deviceName ? `(${deviceName})` : ''}`;
        if (state === 'STREAMING') {
            if (startMeasurementBtnLive) {
                startMeasurementBtnLive.style.display = 'block'; // Make visible
                startMeasurementBtnLive.disabled = false; // Enable the button
            }
            if (stopMeasurementBtnLive) stopMeasurementBtnLive.style.display = 'block';
            globalWidgetMeasurementStartTime = Date.now();
            globalWidgetMeasurementInterval = setInterval(updateGlobalWidgetTimer, 1000);
            showNotification(`Bluetooth verbonden met ${deviceName || 'apparaat'}!`, 'success');
            // Reset data for new measurement
            globalWidgetRrData = [];
            globalWidgetTimestamps = [];
        } else if (state === 'ERROR') {
            showNotification('Bluetooth verbinding mislukt of geannuleerd.', 'error');
            if (startMeasurementBtnLive) {
                startMeasurementBtnLive.style.display = 'block';
                startMeasurementBtnLive.disabled = true; // Disable the button
            }
            if (stopMeasurementBtnLive) stopMeasurementBtnLive.style.display = 'none';
        } else if (state === 'STOPPED') {
            showNotification('Bluetooth meting gestopt.', 'info');
            clearInterval(globalWidgetMeasurementInterval);
            if (startMeasurementBtnLive) {
                startMeasurementBtnLive.style.display = 'block';
                startMeasurementBtnLive.disabled = true; // Disable the button
            }
            if (stopMeasurementBtnLive) stopMeasurementBtnLive.style.display = 'none';

            // Save RR data to sessionStorage before navigating
            if (globalWidgetRrData.length > 0) {
                const rrDataWithTimestamps = globalWidgetRrData.map((value, index) => ({
                    value: value,
                    timestamp: globalWidgetTimestamps[index] ? new Date(globalWidgetTimestamps[index]).getTime() : (new Date().getTime() - (globalWidgetRrData.length - 1 - index) * 1000), // Use actual timestamp or estimate
                    originalIndex: index
                }));
                sessionStorage.setItem('lastMeasurementRrData', JSON.stringify(rrDataWithTimestamps));
            } else {
                sessionStorage.removeItem('lastMeasurementRrData');
            }

            // Navigate to reports page after measurement stops
            showView('reportsView');
        }
    };

    bluetoothController.onData = async (dataPacket) => {
        if (liveHrDisplay) liveHrDisplay.textContent = `${dataPacket.heartRate} BPM`;

        // Store raw RR data and timestamps for global widget
        if (dataPacket.rawRrIntervals && dataPacket.rawRrIntervals.length > 0) {
            dataPacket.rawRrIntervals.forEach(rr => {
                globalWidgetRrData.push(rr);
                globalWidgetTimestamps.push(new Date().getTime()); // Store current timestamp for each RR
            });
        }

        const userProfile = await getData('userProfile', currentAppUserId);
        const userBaseAtHR = userProfile ? parseFloat(userProfile.userBaseAtHR) : 0;
        
        if (liveHrZoneDisplay) {
            // getHrZone is imported at the top of app.js
            liveHrZoneDisplay.textContent = getHrZone(dataPacket.heartRate, userBaseAtHR, 0); // Pass 0 for rmssd in global widget context
        }

        if (dataPacket.filteredRrIntervals && dataPacket.filteredRrIntervals.length > 0) {
            const avgRr = dataPacket.filteredRrIntervals.reduce((sum, val) => sum + val, 0) / dataPacket.filteredRrIntervals.length;
            if (liveAvgRrDisplay) liveAvgRrDisplay.textContent = `${avgRr.toFixed(0)} MS`;

            if (dataPacket.filteredRrIntervals.length >= 2) {
                let sumOfDifferencesSquared = 0;
                for (let i = 0; i < dataPacket.filteredRrIntervals.length - 1; i++) {
                    sumOfDifferencesSquared += Math.pow(dataPacket.filteredRrIntervals[i+1] - dataPacket.filteredRrIntervals[i], 2);
                }
                const rmssd = Math.sqrt(sumOfDifferencesSquared / (dataPacket.filteredRrIntervals.length - 1));
                if (liveRmssdDisplay) liveRmssdDisplay.textContent = `RMSSD: ${rmssd.toFixed(2)} MS`;
            } else {
                if (liveRmssdDisplay) liveRmssdDisplay.textContent = `RMSSD: -- MS`;
            }
        }

        // Simulate breath rate for the global widget if not provided by Bluetooth
        if (liveBreathRateDisplay) liveBreathRateDisplay.textContent = `${(Math.random() * 10 + 12).toFixed(1)} BPM`;
    };

    if (startMeasurementBtnLive) {
        startMeasurementBtnLive.addEventListener('click', () => {
            // Check if Bluetooth is connected (assuming bluetoothController.isConnected() exists)
            if (bluetoothController.isConnected()) {
                bluetoothController.setPreset('resting'); // Default preset for global widget
                bluetoothController.connect();
                if (bluetoothErrorTooltip) bluetoothErrorTooltip.classList.add('hidden'); // Hide tooltip if connected
            } else {
                // Show error tooltip if not connected
                if (bluetoothErrorTooltip) bluetoothErrorTooltip.classList.remove('hidden');
                // Optionally hide the tooltip after a few seconds
                setTimeout(() => {
                    if (bluetoothErrorTooltip) bluetoothErrorTooltip.classList.add('hidden');
                }, 5000); // Hide after 5 seconds
            }
        });
    }

    if (stopMeasurementBtnLive) {
        stopMeasurementBtnLive.addEventListener('click', () => {
            bluetoothController.disconnect();
        });
    }

    openBluetoothWidgetBtn.addEventListener('click', () => {
        bluetoothWidget.classList.toggle('hidden');
        bluetoothWidget.classList.toggle('active');
    });

    toggleBluetoothWidgetBtn.addEventListener('click', () => {
        bluetoothWidget.classList.add('hidden');
        bluetoothWidget.classList.remove('active');
    });
});
