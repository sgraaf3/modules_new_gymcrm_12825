// Bestand: app.js
// Dit bestand fungeert als de centrale applicatie-controller en router.
// Het beheert de navigatie tussen verschillende views en initialiseert globale functionaliteiten.

import { getData, putData, deleteData, getAllData, getOrCreateUserId, getUserRole, setUserRole } from './database.js';
import { BluetoothController } from './bluetooth.js';
// De Bodystandard, VO2, RuntimesVo2 klassen worden nu geïmporteerd door de specifieke view modules die ze nodig hebben.
// import { Bodystandard, VO2, RuntimesVo2 } from './modules.js';

// Importeer de initialisatiefuncties voor alle afzonderlijke views
import { initDashboardView } from './js/dashboardView.js';
import { initUserProfileView } from './js/userProfileView.js';
import { initRestMeasurementLiveView } from './js/restMeasurementLiveView.js';
import { initRestMeasurementLiveView_2 } from './js/restMeasurementLiveView_2.js'; // NIEUW: Importeer de nieuwe module
import { initLiveTrainingView } from './js/liveTrainingView.js';
import { initHrDataView } from './js/hrDataView.js';
import { initTestingView } from './js/testingView.js';
import { initTrainingView } from './js/trainingView.js';
// 'restMeasurementView' is vervangen door 'restMeasurementLiveView' en de oude content is verwijderd.
import { initNutritionView } from './js/nutritionView.js';
import { initSleepView } from './js/sleepView.js';
import { initTrainingReportsView } from './js/trainingReportsView.js';
import { initRestReportsView } from './js/restReportsView.js'; // NIEUW: Importeer de nieuwe rustrapporten view
import { initDashboardReportsView } from './js/dashboardReportsView.js';
import { initSchedulesView } from './js/schedulesView.js';
import { initLessonSchedulerView } from './js/lessonSchedulerView.js';
import * as LessonScheduleBuilder from './js/lessonScheduleBuilder.js'; // FIX: Importeer als namespace om exportfout te omzeilen
import { initMeetingPlannerView } from './js/meetingPlannerView.js';
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
import { initDashboardOverviewView } from './js/dashboardOverviewView.js';
import { initSportView } from './js/sportView.js';
import { initActivitiesView } from './js/activitiesView.js';
import { initPermissionsView } from './js/permissionsView.js';
import { initNotesView } from './js/notesView.js';
import { initActionCenterView } from './js/actionCenterView.js';
import { initScheduleBuilderView } from './js/scheduleBuilderView.js';
import { initLessonPlannerView } from './js/lessonPlannerView.js';
import { initGymSectionsView } from './js/gymSectionsView.js';

// Importeer het nieuwe notificatiesysteem
import { showNotification } from './js/notifications.js';


// --- Gedeelde hulpprogrammafuncties (blijven hier, tenzij ze specifiek bij een module horen) ---
function smooth(data, windowSize = 5) {
    const smoothed = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = data.slice(start, i + 1);
        const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
        smoothed.push(avg);
    }
    return smoothed;
}

function getHrZone(currentHR, at) {
    if (currentHR >= at * 1.1) return 'Intensive 2';
    if (currentHR >= at * 1.05) return 'Intensive 1';
    if (currentHR >= at * 0.95) return 'Endurance 3';
    if (currentHR >= at * 0.85) return 'Endurance 2';
    if (currentHR >= at * 0.75) return 'Endurance 1';
    if (currentHR >= at * 0.7 + 5) return 'Cooldown';
    if (currentHR >= at * 0.7) return 'Warmup';
    return 'Resting';
}

// Gebruikers-ID beheer (globaal)
const currentAppUserId = getOrCreateUserId();
window.getUserId = () => currentAppUserId; // Maak globaal beschikbaar

// Mapping van viewIds naar hun HTML-pad en initialisatiefunctie
// Dit object definieert welke HTML-file geladen moet worden en welke JS-functie deze moet initialiseren.
const viewConfig = {
    'dashboardView': { html: './views/dashboardView.html', init: initDashboardView },
    'userProfileView': { html: './views/userProfileView.html', init: initUserProfileView },
    'restMeasurementLiveView': { html: './views/restMeasurementLiveView.html', init: initRestMeasurementLiveView },
    'restMeasurementLiveView_2': { html: './views/restMeasurementLiveView_2.html', init: initRestMeasurementLiveView_2 },
    'liveTrainingView': { html: './views/liveTrainingView.html', init: initLiveTrainingView },
    'hrDataView': { html: './views/hrDataView.html', init: initHrDataView },
    'testingView': { html: './views/testingView.html', init: initTestingView },
    'trainingView': { html: './views/trainingView.html', init: initTrainingView },
    'nutritionView': { html: './views/nutritionView.html', init: initNutritionView },
    'sleepView': { html: './views/sleepView.html', init: initSleepView },
    'trainingReportsView': { html: 'views/trainingReportsView.html', init: initTrainingReportsView },
    'restReportsView': { html: 'views/restReportsView.html', init: initRestReportsView },
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
};

