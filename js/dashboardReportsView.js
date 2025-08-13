import { loadPerformanceOverview, updateExplanationsAndInterpretations, generateDashboardReportPdf } from './dashboardReports.js';
import { initSleepTrendChart, initSportActivitiesTrendChart } from './reports/afterReports.js';
import { initIndividualHrChart, initIndividualHrvChart, initBreathRateChart } from './reports/regularReports.js';
import { getOrCreateUserId } from '../database.js';

export async function initDashboardReportsView() {
    console.log("Dashboard Rapporten View geïnitialiseerd.");

    // Roep alle laadfuncties aan bij initialisatie
    await loadPerformanceOverview();
    await updateExplanationsAndInterpretations(getOrCreateUserId());
    await initIndividualHrChart();
    await initIndividualHrvChart();
    await initBreathRateChart();
    await initSleepTrendChart(); // Ensure sleep data is processed
    await initSportActivitiesTrendChart(); // Ensure sport activities data is processed

    const downloadDashboardPdfBtn = document.getElementById('downloadDashboardPdfBtn');
    if (downloadDashboardPdfBtn) {
        downloadDashboardPdfBtn.addEventListener('click', async () => {
            await generateDashboardReportPdf();
        });
    }
}