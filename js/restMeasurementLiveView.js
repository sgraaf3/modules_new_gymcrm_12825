// Bestand: js/restMeasurementLiveView.js
// Bevat logica voor het uitvoeren en opslaan van live rustmetingen.

import { BluetoothController } from '../bluetooth.js';
import { putData, getData, getOrCreateUserId } from '../database.js';
import { showNotification } from './notifications.js';
import { Bodystandard, VO2, RuntimesVo2 } from '../rr_hr_hrv_engine.js';

function generateReport(sessionData, measurementType, bodystandardAnalysis, vo2Analysis, runtimesVo2Analysis, hrChartDataUrl, rrChartDataUrl) {
    let reportContent = `--- Measurement Report ---\n`;
    reportContent += `Measurement Type: ${measurementType}\n`;
    reportContent += `Duration: ${sessionData.totalDuration} seconds\n`;
    reportContent += `Average Heart Rate: ${sessionData.avgHr.toFixed(0)} BPM\n`;
    reportContent += `RMSSD: ${sessionData.rmssd.toFixed(2)} MS\n`;
    reportContent += `Calories Burned: ${sessionData.caloriesBurned} kcal\n`;
    reportContent += `\nRaw HR Data Points: ${sessionData.heartRates.length}\n`;
    reportContent += `Raw RR Data Points: ${sessionData.rrIntervals.length}\n`;

    if (bodystandardAnalysis && Object.keys(bodystandardAnalysis).length > 0) {
        reportContent += `\n--- Body Standard Analysis ---\n`;
        reportContent += `LBM: ${bodystandardAnalysis.LBM} kg\n`;
        reportContent += `Fat Mass: ${bodystandardAnalysis.fatMass} kg\n`;
        reportContent += `Muscle Mass: ${bodystandardAnalysis.muscleMass} kg\n`;
        reportContent += `BMI: ${bodystandardAnalysis.bmi}\n`;
        reportContent += `Ideal Weight (BMI): ${bodystandardAnalysis.idealWeightBMI} kg\n`;
        reportContent += `Metabolic Age: ${bodystandardAnalysis.metabolicAge} years\n`;
        reportContent += `BMR: ${bodystandardAnalysis.bmr} kcal/day\n`;
    }

    if (vo2Analysis && Object.keys(vo2Analysis).length > 0) {
        reportContent += `\n--- VO2 Analysis ---\n`;
        reportContent += `Maximal Oxygen Uptake: ${vo2Analysis.maximalOxygenUptake}\n`;
        reportContent += `VO2 Standard: ${vo2Analysis.vo2Standard}\n`;
        reportContent += `VO2 Max Potential: ${vo2Analysis.vo2MaxPotential}\n`;
        reportContent += `Theoretical Max: ${vo2Analysis.theoreticalMax}\n`;
        reportContent += `Warming Up HR: ${vo2Analysis.warmingUp} BPM\n`;
        reportContent += `Cooling Down HR: ${vo2Analysis.coolingDown} BPM\n`;
        reportContent += `Endurance 1 HR: ${vo2Analysis.endurance1} BPM\n`;
        reportContent += `Endurance 2 HR: ${vo2Analysis.endurance2} BPM\n`;
        reportContent += `Endurance 3 HR: ${vo2Analysis.endurance3} BPM\n`;
        reportContent += `Intensive 1 HR: ${vo2Analysis.intensive1} BPM\n`;
        reportContent += `Intensive 2 HR: ${vo2Analysis.intensive2} BPM\n`;
    }

    if (runtimesVo2Analysis && Object.keys(runtimesVo2Analysis).length > 0 && runtimesVo2Analysis.times) {
        reportContent += `\n--- Estimated Run Times (based on VO2 Max) ---\n`;
        for (const [distance, time] of Object.entries(runtimesVo2Analysis.times)) {
            const minutes = Math.floor(time / 60);
            const seconds = time % 60;
            reportContent += `${distance}: ${minutes}m ${seconds}s\n`;
        }
    }

    reportContent += `\n--- End of Report ---`;
    return reportContent;
}

// Globale variabelen voor de grafiek en data
let hrChart;
let rrChart;
let hrData = [];
let rrData = [];
let selectedMeasurementType = 'resting'; // Standaard geselecteerd type

