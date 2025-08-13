// Bestand: js/restReportsView.js
// Bevat logica voor geavanceerde rapportagemogelijkheden en diepgaande analyses voor rustmetingen.

import { getAllData, getData } from '../database.js';
import { showNotification } from './notifications.js';
import { HRVAnalyzer } from './measurement_utils.js'; // Corrected import path

// Globale variabelen om Chart.js instanties bij te houden
let sessionRestHrChart;
let sessionRestRrHistogramChart;
let sessionRestPoincarePlotChart;
let sessionRestPowerSpectrumChart;

// Helper function to format time from seconds to MM:SS
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === null) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// Helper function to determine HR Zone (copied for consistency)
function getHrvBasedRestZone(rmssd) {
    if (rmssd >= 70) return 'Relaxed';
    if (rmssd >= 50) return 'Rest';
    if (rmssd >= 30) return 'Active Low';
    if (rmssd >= 10) return 'Active High';
    return 'Transition to sportzones';
}

// Functie om een gedetailleerd rapport te genereren en weer te geven
async function displayDetailedRestReport(session) {
    const detailedReportContainer = document.getElementById('detailedReportContainer'); // This is from trainingReportsView.html
    const restReportsViewContainer = document.querySelector('.a4-container'); // The main container for restReportsView

    if (!restReportsViewContainer) {
        console.error("Rest reports view container not found.");
        showNotification("Fout: Rapport container niet gevonden.", "error");
        return;
    }

    // Hide the session list and show the detailed report content
    const restSessionReportsList = document.getElementById('restSessionReportsList');
    if (restSessionReportsList) restSessionReportsList.style.display = 'none';

    // Haal gebruikersprofiel op voor context
    const userId = session.userId;
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

    let hrvAnalyzerForReport = null;
    if (session.rawRrData && session.rawRrData.length >= 30) {
        try {
            hrvAnalyzerForReport = new HRVAnalyzer(session.rawRrData);
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
    let rmssdExplanation = `Je RMSSD was ${rmssd.toFixed(2)} MS. RMSSD reflecteert de variabiliteit tussen opeenvolgende hartslagen, wat primair duidt op de activiteit van het parasympathische zenuwstelsel. Hogere waarden suggereren over het algemeen beter herstel en paraatheid.`;
    if (rmssd >= 50) rmssdExplanation += ` Deze waarde duidt op uitstekend herstel en een gebalanceerd zenuwstelsel. Je bent waarschijnlijk goed uitgerust en klaar voor inspanning.`;
    else if (rmssd >= 25) rmssdExplanation += ` Deze waarde suggereert goed herstel. Je lichaam reageert goed op stress en training.`;
    else if (rmssd >= 10) rmssdExplanation += ` Deze waarde wijst op redelijk herstel. Mogelijk ervaar je enige vermoeidheid of stress. Overweeg extra rust.`;
    else if (rmssd > 0) rmssdExplanation += ` Deze lage waarde kan duiden op aanzienlijke vermoeidheid, stress of ziekte. Volledige rust of overleg met een professional kan nodig zijn.`;

    let sdnnExplanation = `Je SDNN was ${sdnn.toFixed(2)} MS. SDNN vertegenwoordigt de algehele variabiliteit van de hartslag over een periode. Het weerspiegelt zowel sympathische als parasympathische zenuwstelselactiviteit.`;
    if (sdnn >= 100) sdnnExplanation += ` Zeer hoge algehele HRV, wat duidt op uitstekende aanpassingsvermogen en veerkracht.`;
    else if (sdnn >= 50) sdnnExplanation += ` Goede algehele HRV, wat duidt op een gezond en aanpasbaar cardiovasculair systeem.`;
    else if (sdnn > 0) sdnnExplanation += ` Lagere algehele HRV, wat een teken kan zijn van chronische stress, overtraining of onderliggende gezondheidsproblemen.`;

    let breathExplanation = `Je gemiddelde ademhalingsfrequentie was ${avgBreathRate.toFixed(1)} BPM.`;
    if (avgBreathRate >= 8 && avgBreathRate <= 12) breathExplanation += ` Dit is een optimale frequentie, wat duidt op efficiënte ademhaling en ontspanning.`;
    else if ((avgBreathRate >= 6 && avgBreathRate < 8) || (avgBreathRate > 12 && avgBreathRate <= 15)) breathExplanation += ` Deze frequentie is acceptabel, maar er is ruimte voor verbetering in ademhalingsefficiëntie.`;
    else if (avgBreathRate > 0) breathExplanation += ` Deze frequentie is buiten het aanbevolen bereik. Dit kan duiden op stress, angst of onvoldoende ademhalingstechniek.`;
    else breathExplanation = `Ademhalingsfrequentie data is niet beschikbaar voor deze sessie.`;

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

    // Update the main container's content with the detailed report structure
    restReportsViewContainer.innerHTML = `
        <div class="report-header text-center mb-8">
            <h1 class="text-4xl font-extrabold text-white mb-2">Rustmeting Rapport</h1>
            <p class="text-xl text-gray-300">Gedetailleerd overzicht van je rustmeting van ${session.date || 'Onbekend'}.</p>
            <button id="backToRestSessionListBtn" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 mt-4">
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
            <h2 class="text-2xl font-bold text-gray-100 border-b-2 border-purple-500 pb-3 mb-6">HRV & Ademhaling</h2>
            <div class="report-content-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2">
                    <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md" style="height: 300px;">
                        <canvas id="sessionRestHrChart"></canvas>
                    </div>
                    <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md mt-6" style="height: 300px;">
                        <canvas id="sessionRestRrHistogramChart"></canvas>
                    </div>
                </div>
                <div class="flex flex-col gap-6">
                    <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                        <div class="card-header mb-2"><h3>RMSSD Uitleg</h3></div>
                        <div class="sub-value text-gray-300 text-base leading-relaxed" id="rmssdExplanation">${rmssdExplanation}</div>
                    </div>
                    <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                        <div class="card-header mb-2"><h3>SDNN Uitleg</h3></div>
                        <div class="sub-value text-gray-300 text-base leading-relaxed" id="sdnnExplanation">${sdnnExplanation}</div>
                    </div>
                    <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                        <div class="card-header mb-2"><h3>Ademhaling Uitleg</h3></div>
                        <div class="sub-value text-gray-300 text-base leading-relaxed" id="breathExplanation">${breathExplanation}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="report-section mb-8">
            <h2 class="text-2xl font-bold text-gray-100 border-b-2 border-purple-500 pb-3 mb-6">Geavanceerde HRV Analyse</h2>
            <div class="report-content-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2">
                     <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md" style="height: 300px;">
                        <canvas id="sessionRestPoincarePlotChart"></canvas>
                    </div>
                    <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md mt-6" style="height: 300px;">
                        <canvas id="sessionRestPowerSpectrumChart"></canvas>
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
        
        <div class="flex justify-center mt-10">
            <button id="downloadRestPdfBtn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition-colors duration-200 text-lg shadow-lg">
                <i class="fas fa-file-pdf mr-3"></i>Rustrapport Downloaden als PDF
            </button>
        </div>
    `;

    // Initialize charts with session-specific data
    if (sessionRestHrChart) sessionRestHrChart.destroy();
    const sessionRestHrChartCtx = document.getElementById('sessionRestHrChart')?.getContext('2d');
    if (sessionRestHrChartCtx) {
        sessionRestHrChart = new Chart(sessionRestHrChartCtx, {
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
                        data: session.rawRrData || [],
                        borderColor: 'rgba(167, 139, 250, 0.5)',
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

    if (sessionRestRrHistogramChart) sessionRestRrHistogramChart.destroy();
    const sessionRestRrHistogramChartCtx = document.getElementById('sessionRestRrHistogramChart')?.getContext('2d');
    if (sessionRestRrHistogramChartCtx && hrvAnalyzerForReport && hrvAnalyzerForReport.rrIntervals.length >= 2) {
        const bins = {};
        hrvAnalyzerForReport.rrIntervals.forEach(rr => {
            const bin = Math.floor(rr / 10) * 10;
            bins[bin] = (bins[bin] || 0) + 1;
        });
        const sortedBins = Object.keys(bins).sort((a, b) => parseInt(a) - parseInt(b));
        sessionRestRrHistogramChart = new Chart(sessionRestRrHistogramChartCtx, {
            type: 'bar',
            data: {
                labels: sortedBins.map(bin => `${bin}-${parseInt(bin) + 9}`),
                datasets: [{
                    label: 'Frequentie',
                    data: sortedBins.map(bin => bins[bin]),
                    backgroundColor: '#4ade80',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'RR Interval (ms)' }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Aantal' },
                        min: 0,
                        max: 50
                    }
                },
                plugins: { legend: { display: true } }
            }
        });
    }

    // Poincaré Plot Chart for detailed report
    if (sessionRestPoincarePlotChart) sessionRestPoincarePlotChart.destroy();
    const sessionRestPoincarePlotChartCtx = document.getElementById('sessionRestPoincarePlotChart')?.getContext('2d');
    if (sessionRestPoincarePlotChartCtx && hrvAnalyzerForReport && hrvAnalyzerForReport.rrIntervals.length >= 2) {
        const poincareData = [];
        for (let i = 0; i < hrvAnalyzerForReport.rrIntervals.length - 1; i++) {
            poincareData.push({ x: hrvAnalyzerForReport.rrIntervals[i], y: hrvAnalyzerForReport.rrIntervals[i + 1] });
        }
        sessionRestPoincarePlotChart = new Chart(sessionRestPoincarePlotChartCtx, {
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
                        min: 400,
                        max: 1200
                    },
                    y: {
                        title: { display: true, text: 'RR(n+1) (ms)' },
                        min: 400,
                        max: 1200
                    }
                },
                plugins: { legend: { display: true } }
            }
        });
    }

    // Power Spectrum Chart for detailed report
    if (sessionRestPowerSpectrumChart) sessionRestPowerSpectrumChart.destroy();
    const sessionRestPowerSpectrumChartCtx = document.getElementById('sessionRestPowerSpectrumChart')?.getContext('2d');
    if (sessionRestPowerSpectrumChartCtx && hrvAnalyzerForReport) {
        const { vlfPower: vlf, lfPower: lf, hfPower: hf } = hrvAnalyzerForReport.frequency;
        const totalPower = vlf + lf + hf;
        const vlfPercentage = totalPower > 0 ? (vlf / totalPower) * 100 : 0;
        const lfPercentage = totalPower > 0 ? (lf / totalPower) * 100 : 0;
        const hfPercentage = totalPower > 0 ? (hf / totalPower) * 100 : 0;

        sessionRestPowerSpectrumChart = new Chart(sessionRestPowerSpectrumChartCtx, {
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
    const backToRestSessionListBtn = document.getElementById('backToRestSessionListBtn');
    if (backToRestSessionListBtn) {
        backToRestSessionListBtn.addEventListener('click', () => {
            // Restore original content of restReportsViewContainer
            restReportsViewContainer.innerHTML = `
                <div class="report-header text-center mb-8">
                    <h1 class="text-4xl font-extrabold text-white mb-2">Rustmeting Rapport</h1>
                    <p class="text-xl text-gray-300">Gedetailleerd overzicht van uw rustmetingen.</p>
                </div>

                <div class="report-section mb-8">
                    <h2 class="text-2xl font-bold text-gray-100 border-b-2 border-purple-500 pb-3 mb-6">Overzicht Sessies</h2>
                    <div id="restSessionReportsList" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <!-- Rustmeting sessierapporten worden hier dynamisch geladen -->
                    </div>
                </div>

                <div class="report-section mb-8">
                    <h2 class="text-2xl font-bold text-gray-100 border-b-2 border-purple-500 pb-3 mb-6">HRV & Ademhaling Trends</h2>
                    <div class="report-content-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="lg:col-span-2">
                            <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md" style="height: 300px;">
                                <canvas id="restHrChart"></canvas>
                            </div>
                            <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md mt-6" style="height: 300px;">
                                <canvas id="restRrHistogramChart"></canvas>
                            </div>
                        </div>
                        <div class="flex flex-col gap-6">
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>RMSSD Uitleg</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="rmssdExplanation"></div>
                            </div>
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>SDNN Uitleg</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="sdnnExplanation"></div>
                            </div>
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>Ademhaling Uitleg</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="breathExplanation"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="report-section mb-8">
                    <h2 class="text-2xl font-bold text-gray-100 border-b-2 border-purple-500 pb-3 mb-6">Geavanceerde HRV Analyse</h2>
                    <div class="report-content-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="lg:col-span-2">
                            <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md" style="height: 300px;">
                                <canvas id="restPoincarePlotChart"></canvas>
                            </div>
                            <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md mt-6" style="height: 300px;">
                                <canvas id="restPowerSpectrumChart"></canvas>
                            </div>
                        </div>
                        <div class="flex flex-col gap-6">
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>Poincaré Plot Uitleg</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="poincareExplanation"></div>
                            </div>
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>Frequentie Analyse Uitleg</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="frequencyExplanation"></div>
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
                                    <div>Gewicht: <span id="restReportWeight" class="font-semibold">--</span> kg</div>
                                    <div>Vetpercentage: <span id="restReportFat" class="font-semibold">--</span> %</div>
                                    <div>Spiermassa: <span id="restReportMuscle" class="font-semibold">--</span> kg</div>
                                    <div>BMI: <span id="restReportBMI" class="font-semibold">--</span></div>
                                </div>
                            </div>
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md mt-6">
                                <div class="card-header mb-2"><h3>Vo2 Max & Geschatte Hardlooptijden</h3></div>
                                <div class="grid grid-cols-2 gap-4 text-base text-gray-300">
                                    <div>Vo2 Max: <span id="restReportVo2Max" class="font-semibold">--</span></div>
                                    <div>3k: <span id="restReport3k" class="font-semibold">--</span></div>
                                    <div>5k: <span id="restReport5k" class="font-semibold">--</span></div>
                                    <div>10k: <span id="restReport10k" class="font-semibold">--</span></div>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-col gap-6">
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>Biometrie Interpretatie</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="restBiometricsInterpretation"></div>
                            </div>
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>Vo2 Max Interpretatie</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="restVo2Interpretation"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-center mt-10">
                    <button id="downloadRestPdfBtn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition-colors duration-200 text-lg shadow-lg">
                        <i class="fas fa-file-pdf mr-3"></i>Rustrapport Downloaden als PDF
                    </button>
                </div>
            `;
            loadRestSessionReports(); // Reload the session list and initial charts
            // Destroy charts when navigating back to prevent memory leaks
            if (sessionRestHrChart) sessionRestHrChart.destroy();
            if (sessionRestRrHistogramChart) sessionRestRrHistogramChart.destroy();
            if (sessionRestPoincarePlotChart) sessionRestPoincarePlotChart.destroy();
            if (sessionRestPowerSpectrumChart) sessionRestPowerSpectrumChart.destroy();
        });
    }
}

export async function initRestReportsView() {
    console.log("Rust Rapporten View geïnitialiseerd.");

    const restSessionReportsList = document.getElementById('restSessionReportsList');
    const downloadRestPdfBtn = document.getElementById('downloadRestPdfBtn');
    const restReportsViewContainer = document.querySelector('.a4-container'); // The main container

    async function loadRestSessionReports() {
        const freeSessions = await getAllData('restSessionsFree');
        const advancedSessions = await getAllData('restSessionsAdvanced');

        // Combine and deduplicate sessions based on date or a unique ID if available
        const allRestSessionsMap = new Map();
        freeSessions.forEach(session => allRestSessionsMap.set(session.id, { ...session, source: 'free' })); // Use ID for uniqueness
        advancedSessions.forEach(session => allRestSessionsMap.set(session.id, { ...allRestSessionsMap.get(session.id), ...session, source: 'advanced' }));

        const allRestSessions = Array.from(allRestSessionsMap.values());

        // Re-inject the initial HTML structure if it was replaced by a detailed report
        if (restReportsViewContainer.innerHTML.includes('<button id="backToRestSessionListBtn"')) {
             restReportsViewContainer.innerHTML = `
                <div class="report-header text-center mb-8">
                    <h1 class="text-4xl font-extrabold text-white mb-2">Rustmeting Rapport</h1>
                    <p class="text-xl text-gray-300">Gedetailleerd overzicht van uw rustmetingen.</p>
                </div>

                <div class="report-section mb-8">
                    <h2 class="text-2xl font-bold text-gray-100 border-b-2 border-purple-500 pb-3 mb-6">Overzicht Sessies</h2>
                    <div id="restSessionReportsList" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <!-- Rustmeting sessierapporten worden hier dynamisch geladen -->
                    </div>
                </div>

                <div class="report-section mb-8">
                    <h2 class="text-2xl font-bold text-gray-100 border-b-2 border-purple-500 pb-3 mb-6">HRV & Ademhaling Trends</h2>
                    <div class="report-content-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="lg:col-span-2">
                            <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md" style="height: 300px;">
                                <canvas id="restHrChart"></canvas>
                            </div>
                            <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md mt-6" style="height: 300px;">
                                <canvas id="restRrHistogramChart"></canvas>
                            </div>
                        </div>
                        <div class="flex flex-col gap-6">
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>RMSSD Uitleg</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="rmssdExplanation"></div>
                            </div>
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>SDNN Uitleg</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="sdnnExplanation"></div>
                            </div>
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>Ademhaling Uitleg</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="breathExplanation"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="report-section mb-8">
                    <h2 class="text-2xl font-bold text-gray-100 border-b-2 border-purple-500 pb-3 mb-6">Geavanceerde HRV Analyse</h2>
                    <div class="report-content-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="lg:col-span-2">
                            <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md" style="height: 300px;">
                                <canvas id="restPoincarePlotChart"></canvas>
                            </div>
                            <div class="chart-container-full bg-gray-700 rounded-lg p-4 shadow-md mt-6" style="height: 300px;">
                                <canvas id="restPowerSpectrumChart"></canvas>
                            </div>
                        </div>
                        <div class="flex flex-col gap-6">
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>Poincaré Plot Uitleg</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="poincareExplanation"></div>
                            </div>
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>Frequentie Analyse Uitleg</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="frequencyExplanation"></div>
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
                                    <div>Gewicht: <span id="restReportWeight" class="font-semibold">--</span> kg</div>
                                    <div>Vetpercentage: <span id="restReportFat" class="font-semibold">--</span> %</div>
                                    <div>Spiermassa: <span id="restReportMuscle" class="font-semibold">--</span> kg</div>
                                    <div>BMI: <span id="restReportBMI" class="font-semibold">--</span></div>
                                </div>
                            </div>
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md mt-6">
                                <div class="card-header mb-2"><h3>Vo2 Max & Geschatte Hardlooptijden</h3></div>
                                <div class="grid grid-cols-2 gap-4 text-base text-gray-300">
                                    <div>Vo2 Max: <span id="restReportVo2Max" class="font-semibold">--</span></div>
                                    <div>3k: <span id="restReport3k" class="font-semibold">--</span></div>
                                    <div>5k: <span id="rest5k" class="font-semibold">--</span></div>
                                    <div>10k: <span id="rest10k" class="font-semibold">--</span></div>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-col gap-6">
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>Biometrie Interpretatie</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="restBiometricsInterpretation"></div>
                            </div>
                            <div class="data-card bg-gray-700 rounded-lg p-4 shadow-md">
                                <div class="card-header mb-2"><h3>Vo2 Max Interpretatie</h3></div>
                                <div class="sub-value text-gray-300 text-base leading-relaxed" id="restVo2Interpretation"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-center mt-10">
                    <button id="downloadRestPdfBtn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition-colors duration-200 text-lg shadow-lg">
                        <i class="fas fa-file-pdf mr-3"></i>Rustrapport Downloaden als PDF
                    </button>
                </div>
            `;
        }

        const currentRestSessionReportsList = document.getElementById('restSessionReportsList'); // Get the element again after potential re-injection
        if (!currentRestSessionReportsList) {
            console.error("restSessionReportsList not found after re-injection. Cannot load sessions.");
            return;
        }
        currentRestSessionReportsList.innerHTML = '';

        if (allRestSessions.length === 0) {
            currentRestSessionReportsList.innerHTML = '<p class="text-gray-400">Geen rustmeting rapporten gevonden.</p>';
            return;
        }

        allRestSessions.sort((a, b) => new Date(b.date) - new Date(a.date));

        allRestSessions.forEach(session => {
            const rmssdValue = (typeof session.rmssd === 'number' && !isNaN(session.rmssd)) ? session.rmssd.toFixed(2) : '--';
            const reportCard = document.createElement('div');
            reportCard.className = 'data-card bg-gray-700 rounded-lg p-4 shadow-md';
            reportCard.innerHTML = `
                <div class="card-header mb-2"><h3>Rustmeting van ${session.date || 'Onbekend'} (${session.type || 'N/A'})</h3></div>
                <div class="sub-value text-gray-300">Duur: ${formatTime(session.duration)}</div>
                <div class="sub-value text-gray-300">Gem. HR: ${session.avgHr || '--'} BPM</div>
                <div class="sub-value text-gray-300">RMSSD: ${rmssdValue} MS</div>
                <div class="flex justify-end mt-4">
                    <button class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 text-sm" data-action="view-detailed-rest-report" data-id="${session.id}">Bekijk Rapport</button>
                </div>
            `;
            currentRestSessionReportsList.appendChild(reportCard);
        });

        // Re-attach event listeners for "Bekijk Rapport" buttons
        currentRestSessionReportsList.querySelectorAll('[data-action="view-detailed-rest-report"]').forEach(button => {
            button.addEventListener('click', async (event) => {
                const sessionId = parseInt(event.target.dataset.id);
                const session = allRestSessions.find(s => s.id === sessionId);
                if (session) {
                    await displayDetailedRestReport(session); // Call the function to display the detailed report
                } else {
                    showNotification(`Sessie met ID ${sessionId} niet gevonden.`, "error");
                }
            });
        });
    }

    // Initial load of rest session reports
    await loadRestSessionReports();

    // Event listener for the main "Download Rustrapport als PDF" button
    const currentDownloadRestPdfBtn = document.getElementById('downloadRestPdfBtn');
    if (currentDownloadRestPdfBtn) {
        if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
            currentDownloadRestPdfBtn.disabled = true;
            showNotification("PDF export libraries not loaded. Please check your internet connection or script includes.", "error", 5000);
        } else {
            currentDownloadRestPdfBtn.addEventListener('click', async () => {
                showNotification("Rapport wordt voorbereid voor PDF-export...", "info", 3000);
                const a4Container = document.querySelector('.a4-container');
                if (!a4Container) {
                    showNotification("Fout: A4-container niet gevonden.", "error");
                    return;
                }

                // Temporarily ensure the detailed report is visible and the list is hidden for capture
                // For the main download button, we'll try to capture the *current* state.
                // If a detailed report is showing, it will capture that. If the list is showing, it will capture that.
                // For a full report, we might need to generate a combined view or iterate through all sessions.
                // For now, let's assume it captures what's currently displayed in the a4-container.

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
                        .top-nav, .bottom-nav, #downloadRestPdfBtn, #backToRestSessionListBtn { display: none !important; }
                    `;
                    document.head.appendChild(style);

                    // Ensure all charts are rendered before capturing
                    // This is crucial if charts are lazy-loaded or only rendered when their section is active
                    const allCharts = [sessionRestHrChart, sessionRestRrHistogramChart, sessionRestPoincarePlotChart, sessionRestPowerSpectrumChart];
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

                    pdf.save(`rust_rapport_${new Date().toISOString().split('T')[0]}.pdf`);
                    showNotification("Rustrapport succesvol geëxporteerd als PDF!", "success");

                } catch (error) {
                    console.error("Fout bij het genereren van de PDF:", error);
                    showNotification("Fout bij het genereren van de PDF. Controleer de console voor details.", "error");
                } finally {
                    if (style) {
                        style.remove();
                    }
                }
            });
        }
    }
}
