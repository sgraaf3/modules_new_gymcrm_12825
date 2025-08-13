import { getAllData, getData, getOrCreateUserId } from '../database.js';

// Helper function to get data from the last month
function filterDataLastMonth(data, dateField) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return data.filter(item => {
        const itemDate = new Date(item[dateField]);
        return itemDate >= oneMonthAgo && !isNaN(itemDate.getTime());
    });
}

export async function loadPerformanceOverview() {
    const trainingSessions = await getAllData('trainingSessions');
    const userProfiles = await getAllData('userProfile');

    const totalDuration = trainingSessions.reduce((sum, session) => sum + (parseFloat(session.duration) || 0), 0);
    const avgDuration = trainingSessions.length > 0 ? (totalDuration / trainingSessions.length).toFixed(0) : '--';
    if (document.getElementById('avgTrainingDuration')) document.getElementById('avgTrainingDuration').textContent = `${avgDuration} min`;

    const totalRestHr = userProfiles.reduce((sum, profile) => sum + (parseFloat(profile.userRestHR) || 0), 0);
    const avgRestHr = userProfiles.length > 0 ? (totalRestHr / userProfiles.length).toFixed(0) : '--';
    if (document.getElementById('avgRestHr')) document.getElementById('avgRestHr').textContent = `${avgRestHr} BPM`;

    const totalCalories = trainingSessions.reduce((sum, session) => sum + (parseFloat(session.caloriesBurned || 0)), 0);
    if (document.getElementById('totalCaloriesBurned')) document.getElementById('totalCaloriesBurned').textContent = `${totalCalories.toFixed(0)} kcal`;
}

export async function updateExplanationsAndInterpretations() {
    const userId = getOrCreateUserId(); // Ensure userId is obtained here
    const userProfile = await getData('userProfile', userId);
    const trainingSessions = await getAllData('trainingSessions');
    const sleepData = await getAllData('sleepData');
    const sportData = await getAllData('sportData');

    if (!userProfile) return;

    const filteredTrainingSessions = filterDataLastMonth(trainingSessions, 'date');
    const filteredSleepData = filterDataLastMonth(sleepData, 'date');
    const filteredSportData = filterDataLastMonth(sportData, 'sportDate');

    // HR & HRV Explanations
    const avgHr = filteredTrainingSessions.length > 0 ? (filteredTrainingSessions.reduce((sum, s) => sum + (parseFloat(s.avgHr) || 0), 0) / filteredTrainingSessions.length).toFixed(0) : '--';
    const avgRmssd = filteredTrainingSessions.length > 0 ? (filteredTrainingSessions.reduce((sum, s) => sum + (parseFloat(s.rmssd) || 0), 0) / filteredTrainingSessions.length).toFixed(2) : '--';

    const hrExplanation = document.getElementById('hrExplanation');
    const hrvExplanation = document.getElementById('hrvExplanation');
    const breathExplanation = document.getElementById('breathExplanation');
    const intensityExplanation = document.getElementById('intensityExplanation');

    if (hrExplanation) hrExplanation.textContent = `Je gemiddelde hartslag over de afgelopen maand was ${avgHr} BPM. Een consistente hartslag bij vergelijkbare inspanning duidt op een stabiele conditie.`;
    if (hrvExplanation) hrvExplanation.textContent = `Je gemiddelde RMSSD over de afgelopen maand was ${avgRmssd} MS. Een hogere RMSSD waarde duidt op een beter herstel en een lagere belasting van je zenuwstelsel.`;
    if (breathExplanation) breathExplanation.textContent = `Een consistente ademhalingsfrequentie van 8-12 ademhalingen per minuut is optimaal voor rust en herstel. De Ti/Te ratio (Inhale/Exhale) geeft inzicht in de efficiëntie van je ademhaling.`;
    if (intensityExplanation) intensityExplanation.textContent = `RPE (Rate of Perceived Exertion) is een subjectieve score die je inspanning meet van 0 tot 10. De HR-verhoudingen geven aan hoe hard je lichaam werkt ten opzichte van je persoonlijke drempels.`;

    // Biometrics and Vo2Max Interpretations
    const latestProfile = userProfile; // OPMERKING: Momenteel hebben we alleen de laatste profieldata
    const reportWeight = document.getElementById('reportWeight');
    const reportFat = document.getElementById('reportFat');
    const reportMuscle = document.getElementById('reportMuscle');
    const reportBMI = document.getElementById('reportBMI');
    const reportVo2Max = document.getElementById('reportVo2Max');
    const report3k = document.getElementById('report3k');
    const report5k = document.getElementById('report5k');
    const report10k = document.getElementById('report10k');
    const biometricsInterpretation = document.getElementById('biometricsInterpretation');
    const vo2Interpretation = document.getElementById('vo2Interpretation');

    if (latestProfile.userWeight) reportWeight.textContent = `${latestProfile.userWeight} kg`;
    if (latestProfile.userFatPercentage) reportFat.textContent = `${latestProfile.userFatPercentage} %`;
    if (latestProfile.userMuscleMass) reportMuscle.textContent = `${latestProfile.userMuscleMass} kg`;
    
    if (latestProfile.userWeight && latestProfile.userHeight) {
        const bmi = latestProfile.userWeight / Math.pow(latestProfile.userHeight / 100, 2);
        reportBMI.textContent = bmi.toFixed(1);
    }

    if (latestProfile.userVO2Max) reportVo2Max.textContent = latestProfile.userVO2Max;

    // OPMERKING: Voor runtimes hebben we een volledige VO2-berekening nodig die hier niet is geïmplementeerd.
    // We tonen placeholders totdat die functionaliteit beschikbaar is.
    report3k.textContent = '--';
    report5k.textContent = '--';
    report10k.textContent = '--';

    if (biometricsInterpretation) biometricsInterpretation.textContent = `Je biometrische gegevens tonen de samenstelling van je lichaam. Regelmatige metingen helpen je om veranderingen in gewicht, vet- en spiermassa te volgen en je doelen bij te stellen.`;
    if (vo2Interpretation) vo2Interpretation.textContent = `VO2 Max is de maximale hoeveelheid zuurstof die je lichaam kan opnemen. Dit is een sterke indicator van je cardiovasculaire fitheid. Een hogere score duidt op een betere conditie.`;

    // Sleep Data Interpretation
    const avgSleepScore = filteredSleepData.length > 0 ? (filteredSleepData.reduce((sum, s) => sum + (parseFloat(s.score) || 0), 0) / filteredSleepData.length).toFixed(1) : '--';
    const avgSleepDuration = filteredSleepData.length > 0 ? (filteredSleepData.reduce((sum, s) => sum + (parseFloat(s.duration) || 0), 0) / filteredSleepData.length).toFixed(0) : '--';
    
    const sleepExplanationElement = document.getElementById('sleepExplanation');
    if (sleepExplanationElement) sleepExplanationElement.textContent = `Je gemiddelde slaapscore over de afgelopen maand was ${avgSleepScore} met een gemiddelde duur van ${avgSleepDuration} uur. Voldoende en kwalitatieve slaap is cruciaal voor herstel en prestatie.`;

    // Sport Activities Interpretation
    const totalSportDuration = filteredSportData.length > 0 ? (filteredSportData.reduce((sum, s) => sum + (parseFloat(s.sportDuration) || 0), 0)).toFixed(0) : '--';
    const numberOfActivities = filteredSportData.length;

    const sportActivitiesExplanationElement = document.getElementById('sportActivitiesExplanation');
    if (sportActivitiesExplanationElement) sportActivitiesExplanationElement.textContent = `Je hebt de afgelopen maand ${numberOfActivities} sportactiviteiten geregistreerd met een totale duur van ${totalSportDuration} minuten. Consistentie in training is essentieel voor vooruitgang.`;
}