// showViewCallback wordt nu doorgegeven vanuit app.js
export async function initRestMeasurementLiveView(showViewCallback) {
    console.log("Rustmeting Live View geïnitialiseerd.");

    const currentAppUserId = getOrCreateUserId();

    const bluetoothController = new BluetoothController();
    const measurementTypeSelect = document.getElementById('measurementTypeSelect'); // Nieuw selectieveld
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
        hrZones: [],
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
    if (hrChart) hrChart.destroy();
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
    if (rrChart) rrChart.destroy();
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
        }
    };

    // Verwerk inkomende Bluetooth data
    bluetoothController.onData = async (dataPacket) => {
        if (liveHrDisplay) liveHrDisplay.textContent = `${dataPacket.heartRate} BPM`;

        const userProfile = await getData('userProfile', currentAppUserId);
        const userBaseAtHR = userProfile ? parseFloat(userProfile.userBaseAtHR) : 0;

        if (liveHrZoneDisplay) {
            if (userBaseAtHR > 0) {
                liveHrZoneDisplay.textContent = getHrZone(dataPacket.heartRate, userBaseAtHR);
            } else {
                liveHrZoneDisplay.textContent = '-- Zone';
            }
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
            console.log("Stop button clicked. currentSessionData:", currentSessionData);
            console.log("Heart Rates Length:", currentSessionData.heartRates.length);
            // Bereken gemiddelde HR en calorieën na stoppen
            if (currentSessionData.heartRates.length > 0) {
                const totalHr = currentSessionData.heartRates.reduce((sum, hr) => sum + hr, 0);
                currentSessionData.avgHr = totalHr / currentSessionData.heartRates.length;
                // Calorieën (voorbeeld berekening, kan complexer zijn)
                // Aanname: 10 kcal per minuut per 100 BPM gemiddelde HR
                currentSessionData.caloriesBurned = (currentSessionData.avgHr * currentSessionData.totalDuration / 60 / 10).toFixed(0);

                console.log("Heart rates available, proceeding with report generation.");
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
                console.log("Attempting to capture charts with html2canvas.");
                const hrChartCanvas = document.getElementById('hrChart');
                const rrChartCanvas = document.getElementById('rrChart');
                // Temporarily make charts visible for html2canvas
                if (hrChartCanvas) hrChartCanvas.style.display = 'block';
                if (rrChartCanvas) rrChartCanvas.style.display = 'block';
                const hrChartImg = hrChartCanvas ? await html2canvas(hrChartCanvas) : null;
                const rrChartImg = rrChartCanvas ? await html2canvas(rrChartCanvas) : null;
                console.log("html2canvas capture complete. hrChartImg:", !!hrChartImg, "rrChartImg:", !!rrChartImg);
                // Hide charts again
                if (hrChartCanvas) hrChartCanvas.style.display = 'none';
                if (rrChartCanvas) rrChartCanvas.style.display = 'none';
                const hrChartDataUrl = hrChartImg ? hrChartImg.toDataURL('image/png') : null;
                const rrChartDataUrl = rrChartImg ? rrChartImg.toDataURL('image/png') : null;

                const report = generateReport(currentSessionData, selectedMeasurementType, bodystandardAnalysis, vo2Analysis, runtimesVo2Analysis, hrChartDataUrl, rrChartDataUrl);
                console.log("Generated Report:\n", report); // Log for debugging

                console.log("Attempting to generate PDF with jspdf.");
                // Generate PDF
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                let yPos = 10;

                doc.text(report, 10, yPos);
                yPos += report.split('\n').length * 5; // Estimate line height;

                if (hrChartDataUrl) {
                    doc.addImage(hrChartDataUrl, 'PNG', 10, yPos, 180, 90);
                    yPos += 100;
                }
                if (rrChartDataUrl) {
                    doc.addImage(rrChartDataUrl, 'PNG', 10, yPos, 180, 90);
                }

                doc.save(`measurement_report_${new Date().toISOString().split('T')[0]}.pdf`);
                console.log("PDF saved.");

                // Print the report (opens print dialog)
                const printWindow = window.open('', '_blank');
                printWindow.document.write('<pre>' + report + '</pre>');
                if (hrChartDataUrl) {
                    printWindow.document.write('<img src="' + hrChartDataUrl + '" style="width:100%;">');
                }
                if (rrChartDataUrl) {
                    printWindow.document.write('<img src="' + rrChartDataUrl + '" style="width:100%;">');
                }
                printWindow.document.close();
                printWindow.print();
                console.log("Print dialog opened.");

                // Download the text report as a fallback/alternative
                const blob = new Blob([report], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `measurement_report_${new Date().toISOString().split('T')[0]}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                console.log("Text report downloaded.");
            } else {
                console.log("No heart rate data available to generate report.");
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

    // Functie om HR Zone te bepalen (kan ook in een aparte utility file)
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

        })}}