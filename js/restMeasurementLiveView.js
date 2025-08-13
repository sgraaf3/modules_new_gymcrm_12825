// Bestand: js/restMeasurementLiveView.js
// Bevat logica voor het uitvoeren en opslaan van live rustmetingen.

// Removed direct import of BluetoothController, will be passed or accessed globally
import { putData, getData, getOrCreateUserId } from '../database.js';
import { showNotification } from './notifications.js';
// Import Bodystandard, VO2, RuntimesVo2, HRVAnalyzer, BreathManager, generateMeasurementReport, getHrZone, simulateBreathingFromRr, smooth, getBreathRateColorClass, calculateRpe
// from the new consolidated measurement_utils.js
import { Bodystandard, VO2, RuntimesVo2, HRVAnalyzer, BreathManager, generateMeasurementReport, getHrZone, simulateBreathingFromRr, smooth, getBreathRateColorClass, calculateRpe } from '../js/measurement_utils.js';


// Globale variabelen voor de grafiek en data
let hrChart;
let rrChart;
let hrData = [];
let rrData = [];
let selectedMeasurementType = 'resting'; // Standaard geselecteerd type

// showViewCallback en bluetoothController worden nu doorgegeven vanuit unifiedMeasurementView.js
export async function initRestMeasurementLiveView(showViewCallback, bluetoothController) {
    console.log("Rustmeting Live View geïnitialiseerd.");

    const currentAppUserId = getOrCreateUserId();

    // DOM elementen lokaal ophalen, aangezien de HTML dynamisch geladen wordt
    const measurementTypeSelect = document.getElementById('measurementTypeSelect');
    const liveHrDisplay = document.getElementById('liveHrDisplay');
    const liveHrZoneDisplay = document.getElementById('liveHrZoneDisplay');
    const liveAvgRrDisplay = document.getElementById('liveAvgRrDisplay');
    const liveRmssdDisplay = document.getElementById('liveRmssdDisplay');
    const liveBreathRateDisplay = document.getElementById('liveBreathRateDisplay');
    const liveTimerDisplay = document.getElementById('liveTimerDisplay');
    const startMeasurementBtnLive = document.getElementById('startMeasurementBtnLive');
    const stopMeasurementBtnLive = document.getElementById('stopMeasurementBtnLive');
    const hrChartCtx = document.getElementById('hrChart')?.getContext('2d');
    const rrChartCtx = document.getElementById('rrChart')?.getContext('2d');
    const saveMeasurementBtn = document.getElementById('saveMeasurementBtn');

    let measurementStartTime;
    let measurementInterval;
    let currentSessionData = {
        heartRates: [],
        rrIntervals: [],
        timestamps: [],
        hrZones: [], // This will now store time spent in zones
        caloriesBurned: 0,
        totalDuration: 0,
        rmssd: 0,
        avgHr: 0
    };

    // Stel het initiële geselecteerde type in
    if (measurementTypeSelect) {
        selectedMeasurementType = measurementTypeSelect.value;
        measurementTypeSelect.addEventListener('change', (event) => {
            selectedMeasurementType = event.target.value;
            showNotification(`Metingstype ingesteld op: ${event.target.options[event.target.selectedIndex].text}`, 'info', 2000);
            // In simple view, breathing is always shown, so no need to hide/show elements based on type
        });
    }

    // Functie om de timer bij te werken
    function updateTimer() {
        if (measurementStartTime) {
            const elapsedSeconds = Math.floor((Date.now() - measurementStartTime) / 1000);
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            liveTimerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            currentSessionData.totalDuration = elapsedSeconds;
        }
    }

    // Initialiseer HR grafiek
    if (hrChart) hrChart.destroy(); // Destroy existing chart if any
    if (hrChartCtx) {
        hrChart = new Chart(hrChartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Hartslag (BPM)',
                    data: [],
                    borderColor: '#f87171', // Rood
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        min: 40, // Vaste schaal
                        max: 200, // Vaste schaal
                        title: {
                            display: true,
                            text: 'Hartslag (BPM)'
                        }
                    },
                    x: {
                        display: false // Tijdlabels kunnen te druk zijn
                    }
                },
                animation: false, // Schakel animaties uit voor vloeiendere live data
                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        });
    }

    // Initialiseer RR grafiek
    if (rrChart) rrChart.destroy(); // Destroy existing chart if any
    if (rrChartCtx) {
        rrChart = new Chart(rrChartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'RR Interval (ms)',
                    data: [],
                    borderColor: '#a78bfa', // Paars
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        min: 400, // Vaste schaal voor RR
                        max: 1200, // Vaste schaal voor RR
                        title: {
                            display: true,
                            text: 'RR Interval (ms)'
                        }
                    },
                    x: {
                        display: false
                    }
                },
                animation: false,
                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        });
    }

    // Update de UI met Bluetooth status
    bluetoothController.onStateChange = (state, deviceName) => {
        // connectionStatusDisplay is nu in de floating widget, niet in deze view
        // We kunnen hier een notificatie tonen als de verbinding verandert
        if (state === 'STREAMING') {
            if (startMeasurementBtnLive) startMeasurementBtnLive.style.display = 'none';
            if (stopMeasurementBtnLive) stopMeasurementBtnLive.style.display = 'block';
            measurementStartTime = Date.now();
            measurementInterval = setInterval(updateTimer, 1000);
            showNotification(`Bluetooth verbonden met ${deviceName || 'apparaat'}!`, 'success');
            if (measurementTypeSelect) measurementTypeSelect.disabled = true; // Schakel selectie uit tijdens meting
        } else if (state === 'ERROR') {
            showNotification('Bluetooth verbinding mislukt of geannuleerd.', 'error');
            if (startMeasurementBtnLive) startMeasurementBtnLive.style.display = 'block';
            if (stopMeasurementBtnLive) stopMeasurementBtnLive.style.display = 'none';
            if (measurementTypeSelect) measurementTypeSelect.disabled = false;
        } else if (state === 'STOPPED') {
            showNotification('Bluetooth meting gestopt.', 'info');
            clearInterval(measurementInterval);
            if (startMeasurementBtnLive) startMeasurementBtnLive.style.display = 'block';
            if (stopMeasurementBtnLive) stopMeasurementBtnLive.style.display = 'none';
            if (saveMeasurementBtn) saveMeasurementBtn.style.display = 'block'; // Toon de opslagknop na het stoppen
            if (measurementTypeSelect) measurementTypeSelect.disabled = false;
            
            // Save RR data to sessionStorage before navigating
            if (currentSessionData.rrIntervals.length > 0) {
                const rrDataWithTimestamps = currentSessionData.rrIntervals.map((value, index) => ({
                    value: value,
                    timestamp: new Date().getTime() - (currentSessionData.rrIntervals.length - 1 - index) * 1000, // Estimate timestamps
                    originalIndex: index
                }));
                sessionStorage.setItem('lastMeasurementRrData', JSON.stringify(rrDataWithTimestamps));
            } else {
                sessionStorage.removeItem('lastMeasurementRrData');
            }

            // Navigate to reports page after measurement stops
            if (showViewCallback) {
                showViewCallback('reportsView');
            }
        }
    };

    // Verwerk inkomende Bluetooth data
    bluetoothController.onData = async (dataPacket) => {
        if (liveHrDisplay) liveHrDisplay.textContent = `${dataPacket.heartRate} BPM`;

        const userProfile = await getData('userProfile', currentAppUserId);
        const userBaseAtHR = userProfile ? parseFloat(userProfile.userBaseAtHR) : 0;
        const userRestHR = userProfile ? parseFloat(userProfile.userRestHR) : 0; // Needed for getHrZone
        const userMaxHR = userProfile ? parseFloat(userProfile.userMaxHR) : 0; // Needed for getHrZone

        if (liveHrZoneDisplay) {
            // Pass a dummy RMSSD (0) for simple view as it's not calculated here
            liveHrZoneDisplay.textContent = getHrZone(dataPacket.heartRate, userBaseAtHR, 0); 
        }

        // Voeg data toe aan de grafieken
        const now = new Date().toLocaleTimeString();
        hrData.push(dataPacket.heartRate);
        currentSessionData.heartRates.push(dataPacket.heartRate);
        currentSessionData.timestamps.push(now);

        if (hrChart) {
            hrChart.data.labels.push(now);
            hrChart.data.datasets[0].data.push(dataPacket.heartRate);
            // Beperk het aantal datapunten om prestatie te behouden
            const maxDataPoints = 100;
            if (hrChart.data.labels.length > maxDataPoints) {
                hrChart.data.labels.shift();
                hrChart.data.datasets[0].data.shift();
            }
            hrChart.update();
        }

        if (dataPacket.filteredRrIntervals && dataPacket.filteredRrIntervals.length > 0) {
            const avgRr = dataPacket.filteredRrIntervals.reduce((sum, val) => sum + val, 0) / dataPacket.filteredRrIntervals.length;
            if (liveAvgRrDisplay) liveAvgRrDisplay.textContent = `${avgRr.toFixed(0)} MS`;

            dataPacket.filteredRrIntervals.forEach(rr => {
                rrData.push(rr);
                currentSessionData.rrIntervals.push(rr);
            });

            // Bereken RMSSD van de verzamelde RR-intervallen voor de huidige sessie
            if (currentSessionData.rrIntervals.length >= 2) {
                let sumOfDifferencesSquared = 0;
                for (let i = 0; i < currentSessionData.rrIntervals.length - 1; i++) {
                    sumOfDifferencesSquared += Math.pow(currentSessionData.rrIntervals[i+1] - currentSessionData.rrIntervals[i], 2);
                }
                currentSessionData.rmssd = Math.sqrt(sumOfDifferencesSquared / (currentSessionData.rrIntervals.length - 1));
                if (liveRmssdDisplay) liveRmssdDisplay.textContent = `RMSSD: ${currentSessionData.rmssd.toFixed(2)} MS`;
            } else {
                if (liveRmssdDisplay) liveRmssdDisplay.textContent = `RMSSD: -- MS`;
                currentSessionData.rmssd = 0;
            }

            if (rrChart) {
                // Voeg alle nieuwe RR-intervallen toe aan de grafiek
                dataPacket.filteredRrIntervals.forEach(rr => {
                    rrChart.data.labels.push(new Date().toLocaleTimeString()); // Gebruik huidige tijd voor RR labels
                    rrChart.data.datasets[0].data.push(rr);
                });
                const maxDataPoints = 100;
                if (rrChart.data.labels.length > maxDataPoints) {
                    rrChart.data.labels = rrChart.data.labels.slice(-maxDataPoints);
                    rrChart.data.datasets[0].data = rrChart.data.datasets[0].data.slice(-maxDataPoints);
                }
                rrChart.update();
            }
        }

        if (liveBreathRateDisplay) liveBreathRateDisplay.textContent = `${(Math.random() * 10 + 12).toFixed(1)} BPM`;
    };

    // Event listeners voor knoppen
    if (startMeasurementBtnLive) {
        startMeasurementBtnLive.addEventListener('click', () => {
            // Reset data bij een nieuwe start
            hrData = [];
            rrData = [];
            currentSessionData = {
                heartRates: [],
                rrIntervals: [],
                timestamps: [],
                hrZones: [],
                caloriesBurned: 0,
                totalDuration: 0,
                rmssd: 0,
                avgHr: 0
            };
            if (hrChart) {
                hrChart.data.labels = [];
                hrChart.data.datasets[0].data = [];
                hrChart.update();
            }
            if (rrChart) {
                rrChart.data.labels = [];
                rrChart.data.datasets[0].data = [];
                rrChart.update();
            }
            if (liveTimerDisplay) liveTimerDisplay.textContent = '00:00';
            if (saveMeasurementBtn) saveMeasurementBtn.style.display = 'none'; // Verberg opslagknop

            if (!bluetoothController.isConnected()) {
                bluetoothController.setPreset(selectedMeasurementType); // Gebruik het geselecteerde metingstype
                bluetoothController.connect();
            } else {
                // If already connected, directly start the measurement process
                bluetoothController.onStateChange('STREAMING', bluetoothController.device.name); // Simulate streaming state
            }
        });
    }

    if (stopMeasurementBtnLive) {
        stopMeasurementBtnLive.addEventListener('click', async () => {
            bluetoothController.disconnect();
            // Bereken gemiddelde HR en calorieën na stoppen
            if (currentSessionData.heartRates.length > 0) {
                const totalHr = currentSessionData.heartRates.reduce((sum, hr) => sum + hr, 0);
                currentSessionData.avgHr = totalHr / currentSessionData.heartRates.length;
                // Calorieën (voorbeeld berekening, kan complexer zijn)
                // Aanname: 10 kcal per minuut per 100 BPM gemiddelde HR
                currentSessionData.caloriesBurned = (currentSessionData.avgHr * currentSessionData.totalDuration / 60 / 10).toFixed(0);

                // Fetch user profile for analysis
                const userProfile = await getData('userProfile', currentAppUserId);
                let bodystandardAnalysis = {};
                let vo2Analysis = {};
                let runtimesVo2Analysis = {};
                if (userProfile) {
                    const { gender, age, weight, height, fatPercentage, maxWatt, userBaseAtHR } = userProfile;
                    if (gender && age && weight && height && fatPercentage) {
                        bodystandardAnalysis = new Bodystandard({ gender, age, weight, height, fatPercentage });
                    }
                    if (age && height && weight && maxWatt && userBaseAtHR && fatPercentage && gender) {
                        vo2Analysis = new VO2({ age, height, weight, maxWatt, at: userBaseAtHR, fatPercentage, gender });
                    }
                    if (vo2Analysis.maximalOxygenUptake) {
                        runtimesVo2Analysis = new RuntimesVo2(vo2Analysis.maximalOxygenUptake);
                    }
                }
                
                // Generate PDF
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                let yPos = 10;

                // Capture charts for PDF
                const chartsToCapture = [];
                if (hrChart && document.getElementById('hrChart')) chartsToCapture.push({ id: 'hrChart', chart: hrChart, canvas: document.getElementById('hrChart') });
                if (rrChart && document.getElementById('rrChart')) chartsToCapture.push({ id: 'rrChart', chart: rrChart, canvas: document.getElementById('rrChart') });

                const capturedImages = {};
                for (const { id, chart, canvas } of chartsToCapture) {
                    // Temporarily make chart visible for html2canvas if it's hidden
                    const originalDisplay = canvas.style.display;
                    canvas.style.display = 'block';
                    try {
                        const img = await html2canvas(canvas);
                        capturedImages[id] = img.toDataURL('image/png');
                    } catch (error) {
                        console.error(`Error capturing chart ${id}:`, error);
                    } finally {
                        canvas.style.display = originalDisplay; // Restore original display
                    }
                }

                // Generate text report content
                const reportText = generateMeasurementReport(currentSessionData, selectedMeasurementType, bodystandardAnalysis, vo2Analysis, runtimesVo2Analysis);
                doc.text(reportText, 10, yPos);
                yPos += reportText.split('\n').length * 5; // Estimate line height;

                // Add captured images to PDF
                for (const { id } of chartsToCapture) {
                    if (capturedImages[id]) {
                        doc.addImage(capturedImages[id], 'PNG', 10, yPos, 180, 90); // Adjust size as needed
                        yPos += 100;
                    }
                }

                doc.save(`measurement_report_simple_${new Date().toISOString().split('T')[0]}.pdf`);
                showNotification('Rapport succesvol gedownload!', 'success');

            } else {
                showNotification('Geen metingsdata om rapport te genereren.', 'warning');
            }
            // Navigate to reports page after measurement stops
            if (showViewCallback) {
                showViewCallback('reportsView');
            }
        });
    }

    if (saveMeasurementBtn) {
        saveMeasurementBtn.addEventListener('click', async () => {
            if (currentSessionData.totalDuration > 0) {
                const sessionToSave = {
                    userId: currentAppUserId,
                    type: selectedMeasurementType, // Sla het geselecteerde type meting op
                    date: new Date().toISOString().split('T')[0], // Datum in YYYY-MM-DD formaat
                    duration: currentSessionData.totalDuration / 60, // Duur in minuten
                    avgHr: currentSessionData.avgHr.toFixed(0),
                    rmssd: currentSessionData.rmssd,
                    caloriesBurned: currentSessionData.caloriesBurned,
                    rawHrData: currentSessionData.heartRates, // Optioneel: ruwe data opslaan
                    rawRrData: currentSessionData.rrIntervals, // Optioneel: ruwe data opslaan
                    timestamps: currentSessionData.timestamps // Optioneel: timestamps opslaan
                };

                try {
                    await putData('restSessionsFree', sessionToSave);
                    showNotification('Meting succesvol opgeslagen!', 'success');
                    if (showViewCallback) {
                        showViewCallback('trainingReportsView'); // Navigeer naar de rapportenpagina
                    }
                } catch (error) {
                    console.error("Fout bij opslaan meting:", error);
                    showNotification('Fout bij opslaan meting.', 'error');
                }
            } else {
                showNotification('Geen metingsdata om op te slaan.', 'warning');
            }
        });
    }

    // Zorg ervoor dat de opslagknop initieel verborgen is
    if (saveMeasurementBtn) saveMeasurementBtn.style.display = 'none';

    // Remove old top-nav from the HTML as it's now handled by the unified view
    const oldTopNav = document.querySelector('.top-nav');
    if (oldTopNav) oldTopNav.remove();
}
