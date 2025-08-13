// Bestand: js/trainingReportsView.js
// Bevat logica voor geavanceerde rapportagemogelijkheden en diepgaande analyses voor individuele trainingssessies.

import { getAllData, getData } from '../database.js';
import { showNotification } from './notifications.js';
import { HRVAnalyzer } from './measurement_utils.js'; // Corrected import path for the feature-rich HRVAnalyzer

import { initIndividualHrChart, initIndividualHrvChart, initBreathRateChart } from './reports/regularReports.js';
import { initSleepTrendChart, initSportActivitiesTrendChart } from './reports/afterReports.js';

// Globale variabelen om Chart.js instanties bij te houden
let sessionHrRrChart;
let sessionHrvChart;
let sessionBreathChart;
let sessionPoincarePlotChart; // Added for detailed report
let sessionPowerSpectrumChart; // Added for detailed report

// Helper function to format time from seconds to MM:SS
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === null) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// Helper function to determine HR Zone (copied from restMeasurementLiveView_2.js for consistency)
function getHrvBasedRestZone(rmssd) {
    if (rmssd >= 70) return 'Relaxed';
    if (rmssd >= 50) return 'Rest';
    if (rmssd >= 30) return 'Active Low';
    if (rmssd >= 10) return 'Active High';
    return 'Transition to sportzones';
}

function getHrZone(currentHR, at, rmssd) {
    const warmupHrThreshold = at * 0.65;
    if (currentHR >= at * 1.06) return 'Intensive 2';
    if (currentHR >= at * 1.01) return 'Intensive 1';
    if (currentHR >= at) return 'AT';
    if (currentHR >= at * 0.90) return 'Endurance 3';
    if (currentHR >= at * 0.80) return 'Endurance 2';
    if (currentHR >= at * 0.70) return 'Endurance 1';
    if (currentHR >= warmupHrThreshold + 5) return 'Cooldown';
    if (currentHR >= warmupHrThreshold) return 'Warmup';
    // If below warmup threshold, use HRV-based zones
    return getHrvBasedRestZone(rmssd);
}


