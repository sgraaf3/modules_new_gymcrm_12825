const DB_NAME = 'SportsCRMDB';
const DB_VERSION = 17; // VERSIE VERHOOGD NAAR 17 om de IndexedDB upgrade te forceren

const USER_PROFILE_STORE = 'userProfile';
const TRAINING_SESSIONS_STORE = 'trainingSessions';
const ADMIN_SECRET_STORE = 'adminSecretData';
const SCHEDULES_STORE = 'schedules'; // General schedules
const LESSON_SCHEDULES_STORE = 'lessonSchedules'; // Lesson specific schedules
const MEETINGS_STORE = 'meetings';
const MESSAGES_STORE = 'messages';
const MEMBER_DATA_STORE = 'memberData';
const MEMBER_ACTIVITY_STORE = 'memberActivity';
const POPULARITY_STORE = 'popularityData';
const MEMBER_SETTINGS_STORE = 'memberSettings';
const SUBSCRIPTIONS_STORE = 'subscriptions';
const LOGS_STORE = 'logs';
const REGISTRY_STORE = 'registry';
const MEMBER_MEMBERSHIP_STORE = 'memberMemberships';
const FINANCE_STORE = 'finance';
const DOCS_STORE = 'documents';
const TOGGLE_SETTINGS_STORE = 'toggleSettings';
const DASHBOARD_SETTINGS_STORE = 'dashboardSettings';
const NUTRITION_PROGRAMS_STORE = 'nutritionPrograms';
const ASSIGNED_NUTRITION_PROGRAMS_STORE = 'assignedNutritionPrograms';
const FOOD_LOGS_STORE = 'foodLogs';
const SPORT_STORE = 'sportData';
const ACTIVITIES_STORE = 'activitiesData';
const PERMISSIONS_STORE = 'permissionsData';
const NOTES_STORE = 'notesData';
const ACTION_CENTER_STORE = 'actionCenterData';
const USER_ROLE_STORE = 'userRoles';
const SLEEP_DATA_STORE = 'sleepData';
const LESSONS_STORE = 'lessons';
const TEST_PROTOCOLS_STORE = 'testProtocols';

// New stores for schedule builder content
const TRAINING_DAYS_STORE = 'trainingDays';
const TRAINING_WEEKS_STORE = 'trainingWeeks';
const TRAINING_BLOCKS_STORE = 'trainingBlocks';
const CUSTOM_MEASUREMENTS_STORE = 'customMeasurements'; // For custom training/rest measurements (from form builder)
const CONFIGURED_SESSIONS_STORE = 'configuredSessions'; // NIEUW: Voor opgeslagen sessies uit de Sessie Bouwer
const ROLES_STORE = 'roles'; // Added for permissions module
const LINKED_DOCUMENTS_STORE = 'linkedDocuments'; // Added for documents module

let dbInstance;

export async function openDatabase() {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const stores = [
                USER_PROFILE_STORE, TRAINING_SESSIONS_STORE, ADMIN_SECRET_STORE,
                SCHEDULES_STORE, LESSON_SCHEDULES_STORE, MEETINGS_STORE,
                MESSAGES_STORE, MEMBER_DATA_STORE, MEMBER_ACTIVITY_STORE,
                POPULARITY_STORE, MEMBER_SETTINGS_STORE, SUBSCRIPTIONS_STORE,
                LOGS_STORE, REGISTRY_STORE, MEMBER_MEMBERSHIP_STORE,
                FINANCE_STORE, DOCS_STORE, TOGGLE_SETTINGS_STORE,
                DASHBOARD_SETTINGS_STORE, NUTRITION_PROGRAMS_STORE,
                ASSIGNED_NUTRITION_PROGRAMS_STORE, FOOD_LOGS_STORE,
                SPORT_STORE, ACTIVITIES_STORE, PERMISSIONS_STORE, NOTES_STORE, ACTION_CENTER_STORE,
                USER_ROLE_STORE,
                SLEEP_DATA_STORE,
                'restSessionsFree',
                'restSessionsAdvanced',
                LESSONS_STORE, TEST_PROTOCOLS_STORE,
                TRAINING_DAYS_STORE, TRAINING_WEEKS_STORE, TRAINING_BLOCKS_STORE, CUSTOM_MEASUREMENTS_STORE,
                CONFIGURED_SESSIONS_STORE, // NIEUW
                ROLES_STORE, // NIEUW
                LINKED_DOCUMENTS_STORE // NIEUW
            ];

            stores.forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    let options = { keyPath: 'id', autoIncrement: true };
                    if (storeName === USER_PROFILE_STORE || storeName === ADMIN_SECRET_STORE || storeName === LESSON_SCHEDULES_STORE || storeName === USER_ROLE_STORE) {
                        // userRoles uses 'userId' as keyPath, not 'id'
                        if (storeName === USER_ROLE_STORE) {
                            options = { keyPath: 'userId' };
                        } else {
                            options = { keyPath: 'id' }; // These stores use 'id' as keyPath, no autoIncrement
                        }
                    }
                    db.createObjectStore(storeName, options);
                }
            });
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject(event.target.error);
        };
    });
}

export async function putData(storeName, data) {
    const db = await openDatabase();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteData(storeName, id) {
    const db = await openDatabase();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function getData(storeName, id) {
    const db = await openDatabase();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function getAllData(storeName) {
    const db = await openDatabase();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function getOrCreateUserId() {
    let userId = localStorage.getItem('appUserId');
    if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem('appUserId', userId);
    }
    return userId;
}

export async function getUserRole(userId) {
    const userRole = await getData(USER_ROLE_STORE, userId);
    return userRole ? userRole.role : 'member';
}

export async function setUserRole(userId, role) {
    await putData(USER_ROLE_STORE, { userId: userId, role: role });
}
