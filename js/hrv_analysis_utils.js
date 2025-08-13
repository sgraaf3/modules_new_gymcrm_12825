// Bestand: hrv_analysis_utils.js
// Bevat de HRVAnalyzer class en gerelateerde functies voor HRV-analyse.

/**
 * @class HRVAnalyzer
 * @description Analyzes Heart Rate Variability (HRV) from a series of RR intervals.
 * Provides various time-domain and a placeholder for frequency-domain metrics.
 */
export class HRVAnalyzer {
    /**
     * Creates an instance of HRVAnalyzer.
     * @param {number[]} rrIntervals - An array of RR intervals in milliseconds.
     * Should contain at least 2 valid intervals for meaningful analysis.
     */
    constructor(rrIntervals) {
        this.rrIntervals = rrIntervals;
        
        // Calculate time-domain metrics
        this.meanRR = this.calculateMeanRR();
        this.rmssd = this.calculateRmssd();
        this.sdnn = this.calculateSdnn();
        this.nn50 = this.calculateNNX(50); // Number of successive differences > 50ms
        this.pnn50 = this.calculatePnnX(50); // Percentage of successive differences > 50ms
        this.sdsd = this.calculateSdsd(); // Standard Deviation of Successive Differences

        // Placeholder for frequency-domain metrics
        this.frequency = this.calculateFrequencyDomain();
        this.lfPower = this.frequency.lfPower;
        this.hfPower = this.frequency.hfPower;
        this.vlfPower = this.frequency.vlfPower;
        this.lfHfRatio = this.frequency.lfHfRatio;
    }

    /**
     * Calculates the mean of the RR intervals.
     * @returns {number} The average RR interval in milliseconds. Returns 0 if data is insufficient.
     */
    calculateMeanRR() {
        if (this.rrIntervals.length === 0) return 0;
        return this.rrIntervals.reduce((sum, val) => sum + val, 0) / this.rrIntervals.length;
    }

    /**
     * Calculates the Root Mean Square of Successive Differences (RMSSD).
     * RMSSD is a time-domain measure of HRV, reflecting short-term variability and parasympathetic (vagal) activity.
     * @returns {number} The RMSSD value in milliseconds. Returns 0 if data is insufficient.
     */
    calculateRmssd() {
        if (this.rrIntervals.length < 2) return 0;
        let sumOfDifferencesSquared = 0;
        for (let i = 0; i < this.rrIntervals.length - 1; i++) {
            const diff = this.rrIntervals[i + 1] - this.rrIntervals[i];
            sumOfDifferencesSquared += diff * diff;
        }
        return Math.sqrt(sumOfDifferencesSquared / (this.rrIntervals.length - 1));
    }

    /**
     * Calculates the Standard Deviation of NN intervals (SDNN).
     * SDNN is a time-domain measure of overall HRV, reflecting both sympathetic and parasympathetic activity.
     * @returns {number} The SDNN value in milliseconds. Returns 0 if data is insufficient.
     */
    calculateSdnn() {
        if (this.rrIntervals.length < 2) return 0;
        const mean = this.meanRR; // Use pre-calculated mean
        const sumOfSquaredDifferences = this.rrIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
        return Math.sqrt(sumOfSquaredDifferences / (this.rrIntervals.length - 1));
    }

    /**
     * Calculates NNx (number of successive NN intervals differing by more than X ms).
     * @param {number} threshold - The threshold in milliseconds (e.g., 50 for NN50).
     * @returns {number} The count of successive differences exceeding the threshold.
     */
    calculateNNX(threshold) {
        if (this.rrIntervals.length < 2) return 0;
        let n = 0;
        for (let i = 0; i < this.rrIntervals.length - 1; i++) {
            const diff = Math.abs(this.rrIntervals[i + 1] - this.rrIntervals[i]);
            if (diff > threshold) {
                n++;
            }
        }
        return n;
    }

    /**
     * Calculates the pNNx (percentage of successive NN intervals differing by more than X ms).
     * pNN50 (X=50) is a common measure reflecting parasympathetic activity.
     * @param {number} threshold - The threshold in milliseconds (e.g., 50 for pNN50).
     * @returns {number} The pNNx value as a percentage. Returns 0 if data is insufficient.
     */
    calculatePnnX(threshold) {
        if (this.rrIntervals.length < 2) return 0;
        const n = this.calculateNNX(threshold);
        return (n / (this.rrIntervals.length - 1)) * 100;
    }

    /**
     * Calculates the Standard Deviation of Successive Differences (SDSD).
     * SDSD is a time-domain measure closely related to RMSSD, also reflecting short-term variability.
     * @returns {number} The SDSD value in milliseconds. Returns 0 if data is insufficient.
     */
    calculateSdsd() {
        if (this.rrIntervals.length < 2) return 0;
        const differences = [];
        for (let i = 0; i < this.rrIntervals.length - 1; i++) {
            differences.push(this.rrIntervals[i + 1] - this.rrIntervals[i]);
        }
        
        const meanDiff = differences.reduce((sum, val) => sum + val, 0) / differences.length;
        const sumOfSquaredDiffs = differences.reduce((sum, val) => sum + Math.pow(val - meanDiff, 2), 0);
        return Math.sqrt(sumOfSquaredDiffs / (differences.length - 1));
    }