// Functie om een gedetailleerd rapport te genereren en weer te geven
async function displayDetailedTrainingReport(session) {
    const detailedReportContainer = document.getElementById('detailedReportContainer');
    if (!detailedReportContainer) {
        console.error("Detailed report container not found.");
        showNotification("Fout: Rapport container niet gevonden.", "error");
        return;
    }

    // Haal gebruikersprofiel op voor context
    const userId = session.userId; // De userId moet in de sessie data zitten
    const userProfile = await getData('userProfile', userId);
    const userBaseAtHR = userProfile ? parseFloat(userProfile.userBaseAtHR) : 0;
    const userMaxHR = userProfile ? parseFloat(userProfile.userMaxHR) : 0;
    const userRestHR = userProfile ? parseFloat(userProfile.userRestHR) : 0;

    // Berekeningen voor uitleg en weergave
    let avgHr = parseFloat(session.avgHr) || 0;
    let rmssd = parseFloat(session.rmssd) || 0;
    let sdnn = parseFloat(session.sdnn) || 0;
    let pnn50 = parseFloat(session.pnn50) || 0;
    let lfPower = parseFloat(session.lfPower) || 0;
    let hfPower = parseFloat(session.hfPower) || 0;
    let vlfPower = parseFloat(session.vlfPower) || 0;
    let avgBreathRate = parseFloat(session.avgBreathRate) || 0;
    let lfHfRatio = (hfPower > 0) ? (lfPower / hfPower).toFixed(2) : '--';

    // Als pnn50, lfPower, hfPower, vlfPower niet direct in de session data zitten,
    // moeten we HRVAnalyzer hier opnieuw uitvoeren op session.rawRrData
    let hrvAnalyzerForReport = null;
    if (session.rawRrData && session.rawRrData.length >= 30) {
        try {
            hrvAnalyzerForReport = new HRVAnalyzer(session.rawRrData);
            // Overwrite met meer accurate waarden van de HRVAnalyzer
            rmssd = hrvAnalyzerForReport.rmssd;
            sdnn = hrvAnalyzerForReport.sdnn;
            pnn50 = hrvAnalyzerForReport.pnn50;
            lfPower = hrvAnalyzerForReport.frequency.lfPower;
            hfPower = hrvAnalyzerForReport.frequency.hfPower;
            vlfPower = hrvAnalyzerForReport.frequency.vlfPower;
            lfHfRatio = hrvAnalyzerForReport.frequency.lfHfRatio;
        } catch (e) {
            console.error("Error calculating HRV for report:", e);
            showNotification("Fout bij berekenen HRV voor rapport.", "error");
        }
    }


    // Interpretatie teksten
    let hrInterpretation = `Je gemiddelde hartslag tijdens deze sessie was ${avgHr} BPM.`;
    if (userBaseAtHR > 0) {
        const hrPercentageOfAt = (avgHr / userBaseAtHR) * 100;
        hrInterpretation += ` Dit komt overeen met ${hrPercentageOfAt.toFixed(0)}% van je Anaerobe Drempel.`;
        if (hrPercentageOfAt > 95) hrInterpretation += ` Dit duidt op een zeer intensieve inspanning, ideaal voor het verbeteren van je maximale prestaties. Zorg voor voldoende herstel.`;
        else if (hrPercentageOfAt > 80) hrInterpretation += ` Dit was een intensieve training, goed voor het verhogen van je uithoudingsvermogen.`;
        else if (hrPercentageOfAt > 65) hrInterpretation += ` Dit was een training met matige intensiteit, perfect voor het opbouwen van je aerobe basis.`;
        else hrInterpretation += ` Dit was een lichte inspanning, geschikt voor warming-up, cooling-down of actief herstel.`;
    } else {
        hrInterpretation += ` Voer je Anaerobe Drempel (AT) in je profiel in voor een gepersonaliseerde interpretatie.`;
    }

    let hrvInterpretation = `Je RMSSD was ${rmssd.toFixed(2)} MS en je SDNN was ${sdnn.toFixed(2)} MS.`;
    if (rmssd >= 50) hrvInterpretation += ` Deze waarden duiden op uitstekend herstel en een gebalanceerd zenuwstelsel. Je bent waarschijnlijk goed uitgerust en klaar voor inspanning.`;
    else if (rmssd >= 25) hrvInterpretation += ` Deze waarden suggereren goed herstel. Je lichaam reageert goed op stress en training.`;
    else if (rmssd >= 10) hrvInterpretation += ` Deze waarden wijzen op redelijk herstel. Mogelijk ervaar je enige vermoeidheid of stress. Overweeg extra rust.`;
    else hrvInterpretation += ` Deze lage waarden kunnen duiden op aanzienlijke vermoeidheid, stress of ziekte. Volledige rust of overleg met een professional kan nodig zijn.`;

    let breathInterpretation = `Je gemiddelde ademhalingsfrequentie was ${avgBreathRate.toFixed(1)} BPM.`;
    if (avgBreathRate >= 8 && avgBreathRate <= 12) breathInterpretation += ` Dit is een optimale frequentie, wat duidt op efficiënte ademhaling en ontspanning.`;
    else if ((avgBreathRate >= 6 && avgBreathRate < 8) || (avgBreathRate > 12 && avgBreathRate <= 15)) breathInterpretation += ` Deze frequentie is acceptabel, maar er is ruimte voor verbetering in ademhalingsefficiëntie.`;
    else if (avgBreathRate > 0) breathInterpretation += ` Deze frequentie is buiten het aanbevolen bereik. Dit kan duiden op stress, angst of onvoldoende ademhalingstechniek.`;
    else breathInterpretation = `Ademhalingsfrequentie data is niet beschikbaar voor deze sessie.`;


    let intensityInterpretation = `Je RPE (Rate of Perceived Exertion) was ${session.rpe || '--'}.`;
    if (userMaxHR > 0 && avgHr > 0) {
        const hrToMaxHr = (avgHr / userMaxHR) * 100;
        intensityInterpretation += ` Dit komt overeen met ${hrToMaxHr.toFixed(0)}% van je maximale hartslag.`;
        if (hrToMaxHr > 90) intensityInterpretation += ` Dit was een maximale inspanning.`;
        else if (hrToMaxHr > 75) intensityInterpretation += ` Dit was een zware training.`;
        else if (hrToMaxHr > 60) intensityInterpretation += ` Dit was een matige training.`;
    } else {
        intensityInterpretation += ` Voer je maximale hartslag in je profiel in voor een nauwkeurigere intensiteitsanalyse.`;
    }

    let poincareExplanation = `De Poincaré Plot visualiseert de variabiliteit tussen opeenvolgende RR-intervallen. Een meer verspreide, komeetachtige vorm duidt op hogere HRV en beter herstel. Een smallere, meer geconcentreerde plot kan wijzen op verminderde variabiliteit.`;
    let frequencyExplanation = `De frequentie-analyse splitst HRV op in verschillende componenten: VLF (zeer lage frequentie), LF (lage frequentie) en HF (hoge frequentie). HF is gerelateerd aan parasympathische activiteit (rust en vertering), LF aan zowel sympathische als parasympathische activiteit, en VLF aan langetermijnregulatie. Een hogere HF-component en een lagere LF/HF-ratio duiden vaak op een betere herstelstatus.`;

    // Biometrische en VO2 Max data en interpretatie
    let biometricsDataHtml = `
        <div>Gewicht: <span class="font-semibold">${userProfile?.userWeight || '--'}</span> kg</div>
        <div>Vetpercentage: <span class="font-semibold">${userProfile?.userFatPercentage || '--'}</span> %</div>
        <div>Spiermassa: <span class="font-semibold">${userProfile?.userMuscleMass || '--'}</span> kg</div>
        <div>BMI: <span class="font-semibold">${userProfile?.userWeight && userProfile?.userHeight ? (userProfile.userWeight / Math.pow(userProfile.userHeight / 100, 2)).toFixed(1) : '--'}</span></div>
    `;
    let biometricsInterpretation = `Je biometrische gegevens tonen de samenstelling van je lichaam. Regelmatige metingen helpen je om veranderingen in gewicht, vet- en spiermassa te volgen en je doelen bij te stellen.`;

    let vo2MaxDataHtml = `
        <div>Vo2 Max: <span class="font-semibold">${userProfile?.userVO2Max || '--'}</span></div>
        <div>3k: <span class="font-semibold">--</span></div>
        <div>5k: <span class="font-semibold">--</span></div>
        <div>10k: <span class="font-semibold">--</span></div>
    `;
    let vo2Interpretation = `VO2 Max is de maximale hoeveelheid zuurstof die je lichaam kan opnemen. Dit is een sterke indicator van je cardiovasculaire fitheid. Een hogere score duidt op een betere conditie.`;

    // Clear and show the detailed report container
    detailedReportContainer.innerHTML = '';
    detailedReportContainer.style.display = 'block';

    // Build the detailed report HTML
    detailedReportContainer.innerHTML = `
        <div class="report-header text-center mb-8">
            <h1 class="text-4xl font-extrabold text-white mb-2">Sessie Rapport</h1>
            <p class="text-xl text-gray-300">Overzicht van je trainingssessie van ${session.date || 'Onbekend'}.</p>
            <button id="backToSessionListBtn" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 mt-4">
                <i class="fas fa-arrow-left mr-2"></i>Terug naar Sessie Overzicht
            </button>
        </div>

        <div class="report-section mb-8">
            <h2 class="text-2xl font-bold text-gray-100 border-b-2 border-purple-500 pb-3 mb-6">Sessie Overzicht</h2>
            <div class="report-content-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                    <div class="card-header mb-2"><h3>Gemiddelde Hartslag</h3></div>
                    <div class="main-value text-white">${avgHr.toFixed(0)} BPM</div>
                </div>
                <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                    <div class="card-header mb-2"><h3>RMSSD (Herstel)</h3></div>
                    <div class="main-value text-white">${rmssd.toFixed(2)} MS</div>
                </div>
                <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                    <div class="card-header mb-2"><h3>Duur</h3></div>
                    <div class="main-value text-white">${formatTime(session.duration)}</div>
                </div>
            </div>
        </div>

        <div class="report-section mb-8">
            <h2 class="text-2xl font-bold text-gray-100 border-b-2 border-purple-500 pb-3 mb-6">HR & RR Grafiek</h2>
            <div class="report-content-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2">
                    <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md" style="height: 300px;">
                        <canvas id="sessionHrRrChart"></canvas>
                    </div>
                </div>
                <div class="flex flex-col gap-6">
                    <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                        <div class="card-header mb-2"><h3>HR Interpretatie</h3></div>
                        <div class="sub-value text-gray-300 text-base leading-relaxed" id="hrInterpretation">${hrInterpretation}</div>
                    </div>
                    <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                        <div class="card-header mb-2"><h3>Intensiteit Interpretatie</h3></div>
                        <div class="sub-value text-gray-300 text-base leading-relaxed" id="intensityInterpretation">${intensityInterpretation}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="report-section mb-8">
            <h2 class="text-2xl font-bold text-gray-100 border-b-2 border-purple-500 pb-3 mb-6">HRV & Ademhaling</h2>
            <div class="report-content-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2">
                    <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md" style="height: 300px;">
                        <canvas id="sessionHrvChart"></canvas>
                    </div>
                    <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md mt-6" style="height: 300px;">
                        <canvas id="sessionBreathChart"></canvas>
                    </div>
                </div>
                <div class="flex flex-col gap-6">
                    <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                        <div class="card-header mb-2"><h3>HRV Interpretatie</h3></div>
                        <div class="sub-value text-gray-300 text-base leading-relaxed" id="hrvInterpretation">${hrvInterpretation}</div>
                    </div>
                    <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                        <div class="card-header mb-2"><h3>Ademhaling Interpretatie</h3></div>
                        <div class="sub-value text-gray-300 text-base leading-relaxed" id="breathInterpretation">${breathInterpretation}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="report-section mb-8">
            <h2 class="text-2xl font-bold text-gray-100 border-b-2 border-purple-500 pb-3 mb-6">Geavanceerde HRV Analyse</h2>
            <div class="report-content-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2">
                     <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md" style="height: 300px;">
                        <canvas id="sessionPoincarePlotChart"></canvas>
                    </div>
                    <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md mt-6" style="height: 300px;">
                        <canvas id="sessionPowerSpectrumChart"></canvas>
                    </div>
                </div>
                <div class="flex flex-col gap-6">
                    <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                        <div class="card-header mb-2"><h3>Poincaré Plot Uitleg</h3></div>
                        <div class="sub-value text-gray-300 text-base leading-relaxed" id="poincareExplanation">${poincareExplanation}</div>
                    </div>
                    <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                        <div class="card-header mb-2"><h3>Frequentie Analyse Uitleg</h3></div>
                        <div class="sub-value text-gray-300 text-base leading-relaxed" id="frequencyExplanation">${frequencyExplanation}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="report-section mb-8">
            <h2 class="text-2xl font-bold text-gray-100 border-b-2 border-purple-500 pb-3 mb-6">Lichaamssamenstelling & VO2 Max</h2>
            <div class="report-content-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2">
                    <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                        <div class="card-header mb-2"><h3>Biometrische Data</h3></div>
                        <div class="grid grid-cols-2 gap-4 text-base text-gray-300">
                            ${biometricsDataHtml}
                        </div>
                    </div>
                    <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md mt-6">
                        <div class="card-header mb-2"><h3>Vo2 Max & Geschatte Hardlooptijden</h3></div>
                        <div class="grid grid-cols-2 gap-4 text-base text-gray-300">
                            ${vo2MaxDataHtml}
                        </div>
                    </div>
                </div>
                <div class="flex flex-col gap-6">
                    <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                        <div class="card-header mb-2"><h3>Biometrie Interpretatie</h3></div>
                        <div class="sub-value text-gray-300 text-base leading-relaxed">${biometricsInterpretation}</div>
                    </div>
                    <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                        <div class="card-header mb-2"><h3>Vo2 Max Interpretatie</h3></div>
                        <div class="sub-value text-gray-300 text-base leading-relaxed">${vo2Interpretation}</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize charts with session-specific data
    if (sessionHrRrChart) sessionHrRrChart.destroy();
    const sessionHrRrChartCtx = document.getElementById('sessionHrRrChart')?.getContext('2d');
    if (sessionHrRrChartCtx) {
        sessionHrRrChart = new Chart(sessionHrRrChartCtx, {
            type: 'line',
            data: {
                labels: session.timestamps || [],
                datasets: [
                    {
                        label: 'Hartslag (BPM)',
                        data: session.rawHrData || [],
                        borderColor: '#f87171',
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y-hr'
                    },
                    {
                        label: 'Ruwe RR Interval (ms)',
                        data: session.rawRrData || [], // Assuming rawRrData holds the actual RR intervals
                        borderColor: 'rgba(167, 139, 250, 0.5)', // Lichter paars voor achtergrond
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: false,
                        yAxisID: 'y-rr',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    'y-hr': {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: false,
                        title: { display: true, text: 'Hartslag' }
                    },
                    'y-rr': {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: false,
                        title: { display: true, text: 'RR Interval (ms)' },
                        grid: { drawOnChartArea: false }
                    }
                },
                plugins: { legend: { display: true } }
            }
        });
    }

    if (sessionHrvChart) sessionHrvChart.destroy();
    const sessionHrvChartCtx = document.getElementById('sessionHrvChart')?.getContext('2d');
    if (sessionHrvChartCtx) {
        sessionHrvChart = new Chart(sessionHrvChartCtx, {
            type: 'bar',
            data: {
                labels: ['RMSSD', 'SDNN', 'pNN50'],
                datasets: [{
                    label: 'HRV Metrics',
                    data: [rmssd, sdnn, pnn50],
                    backgroundColor: ['#4ade80', '#2dd4bf', '#a78bfa'],
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Waarde' } }
                },
                plugins: { legend: { display: true } }
            }
        });
    }

    if (sessionBreathChart) sessionBreathChart.destroy();
    const sessionBreathChartCtx = document.getElementById('sessionBreathChart')?.getContext('2d');
    if (sessionBreathChartCtx) {
        sessionBreathChart = new Chart(sessionBreathChartCtx, {
            type: 'line',
            data: {
                labels: session.timestamps || [],
                datasets: [{
                    label: 'Ademhalingsfrequentie (BPM)',
                    data: session.rawBreathData || [],
                    borderColor: '#3b82f6',
                    tension: 0.4,
                    fill: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'BPM' } }
                },
                plugins: { legend: { display: true } }
            }
        });
    }

    // Poincaré Plot Chart for detailed report
    if (sessionPoincarePlotChart) sessionPoincarePlotChart.destroy();
    const sessionPoincarePlotChartCtx = document.getElementById('sessionPoincarePlotChart')?.getContext('2d');
    if (sessionPoincarePlotChartCtx && hrvAnalyzerForReport && hrvAnalyzerForReport.rrIntervals.length >= 2) {
        const poincareData = [];
        for (let i = 0; i < hrvAnalyzerForReport.rrIntervals.length - 1; i++) {
            poincareData.push({ x: hrvAnalyzerForReport.rrIntervals[i], y: hrvAnalyzerForReport.rrIntervals[i + 1] });
        }
        sessionPoincarePlotChart = new Chart(sessionPoincarePlotChartCtx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Poincaré Plot',
                    data: poincareData,
                    backgroundColor: '#facc15', // Yellow
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'RR(n) (ms)' },
                        min: 400, // Fixed scale for consistency
                        max: 1200 // Fixed scale for consistency
                    },
                    y: {
                        title: { display: true, text: 'RR(n+1) (ms)' },
                        min: 400, // Fixed scale for consistency
                        max: 1200 // Fixed scale for consistency
                    }
                },
                plugins: { legend: { display: true } }
            }
        });
    }

    // Power Spectrum Chart for detailed report
    if (sessionPowerSpectrumChart) sessionPowerSpectrumChart.destroy();
    const sessionPowerSpectrumChartCtx = document.getElementById('sessionPowerSpectrumChart')?.getContext('2d');
    if (sessionPowerSpectrumChartCtx && hrvAnalyzerForReport) {
        const { vlfPower: vlf, lfPower: lf, hfPower: hf } = hrvAnalyzerForReport.frequency;
        const totalPower = vlf + lf + hf;
        const vlfPercentage = totalPower > 0 ? (vlf / totalPower) * 100 : 0;
        const lfPercentage = totalPower > 0 ? (lf / totalPower) * 100 : 0;
        const hfPercentage = totalPower > 0 ? (hf / totalPower) * 100 : 0;

        sessionPowerSpectrumChart = new Chart(sessionPowerSpectrumChartCtx, {
            type: 'bar',
            data: {
                labels: ['VLF', 'LF', 'HF'],
                datasets: [{
                    label: 'Relatieve Kracht',
                    data: [vlfPercentage, lfPercentage, hfPercentage],
                    backgroundColor: ['#c084fc', '#22d3ee', '#f97316'] // Colors for VLF, LF, HF
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Frequentieband' }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Relatieve Kracht (%)' },
                        min: 0,
                        max: 100 // Fixed max for relative power
                    }
                },
                plugins: { legend: { display: true } }
            }
        });
    }

    // Add event listener for the "Back to Session Overview" button
    const backToSessionListBtn = document.getElementById('backToSessionListBtn');
    if (backToSessionListBtn) {
        backToSessionListBtn.addEventListener('click', () => {
            detailedReportContainer.style.display = 'none';
            trainingSessionReportsList.style.display = 'grid'; // Show the session list again
            // Destroy charts when navigating back to prevent memory leaks
            if (sessionHrRrChart) sessionHrRrChart.destroy();
            if (sessionHrvChart) sessionHrvChart.destroy();
            if (sessionBreathChart) sessionBreathChart.destroy();
            if (sessionPoincarePlotChart) sessionPoincarePlotChart.destroy();
            if (sessionPowerSpectrumChart) sessionPowerSpectrumChart.destroy();
        });
    }
}

export async function initTrainingReportsView() {
    console.log("Training Rapporten View geïnitialiseerd.");

    const trainingSessionReportsList = document.getElementById('sessionReportsList');
    const downloadTrainingPdfBtn = document.getElementById('downloadTrainingPdfBtn');
    const detailedTrainingReportContainer = document.getElementById('detailedReportContainer'); // Get the detailed report container

    async function loadTrainingSessionReports() {
        // Fetch sessions from the main 'trainingSessions' store
        const allTrainingSessions = await getAllData('trainingSessions');

        trainingSessionReportsList.innerHTML = ''; // Clear existing list

        if (allTrainingSessions.length === 0) {
            trainingSessionReportsList.innerHTML = '<p class="text-gray-400">Geen trainingsrapporten gevonden.</p>';
            return;
        }

        allTrainingSessions.sort((a, b) => new Date(b.date) - new Date(a.date));

        allTrainingSessions.forEach(session => {
            const rmssdValue = (typeof session.rmssd === 'number' && !isNaN(session.rmssd)) ? session.rmssd.toFixed(2) : '--';
            const reportCard = document.createElement('div');
            reportCard.className = 'data-card bg-gray-700 rounded-lg p-4 shadow-md';
            reportCard.innerHTML = `
                <div class="card-header mb-2"><h3>Training van ${session.date || 'Onbekend'} (${session.type || 'N/A'})</h3></div>
                <div class="sub-value text-gray-300">Duur: ${formatTime(session.duration)}</div>
                <div class="sub-value text-gray-300">Gem. HR: ${session.avgHr || '--'} BPM</div>
                <div class="sub-value text-gray-300">RMSSD: ${rmssdValue} MS</div>
                <div class="flex justify-end mt-4">
                    <button class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 text-sm" data-action="view-detailed-training-report" data-id="${session.id}">Bekijk Rapport</button>
                </div>
            `;
            trainingSessionReportsList.appendChild(reportCard);
        });

        trainingSessionReportsList.querySelectorAll('[data-action="view-detailed-training-report"]').forEach(button => {
            button.addEventListener('click', async (event) => {
                const sessionId = parseInt(event.target.dataset.id);
                const session = allTrainingSessions.find(s => s.id === sessionId);
                if (session) {
                    await displayDetailedTrainingReport(session); // Call the function to display the detailed report
                    trainingSessionReportsList.style.display = 'none'; // Hide the list
                } else {
                    showNotification(`Sessie met ID ${sessionId} niet gevonden.`, "error");
                }
            });
        });
    }

    if (downloadTrainingPdfBtn) {
        if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
            downloadTrainingPdfBtn.disabled = true;
            showNotification("PDF export libraries not loaded. Please check your internet connection or script includes.", "error", 5000);
        } else {
            downloadTrainingPdfBtn.addEventListener('click', async () => {
                showNotification("Rapport wordt voorbereid voor PDF-export...", "info", 3000);
                const a4Container = document.querySelector('.a4-container');
                if (!a4Container) {
                    showNotification("Fout: A4-container niet gevonden.", "error");
                    return;
                }

                // Temporarily ensure the detailed report is visible and the list is hidden for capture
                const originalSessionListDisplay = trainingSessionReportsList.style.display;
                const originalDetailedReportDisplay = detailedTrainingReportContainer.style.display;
                trainingSessionReportsList.style.display = 'none';
                detailedTrainingReportContainer.style.display = 'block'; // Ensure it's visible for capture

                try {
                    // Inject styles for html2canvas
                    const style = document.createElement('style');
                    style.textContent = `
                        /* Add necessary styles for PDF export here, e.g., print styles */
                        body { background-color: #fff; color: #000; }
                        .a4-container { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 20mm; box-shadow: none; border: none; }
                        .report-header h1, .report-section h2 { color: #000; } /* Ensure text is black for print */
                        .data-card { background-color: #f0f0f0; border: 1px solid #ddd; box-shadow: none; }
                        .chart-container-full canvas { background-color: #fff; } /* Ensure chart background is white */
                        /* Hide elements not needed in PDF */
                        .top-nav, .bottom-nav, #downloadTrainingPdfBtn, #backToSessionListBtn { display: none !important; }
                    `;
                    document.head.appendChild(style);

                    // Ensure all charts are rendered before capturing
                    // This is crucial if charts are lazy-loaded or only rendered when their section is active
                    const allCharts = [sessionHrRrChart, sessionHrvChart, sessionBreathChart, sessionPoincarePlotChart, sessionPowerSpectrumChart];
                    allCharts.forEach(chart => chart && chart.update()); // Force update all active charts

                    const canvas = await html2canvas(a4Container, {
                        scale: 2, // Increase scale for better quality
                        useCORS: true,
                        logging: false,
                        onclone: (clonedDoc) => {
                            // Ensure canvas elements in the cloned document have correct dimensions
                            clonedDoc.querySelectorAll('canvas').forEach(canvasEl => {
                                const originalCanvas = document.getElementById(canvasEl.id);
                                if (originalCanvas) {
                                    canvasEl.width = originalCanvas.width;
                                    canvasEl.height = originalCanvas.height;
                                    const ctx = canvasEl.getContext('2d');
                                    if (ctx && originalCanvas.chart) { // Check if it's a Chart.js canvas
                                        originalCanvas.chart.draw(); // Redraw chart on cloned canvas
                                    }
                                }
                            });
                        }
                    });

                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
                    const imgProps = pdf.getImageProperties(imgData);
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    let heightLeft = pdfHeight;
                    let position = 0;

                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                    heightLeft -= pdf.internal.pageSize.getHeight();

                    while (heightLeft >= 0) {
                        position = heightLeft - pdf.internal.pageSize.getHeight();
                        pdf.addPage();
                        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                        heightLeft -= pdf.internal.pageSize.getHeight();
                    }

                    pdf.save(`training_rapport_${new Date().toISOString().split('T')[0]}.pdf`);
                    showNotification("Rapport succesvol geëxporteerd als PDF!", "success");

                } catch (error) {
                    console.error("Fout bij het genereren van de PDF:", error);
                    showNotification("Fout bij het genereren van de PDF. Controleer de console voor details.", "error");
                } finally {
                    // Herstel de oorspronkelijke weergavestijlen
                    trainingSessionReportsList.style.display = originalSessionListDisplay;
                    detailedTrainingReportContainer.style.display = originalDetailedReportDisplay;
                    if (style) {
                        style.remove();
                    }
                }
            });
        }
    }

    // Initial load of training session reports
    await loadTrainingSessionReports();
}