export async function generateDashboardReportPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let yPos = 10;

    // Fetch all data needed for the report
    const userId = getOrCreateUserId();
    const userProfile = await getData('userProfile', userId);
    const trainingSessions = await getAllData('trainingSessions');
    const sleepData = await getAllData('sleepData');
    const sportData = await getAllData('sportData');

    const filteredTrainingSessions = filterDataLastMonth(trainingSessions, 'date');
    const filteredSleepData = filterDataLastMonth(sleepData, 'date');
    const filteredSportData = filterDataLastMonth(sportData, 'sportDate');

    // --- Report Content Generation ---
    doc.setFontSize(18);
    doc.text("Dashboard Performance Report", 10, yPos);
    yPos += 10;
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, yPos);
    yPos += 10;

    // Overview Section
    doc.setFontSize(14);
    doc.text("--- Overview ---", 10, yPos);
    yPos += 7;
    const totalDuration = filteredTrainingSessions.reduce((sum, session) => sum + (parseFloat(session.duration) || 0), 0);
    const avgDuration = filteredTrainingSessions.length > 0 ? (totalDuration / filteredTrainingSessions.length).toFixed(0) : '--';
    doc.text(`Average Training Duration (Last Month): ${avgDuration} minutes`, 10, yPos, { maxWidth: 180 });
    yPos += 14; // Adjust for wrapped text

    const userProfiles = await getAllData('userProfile'); // Re-fetch or pass as argument if needed
    const totalRestHr = userProfiles.reduce((sum, profile) => sum + (parseFloat(profile.userRestHR) || 0), 0);
    const avgRestHr = userProfiles.length > 0 ? (totalRestHr / userProfiles.length).toFixed(0) : '--';
    doc.text(`Average Resting Heart Rate: ${avgRestHr} BPM`, 10, yPos);
    yPos += 7;

    const totalCalories = filteredTrainingSessions.reduce((sum, session) => sum + (parseFloat(session.caloriesBurned || 0)), 0);
    doc.text(`Total Calories Burned (Last Month): ${totalCalories.toFixed(0)} kcal`, 10, yPos);
    yPos += 10;

    // HR & HRV Explanations
    doc.setFontSize(14);
    doc.text("--- HR & HRV Analysis ---", 10, yPos);
    yPos += 7;
    const avgHr = filteredTrainingSessions.length > 0 ? (filteredTrainingSessions.reduce((sum, s) => sum + (parseFloat(s.avgHr) || 0), 0) / filteredTrainingSessions.length).toFixed(0) : '--';
    const avgRmssd = filteredTrainingSessions.length > 0 ? (filteredTrainingSessions.reduce((sum, s) => sum + (parseFloat(s.rmssd) || 0), 0) / filteredTrainingSessions.length).toFixed(2) : '--';
    doc.text(`Average Heart Rate (Last Month): ${avgHr} BPM. A consistent heart rate at similar effort indicates stable condition.`, 10, yPos, { maxWidth: 180 });
    yPos += 14; // Adjust for wrapped text
    doc.text(`Average RMSSD (Last Month): ${avgRmssd} MS. Higher RMSSD indicates better recovery and lower nervous system load.`, 10, yPos, { maxWidth: 180 });
    yPos += 14;

    // Breathing Analysis
    doc.setFontSize(14);
    doc.text("--- Breathing Analysis ---", 10, yPos);
    yPos += 7;
    doc.text(`A consistent breathing rate of 8-12 breaths per minute is optimal for rest and recovery. The Ti/Te ratio (Inhale/Exhale) provides insight into breathing efficiency.`, 10, yPos, { maxWidth: 180 });
    yPos += 21;

    // Biometrics and Vo2Max Interpretations
    doc.setFontSize(14);
    doc.text("--- Biometrics & VO2 Max ---", 10, yPos);
    yPos += 7;
    if (userProfile) {
        doc.text(`Weight: ${userProfile.userWeight || '--'} kg, Fat Percentage: ${userProfile.userFatPercentage || '--'} %, Muscle Mass: ${userProfile.userMuscleMass || '--'} kg.`, 10, yPos, { maxWidth: 180 });
        yPos += 14;
        if (userProfile.userWeight && userProfile.userHeight) {
            const bmi = userProfile.userWeight / Math.pow(userProfile.userHeight / 100, 2);
            doc.text(`BMI: ${bmi.toFixed(1)}.`, 10, yPos);
            yPos += 7;
        }
        doc.text(`VO2 Max: ${userProfile.userVO2Max || '--'}. Higher score indicates better cardiovascular fitness.`, 10, yPos, { maxWidth: 180 });
        yPos += 14;
    }

    // Sleep Data Interpretation
    doc.setFontSize(14);
    doc.text("--- Sleep Analysis ---", 10, yPos);
    yPos += 7;
    const avgSleepScore = filteredSleepData.length > 0 ? (filteredSleepData.reduce((sum, s) => sum + (parseFloat(s.score) || 0), 0) / filteredSleepData.length).toFixed(1) : '--';
    const avgSleepDuration = filteredSleepData.length > 0 ? (filteredSleepData.reduce((sum, s) => sum + (parseFloat(s.duration) || 0), 0) / filteredSleepData.length).toFixed(0) : '--';
    doc.text(`Average Sleep Score (Last Month): ${avgSleepScore} with average duration of ${avgSleepDuration} hours. Sufficient and quality sleep is crucial for recovery and performance.`, 10, yPos, { maxWidth: 180 });
    yPos += 21;

    // Sport Activities Interpretation
    doc.setFontSize(14);
    doc.text("--- Sport Activities ---", 10, yPos);
    yPos += 7;
    const totalSportDuration = filteredSportData.length > 0 ? (filteredSportData.reduce((sum, s) => sum + (parseFloat(s.sportDuration) || 0), 0)).toFixed(0) : '--';
    const numberOfActivities = filteredSportData.length;
    doc.text(`You recorded ${numberOfActivities} sport activities last month with a total duration of ${totalSportDuration} minutes. Consistency in training is essential for progress.`, 10, yPos, { maxWidth: 180 });
    yPos += 21;

    // Add charts (assuming canvas elements exist in the HTML for these)
    const chartsToCapture = [
        { id: 'individualHrChart', title: 'Individual HR Chart' },
        { id: 'individualHrvChart', title: 'Individual HRV Chart' },
        { id: 'breathRateChart', title: 'Breath Rate Chart' }
    ];

    for (const chartInfo of chartsToCapture) {
        const canvas = document.getElementById(chartInfo.id);
        if (canvas) {
            const originalDisplay = canvas.style.display;
            canvas.style.display = 'block';
            try {
                const img = await html2canvas(canvas);
                const imgData = img.toDataURL('image/png');
                
                if (yPos + 100 > doc.internal.pageSize.height - 20) {
                    doc.addPage();
                    yPos = 10;
                }

                doc.text(chartInfo.title, 10, yPos);
                yPos += 7;
                doc.addImage(imgData, 'PNG', 10, yPos, 180, 90);
                yPos += 100;
            } catch (error) {
                console.error(`Error capturing chart ${chartInfo.id}:`, error);
            } finally {
                canvas.style.display = originalDisplay;
            }
        }
    }

    doc.save(`dashboard_report_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('Dashboard rapport succesvol gedownload!', 'success');
}