document.addEventListener('DOMContentLoaded', async () => {
    const mainContentArea = document.getElementById('main-content-area');

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
                await config.init(showView, data); // Geef showView en data door
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

    const bluetoothController = new BluetoothController();
    const connectionStatusDisplay = bluetoothWidget.querySelector('#connectionStatusDisplay');
    const liveHrDisplay = bluetoothWidget.querySelector('#liveHrDisplay');
    const liveHrZoneDisplay = bluetoothWidget.querySelector('#liveHrZoneDisplay');
    const liveAvgRrDisplay = bluetoothWidget.querySelector('#liveAvgRrDisplay');
    const liveRmssdDisplay = bluetoothWidget.querySelector('#liveRmssdDisplay');
    const liveBreathRateDisplay = bluetoothWidget.querySelector('#liveBreathRateDisplay');
    const liveTimerDisplay = bluetoothWidget.querySelector('#liveTimerDisplay');
    const startMeasurementBtnLive = bluetoothWidget.querySelector('#startMeasurementBtnLive');
    const stopMeasurementBtnLive = bluetoothWidget.querySelector('#stopMeasurementBtnLive');

    let measurementStartTime;
    let measurementInterval;

    function updateTimer() {
        if (measurementStartTime) {
            const elapsedSeconds = Math.floor((Date.now() - measurementStartTime) / 1000);
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            liveTimerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }

    bluetoothController.onStateChange = (state, deviceName) => {
        connectionStatusDisplay.textContent = `Status: ${state} ${deviceName ? `(${deviceName})` : ''}`;
        if (state === 'STREAMING') {
            startMeasurementBtnLive.style.display = 'none';
            stopMeasurementBtnLive.style.display = 'block';
            measurementStartTime = Date.now();
            measurementInterval = setInterval(updateTimer, 1000);
            showNotification(`Bluetooth verbonden met ${deviceName || 'apparaat'}!`, 'success');
        } else if (state === 'ERROR') {
            showNotification('Bluetooth verbinding mislukt of geannuleerd.', 'error');
        } else if (state === 'STOPPED') {
            showNotification('Bluetooth meting gestopt.', 'info');
        }
    };

    bluetoothController.onData = (dataPacket) => {
        liveHrDisplay.textContent = `${dataPacket.heartRate} BPM`;

        const userBaseAtHR = parseFloat(document.getElementById('userBaseAtHR')?.value) || 0;
        if (userBaseAtHR > 0) {
            liveHrZoneDisplay.textContent = getHrZone(dataPacket.heartRate, userBaseAtHR);
        } else {
            liveHrZoneDisplay.textContent = '-- Zone';
        }

        if (dataPacket.filteredRrIntervals && dataPacket.filteredRrIntervals.length > 0) {
            const avgRr = dataPacket.filteredRrIntervals.reduce((sum, val) => sum + val, 0) / dataPacket.filteredRrIntervals.length;
            liveAvgRrDisplay.textContent = `${avgRr.toFixed(0)} MS`;

            if (dataPacket.filteredRrIntervals.length >= 2) {
                let sumOfDifferencesSquared = 0;
                for (let i = 0; i < dataPacket.filteredRrIntervals.length - 1; i++) {
                    sumOfDifferencesSquared += Math.pow(dataPacket.filteredRrIntervals[i+1] - dataPacket.filteredRrIntervals[i], 2);
                }
                const rmssd = Math.sqrt(sumOfDifferencesSquared / (dataPacket.filteredRrIntervals.length - 1));
                liveRmssdDisplay.textContent = `RMSSD: ${rmssd.toFixed(2)} MS`;
            } else {
                liveRmssdDisplay.textContent = `RMSSD: -- MS`;
            }
        }

        liveBreathRateDisplay.textContent = `${(Math.random() * 10 + 12).toFixed(1)} BPM`;
    };

    if (startMeasurementBtnLive) {
        startMeasurementBtnLive.addEventListener('click', () => {
            bluetoothController.setPreset('resting');
            bluetoothController.connect();
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