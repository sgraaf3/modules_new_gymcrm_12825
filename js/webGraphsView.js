// Bestand: js/views/webGraphsView.js
// Bevat logica voor het weergeven van gedetailleerde grafieken op de webGraphsView.

let currentDetailedChart; // Houd de huidige grafiek instantie bij

/**
 * Initialiseert en toont een gedetailleerde grafiek op basis van het opgegeven type.
 * Deze functie wordt aangeroepen wanneer de 'webGraphsView' wordt geladen.
 * @param {object} data Een object dat het type grafiek bevat, bijv. { graphType: 'hr' }.
 */
export function showDetailedGraph(data) {
    console.log("Gedetailleerde Grafiek View geïnitialiseerd voor type:", data?.graphType);

    const detailedGraphChartCtx = document.getElementById('detailedGraphChart')?.getContext('2d');
    const webGraphsTitle = document.getElementById('webGraphsTitle');

    if (!detailedGraphChartCtx) {
        console.error("Canvas element voor gedetailleerde grafiek niet gevonden.");
        return;
    }

    // Vernietig de vorige grafiek instantie om geheugenlekkage te voorkomen
    if (currentDetailedChart) {
        currentDetailedChart.destroy();
    }

    let chartData = {};
    let title = '';
    const graphType = data?.graphType; // Haal graphType uit het doorgegeven data object

    switch (graphType) {
        case 'hr':
            title = 'Hartslag (HR) Progressie';
            chartData = {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Gemiddelde HR',
                    data: [70, 68, 65, 67, 64, 62],
                    borderColor: '#60a5fa',
                    tension: 0.4,
                    fill: false
                }]
            };
            break;
        case 'hrv':
            title = 'HRV Progressie';
            chartData = {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'RMSSD',
                    data: [40, 45, 42, 48, 46, 50],
                    borderColor: '#4ade80',
                    tension: 0.4,
                    fill: false
                }]
            };
            break;
        case 'biometrics':
            title = 'Biometrie Progressie';
            chartData = {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [
                    {
                        label: 'Gewicht (kg)',
                        data: [75, 74, 73, 72, 71, 70],
                        borderColor: '#c084fc',
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: 'Vet % ',
                        data: [20, 19.5, 19, 18.5, 18, 17.5],
                        borderColor: '#facc15',
                        tension: 0.4,
                        fill: false
                    }
                ]
            };
            break;
        case 'ratios':
            title = 'Verhoudingen Progressie';
            chartData = {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Taille-Heup Ratio',
                    data: [0.85, 0.84, 0.83, 0.82, 0.81, 0.80],
                    borderColor: '#fb923c',
                    tension: 0.4,
                    fill: false
                }]
            };
            break;
        case 'cardiovascular':
            title = 'Cardiovasculaire Progressie';
            chartData = {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'VO2 Max',
                    data: [45, 46, 47, 48, 49, 50],
                    borderColor: '#ef4444',
                    tension: 0.4,
                    fill: false
                }]
            };
            break;
        case 'strength':
            title = 'Kracht Progressie';
            chartData = {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Max Deadlift (kg)',
                    data: [100, 105, 110, 115, 120, 125],
                    borderColor: '#f97316',
                    tension: 0.4,
                    fill: false
                }]
            };
            break;
        case 'coordination':
            title = 'Coördinatie Progressie';
            chartData = {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Balans Score',
                    data: [70, 72, 75, 78, 80, 82],
                    borderColor: '#22d3ee',
                    tension: 0.4,
                    fill: false
                }]
            };
            break;
        case 'flexibility':
            title = 'Flexibiliteit Progressie';
            chartData = {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Sit-and-Reach (cm)',
                    data: [30, 32, 35, 37, 39, 40],
                    borderColor: '#f472b6',
                    tension: 0.4,
                    fill: false
                }]
            };
            break;
        default:
            title = 'Gedetailleerde Grafieken';
            chartData = {
                labels: [],
                datasets: []
            };
            console.warn("Onbekend grafiektype:", graphType);
    }

    if (webGraphsTitle) {
        webGraphsTitle.textContent = title;
    }
    
    currentDetailedChart = new Chart(detailedGraphChartCtx, {
        type: 'line',
        data: chartData,
        options: { responsive: true, maintainAspectRatio: false }
    });
}