    /**
     * Placeholder for frequency domain HRV calculations.
     * In a full implementation, this would involve resampling the RR intervals to a regular time series,
     * applying a window function (e.g., Hanning), and then performing a Fast Fourier Transform (FFT).
     * The power spectral density would then be integrated over specific frequency bands.
     *
     * Frequency bands typically include:
     * - VLF (Very Low Frequency): < 0.04 Hz (e.g., thermoregulation, renin-angiotensin system)
     * - LF (Low Frequency): 0.04 - 0.15 Hz (e.g., baroreflex activity, mixed sympathetic and parasympathetic)
     * - HF (High Frequency): 0.15 - 0.4 Hz (e.g., vagal/parasympathetic activity, respiratory sinus arrhythmia)
     *
     * For this environment, we provide descriptive placeholder values.
     * @returns {object} An object containing VLF, LF, HF power, and LF/HF ratio.
     */
    calculateFrequencyDomain() {
        // This is a simplified placeholder. Real implementation requires complex signal processing.
        // For demonstration, returning dummy values.
        return {
            vlfPower: NaN, // Very Low Frequency Power (ms^2)
            lfPower: NaN,  // Low Frequency Power (ms^2)
            hfPower: NaN,  // High Frequency Power (ms^2)
            lfHfRatio: NaN // LF/HF Ratio (LF Power / HF Power)
        };
    }
}

/**
 * Calculates a comprehensive set of HRV metrics and basic statistics from an array of RR intervals.
 * This function is a standalone utility that can be used independently of the HRVAnalyzer class.
 * @param {number[]} data - An array of RR intervals in milliseconds.
 * @returns {object|null} An object containing calculated metrics, or null if data is insufficient.
 * @property {number} count - Number of RR intervals.
 * @property {number} minRR - Minimum RR interval.
 * @property {number} maxRR - Maximum RR interval.
 * @property {number} meanRR - Mean RR interval.
 * @property {number} medianRR - Median RR interval.
 * @property {number} rmssd - Root Mean Square of Successive Differences.
 * @property {number} sdnn - Standard Deviation of NN intervals.
 * @property {number} nn50 - Number of successive differences > 50ms.
 * @property {number} pNN50 - Percentage of successive differences > 50ms.
 * @property {number} sdsd - Standard Deviation of Successive Differences.
 * @property {number} avgHR - Average Heart Rate in BPM.
 */
export function calculateMetrics(data) {
    if (data.length < 2) return null; // At least 2 RR intervals needed for most calculations

    // Basic statistics
    const sortedData = [...data].sort((a, b) => a - b);
    const minRR = sortedData[0];
    const maxRR = sortedData[sortedData.length - 1];
    const meanRR = data.reduce((sum, val) => sum + val, 0) / data.length;
    const mid = Math.floor(sortedData.length / 2);
    const medianRR = sortedData.length % 2 === 0 ? (sortedData[mid - 1] + sortedData[mid]) / 2 : sortedData[mid];

    // Time-domain HRV metrics
    let sumSqDiff = 0;
    let nn50Count = 0;
    const differences = []; // To calculate SDSD
    for (let i = 0; i < data.length - 1; i++) {
        const diff = data[i + 1] - data[i];
        sumSqDiff += diff * diff;
        if (Math.abs(diff) > 50) nn50Count++;
        differences.push(diff);
    }

    const rmssd = Math.sqrt(sumSqDiff / (data.length - 1));
    const pNN50 = (nn50Count / (data.length - 1)) * 100;
    
    // Calculate SDNN
    const sumOfSquaredDifferences = data.reduce((sum, val) => sum + Math.pow(val - meanRR, 2), 0);
    const sdnn = Math.sqrt(sumOfSquaredDifferences / (data.length - 1));

    // Calculate SDSD
    const meanDiff = differences.reduce((sum, val) => sum + val, 0) / differences.length;
    const sumOfSquaredDiffs = differences.reduce((sum, val) => sum + Math.pow(val - meanDiff, 2), 0);
    const sdsd = Math.sqrt(sumOfSquaredDiffs / (differences.length - 1));

    const avgHR = 60000 / meanRR; // Convert mean RR in ms to BPM

    return {
        count: data.length,
        minRR: minRR,
        maxRR: maxRR,
        meanRR: meanRR,
        medianRR: medianRR,
        rmssd: rmssd,
        sdnn: sdnn,
        nn50: nn50Count,
        pNN50: pNN50,
        sdsd: sdsd,
        avgHR: avgHR
    };
}
