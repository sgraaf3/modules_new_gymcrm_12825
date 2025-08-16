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
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const htmlContent = await response.text();
            mainContentArea.innerHTML = htmlContent;

            if (config.init) {
                // Pass the showView function as a callback for navigation, and the bluetooth controller
                await config.init(showView, data, bluetoothController);
            }

            // Re-bind general event listeners after loading new content
            bindGeneralEventListeners();

        } catch (error) {
            console.error(`Fout bij het laden van view '${viewId}':`, error);
            mainContentArea.innerHTML = `<div class="p-4 text-red-400">Fout bij het laden van de pagina: ${viewId}. Controleer de console voor details.</div>`;
            showNotification(`Fout bij het laden van pagina: ${viewId}`, 'error');
        }
    }

    function bindGeneralEventListeners() {
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
                if (targetViewId) {
                    showView(targetViewId, { graphType: graphType });
                }
            });
        });
    }

    // --- NEW Floating Action Button (FAB) Navigation Logic ---
    const fabContainer = document.getElementById('fab-container');
    const fabMain = document.getElementById('fab-main');
    const openBluetoothWidgetBtn = document.getElementById('openBluetoothWidget');


    if (fabMain && fabContainer) {
        fabMain.addEventListener('click', () => {
            fabContainer.classList.toggle('active');
        });

        document.querySelectorAll('.fab-option').forEach(item => {
            item.addEventListener('click', (event) => {
                const targetViewId = event.currentTarget.dataset.targetView;
                if (targetViewId) {
                    showView(targetViewId);
                    fabContainer.classList.remove('active'); // Close menu on selection
                }
            });
        });
    }

    if (openBluetoothWidgetBtn) {
        openBluetoothWidgetBtn.addEventListener('click', () => {
             showView('liveTrainingView');
        });
    }
    
    // Start de applicatie met het dashboard
    showView('dashboardView');
});
