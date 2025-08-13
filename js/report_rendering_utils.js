// Bestand: report_rendering_utils.js
// Bevat alle functies voor het renderen van HRV-analyses (grafieken, tabellen, teksten).

import { getData, getAllData, getOrCreateUserId } from './database.js'; // Import database functions

let chartInstances = {}; // Global object to store Chart.js instances

/**
 * Clears a Chart.js instance from the canvas if it exists.
 * @param {string} canvasId - The ID of the canvas element.
 */
export function clearChart(canvasId) {
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
        delete chartInstances[canvasId];
    }
}

/**
 * Renders a Poincaré Plot.
 * @param {number[]} data - Array of RR intervals.
 * @param {string} canvasId - The ID of the canvas element.
 */
export function renderPoincarePlot(data, canvasId) {
    const canvasElement = document.getElementById(canvasId);
    if (!canvasElement) {
        console.error(`Canvas element with ID '${canvasId}' not found.`);
        return;
    }
    const contentDiv = canvasElement.parentNode;
    contentDiv.innerHTML = `<canvas id="${canvasId}"></canvas>`; // Recreate canvas for fresh render
    const canvas = document.getElementById(canvasId);

    if (data.length < 2) {
        contentDiv.innerHTML = '<p class="text-red-400">Not enough data for a Poincaré plot (requires at least 2 RR intervals).</p>';
        return;
    }

    const poincareData = data.slice(0, -1).map((value, i) => ({
        x: value,
        y: data[i + 1]
    }));

    const ctx = canvas.getContext('2d');
    clearChart(canvasId); // Clear existing chart if any
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Poincaré Plot (RRn vs RRn+1)',
                data: poincareData,
                backgroundColor: 'rgba(66, 153, 225, 0.6)', // Tailwind blue-500 equivalent
                borderColor: 'rgba(66, 153, 225, 0.8)',
                pointRadius: 3,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Poincaré Plot',
                    font: { size: 18, weight: 'bold', color: '#e5e7eb' }
                },
                legend: {
                    labels: {
                        color: '#9ca3af' // Gray-400
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: { display: true, text: 'RR Interval (RRn) [ms]', font: { size: 14, color: '#e5e7eb' } },
                    ticks: { color: '#9ca3af' },
                    grid: { color: '#374151' } // Gray-700
                },
                y: {
                    type: 'linear',
                    title: { display: true, text: 'RR Interval (RRn+1) [ms]', font: { size: 14, color: '#e5e7eb' } },
                    ticks: { color: '#9ca3af' },
                    grid: { color: '#374151' } // Gray-700
                }
            }
        }
    });
}

/**
 * Renders a Histogram.
 * @param {number[]} data - Array of numerical data (RR intervals or Heart Rates).
 * @param {string} canvasId - The ID of the canvas element.
 * @param {string} label - Label for the x-axis.
 */
export function renderHistogram(data, canvasId, label) {
    const canvasElement = document.getElementById(canvasId);
    if (!canvasElement) {
        console.error(`Canvas element with ID '${canvasId}' not found.`);
        return;
    }
    const contentDiv = canvasElement.parentNode;
    contentDiv.innerHTML = `<canvas id="${canvasId}"></canvas>`; // Recreate canvas
    const canvas = document.getElementById(canvasId);

    if (data.length === 0) {
        contentDiv.innerHTML = `<p class="text-red-400">No valid data to create a ${label} histogram.</p>`;
        return;
    }

    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const numBins = Math.ceil(Math.sqrt(data.length));
    const binWidth = (maxVal - minVal) / (numBins > 0 ? numBins : 1);

    let bins = Array(numBins).fill(0);
    let binLabels = [];

    if (binWidth === 0 && data.length > 0) {
        const singleBinLabel = `${minVal.toFixed(1)}`;
        bins = [data.length];
        binLabels = [singleBinLabel];
        label = `${label} (All Values Identical)`; // Adjust label for clarity
    } else {
        for (let i = 0; i < numBins; i++) {
            const lowerBound = minVal + i * binWidth;
            const upperBound = minVal + (i + 1) * binWidth;
            binLabels.push(`${lowerBound.toFixed(1)}-${upperBound.toFixed(1)}`);
        }
        data.forEach(value => {
            let binIndex = Math.floor((value - minVal) / binWidth);
            if (binIndex >= numBins) binIndex = numBins - 1;
            if (binIndex < 0) binIndex = 0;
            bins[binIndex]++;
        });
    }

    const ctx = canvas.getContext('2d');
    clearChart(canvasId);
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binLabels,
            datasets: [{
                label: `Frequency of ${label}`,
                data: bins,
                backgroundColor: 'rgba(56, 178, 172, 0.7)', // Tailwind teal-500 equivalent
                borderColor: 'rgba(56, 178, 172, 1)',
                borderWidth: 1,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${label} Histogram`,
                    font: { size: 18, weight: 'bold', color: '#e5e7eb' }
                },
                legend: {
                    labels: {
                        color: '#9ca3af'
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: label.split(' (All Values Identical)')[0], font: { size: 14, color: '#e5e7eb' } }, // Remove added text for axis
                    ticks: { color: '#9ca3af' },
                    grid: { color: '#374151' }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Frequency', font: { size: 14, color: '#e5e7eb' } },
                    ticks: { color: '#9ca3af' },
                    grid: { color: '#374151' }
                }
            }
        }
    });
}

/**
 * Renders a Time Series Plot.
 * @param {number[]} data - Array of numerical data.
 * @param {string} canvasId - The ID of the canvas element.
 * @param {Array<number>} timestamps - Array of timestamps corresponding to data points.
 * @param {string} label - Label for the y-axis.
 * @param {string} borderColor - Color for the line.
 * @param {string} backgroundColor - Background color for the fill.
 */
export function renderTimeSeriesChart(data, canvasId, timestamps, label, borderColor, backgroundColor) {
    const canvasElement = document.getElementById(canvasId);
    if (!canvasElement) {
        console.error(`Canvas element with ID '${canvasId}' not found.`);
        return;
    }
    const contentDiv = canvasElement.parentNode;
    contentDiv.innerHTML = `<canvas id="${canvasId}"></canvas>`; // Recreate canvas
    const canvas = document.getElementById(canvasId);

    if (data.length === 0) {
        contentDiv.innerHTML = `<p class="text-red-400">Not enough data for a ${label} time series plot.</p>`;
        return;
    }

    const labels = timestamps.map(ts => new Date(ts).toLocaleTimeString()); // Use timestamps for labels
    const datasets = [{
        label: label,
        data: data,
        borderColor: borderColor,
        backgroundColor: backgroundColor,
        pointRadius: 0,
        borderWidth: 2,
        fill: false,
    }];

    const ctx = canvas.getContext('2d');
    clearChart(canvasId);
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${label} Time Series`,
                    font: { size: 18, weight: 'bold', color: '#e5e7eb' }
                },
                legend: {
                    labels: {
                        color: '#9ca3af'
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Time', font: { size: 14, color: '#e5e7eb' } },
                    ticks: { color: '#9ca3af' },
                    grid: { color: '#374151' }
                },
                y: {
                    title: { display: true, text: label, font: { size: 14, color: '#e5e7eb' } },
                    ticks: { color: '#9ca3af' },
                    grid: { color: '#374151' }
                }
            }
        }
    });
}
// Specific time series wrappers
export function renderRrTimeSeries(data, canvasId, timestamps) {
    renderTimeSeriesChart(data, canvasId, timestamps, 'RR Interval (ms)', 'rgba(239, 68, 68, 0.8)', 'rgba(239, 68, 68, 0.2)'); // Tailwind red-500
}
export function renderHrTimeSeries(data, canvasId, timestamps) {
    renderTimeSeriesChart(data, canvasId, timestamps, 'Heart Rate (BPM)', 'rgba(102, 126, 234, 0.8)', 'rgba(102, 126, 234, 0.2)'); // Tailwind indigo-400
}

/**
 * Renders a Successive Differences Histogram.
 * @param {number[]} data - Array of RR intervals.
 * @param {string} canvasId - The ID of the canvas element.
 */
export function renderSuccessiveDifferencesHistogram(data, canvasId) {
    const canvasElement = document.getElementById(canvasId);
    if (!canvasElement) {
        console.error(`Canvas element with ID '${canvasId}' not found.`);
        return;
    }
    const contentDiv = canvasElement.parentNode;
    contentDiv.innerHTML = `<canvas id="${canvasId}"></canvas>`; // Recreate canvas
    const canvas = document.getElementById(canvasId);

    if (data.length < 2) {
        contentDiv.innerHTML = "<p class='text-red-400'>Not enough data for a Successive Differences Histogram (requires at least 2 RR intervals).</p>";
        return;
    }

    const differences = data.slice(0, -1).map((value, i) => Math.abs(data[i + 1] - value));

    const minVal = Math.min(...differences);
    const maxVal = Math.max(...differences);
    const numBins = Math.ceil(Math.sqrt(differences.length));
    const binWidth = (maxVal - minVal) / (numBins > 0 ? numBins : 1);

    let bins = Array(numBins).fill(0);
    let binLabels = [];

    if (binWidth === 0 && differences.length > 0) {
        const singleBinLabel = `${minVal.toFixed(1)} ms`;
        bins = [differences.length];
        binLabels = [singleBinLabel];
    } else {
        for (let i = 0; i < numBins; i++) {
            const lowerBound = minVal + i * binWidth;
            const upperBound = minVal + (i + 1) * binWidth;
            binLabels.push(`${lowerBound.toFixed(1)}-${upperBound.toFixed(1)}`);
        }
        differences.forEach(value => {
            let binIndex = Math.floor((value - minVal) / binWidth);
            if (binIndex >= numBins) binIndex = numBins - 1;
            if (binIndex < 0) binIndex = 0;
            bins[binIndex]++;
        });
    }

    const ctx = canvas.getContext('2d');
    clearChart(canvasId);
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binLabels,
            datasets: [{
                label: 'Frequency of Successive Differences',
                data: bins,
                backgroundColor: 'rgba(255, 159, 64, 0.7)', // Tailwind orange-400
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 1,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Successive Differences Histogram',
                    font: { size: 18, weight: 'bold', color: '#e5e7eb' }
                },
                legend: {
                    labels: {
                        color: '#9ca3af'
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Absolute Difference (ms)', font: { size: 14, color: '#e5e7eb' } },
                    ticks: { color: '#9ca3af' },
                    grid: { color: '#374151' }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Frequency', font: { size: 14, color: '#e5e7eb' } },
                    ticks: { color: '#9ca3af' },
                    grid: { color: '#374151' }
                }
            }
        }
    });
}

/**
 * Displays general summary statistics in a table.
 * @param {number[]} data - Array of RR intervals.
 * @param {string} contentDivId - The ID of the content div to render into.
 * @param {function} calculateMetrics - Function to calculate HRV metrics.
 */
export function displayGeneralSummary(data, contentDivId, calculateMetrics) {
    const contentDiv = document.getElementById(contentDivId);
    contentDiv.innerHTML = ''; // Clear existing content

    if (data.length < 2) {
        contentDiv.innerHTML = "<p class='text-red-400'>Not enough data for general summary statistics (requires at least 2 RR intervals).</p>";
        return;
    }

    const metrics = calculateMetrics(data);
    if (!metrics) {
        contentDiv.innerHTML = "<p class='text-red-400'>Could not calculate metrics with the provided data.</p>";
        return;
    }

    contentDiv.innerHTML = `
        <table class="w-full text-left table-auto">
            <thead>
                <tr class="bg-gray-800">
                    <th class="px-4 py-2">Metric</th>
                    <th class="px-4 py-2">Value</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>Number of RR Intervals</td><td>${metrics.count}</td></tr>
                <tr><td>Min RR Interval</td><td>${metrics.minRR.toFixed(2)} ms</td></tr>
                <tr><td>Max RR Interval</td><td>${metrics.maxRR.toFixed(2)} ms</td></tr>
                <tr><td>Mean RR Interval</td><td>${metrics.meanRR.toFixed(2)} ms</td></tr>
                <tr><td>Median RR Interval</td><td>${metrics.medianRR.toFixed(2)} ms</td></tr>
                <tr><td>RMSSD</td><td>${metrics.rmssd.toFixed(2)} ms</td></tr>
                <tr><td>SDNN</td><td>${metrics.sdnn.toFixed(2)} ms</td></tr>
                <tr><td>NN50</td><td>${metrics.nn50}</td></tr>
                <tr><td>pNN50</td><td>${metrics.pNN50.toFixed(2)} %</td></tr>
                <tr><td>SDSD</td><td>${metrics.sdsd.toFixed(2)} ms</td></tr>
                <tr><td>Average Heart Rate</td><td>${metrics.avgHR.toFixed(2)} BPM</td></tr>
            </tbody>
        </table>
    `;
}

/**
 * Displays all raw RR interval data with timestamps.
 * @param {Array<object>} data - Array of RR interval objects ({value, timestamp, originalIndex}).
 * @param {string} contentDivId - The ID of the content div to render into.
 */
export function displayAllRRDataRaw(data, contentDivId) {
    const contentDiv = document.getElementById(contentDivId);
    contentDiv.innerHTML = ''; // Clear existing content

    if (data.length === 0) {
        contentDiv.innerHTML = "<p class='text-red-400'>No RR interval data to display.</p>";
        return;
    }

    let tableHtml = '<table class="w-full text-left table-auto"><thead><tr class="bg-gray-800"><th>Index</th><th>Time</th><th>RR Interval (ms)</th></tr></thead><tbody>';
    data.forEach((item, index) => {
        const timeString = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A';
        tableHtml += `<tr><td>${item.originalIndex + 1}</td><td>${timeString}</td><td>${item.value.toFixed(2)}</td></tr>`;
    });
    tableHtml += '</tbody></table>';
    contentDiv.innerHTML = tableHtml;
}

// --- Table Rendering Functions ---
/**
 * Renders a generic table from an array of objects.
 * @param {object[]} data - Array of objects, where each object represents a row.
 * @param {string} contentDivId - The ID of the content div to render into.
 * @param {string[]} [columns] - Optional array of column keys to display. If not provided, all keys from the first object are used.
 * @param {string[]} [columnHeaders] - Optional array of human-readable headers for the columns.
 */
export function renderGenericTable(data, contentDivId, columns, columnHeaders) {
    const contentDiv = document.getElementById(contentDivId);
    // Create a temporary div if contentDiv is null (e.g., when rendering to get HTML string)
    const targetDiv = contentDiv || document.createElement('div');
    targetDiv.innerHTML = '';

    if (!data || data.length === 0) {
        targetDiv.innerHTML = `<p class="text-gray-400">No data to display in this table.</p>`;
        return targetDiv.outerHTML; // Return HTML string if temporary
    }

    // Determine columns if not provided
    const keys = columns || Object.keys(data[0]);
    const headers = columnHeaders || keys.map(key => key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())); // Basic camelCase to Title Case

    let tableHtml = '<table class="w-full text-left table-auto">';
    tableHtml += '<thead><tr class="bg-gray-800">';
    headers.forEach(header => {
        tableHtml += `<th class="px-4 py-2">${header}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    data.forEach(row => {
        tableHtml += '<tr>';
        keys.forEach(key => {
            let value = row[key];
            if (typeof value === 'number') {
                value = value.toFixed(2); // Format numbers to 2 decimal places
            } else if (typeof value === 'boolean') {
                value = value ? 'Yes' : 'No';
            } else if (value instanceof Date || (typeof value === 'string' && !isNaN(new Date(value)))) {
                value = new Date(value).toLocaleString(); // Format Date objects or date strings
            } else if (value === null || value === undefined) {
                value = '--';
            }
            tableHtml += `<td class="px-4 py-2">${value}</td>`;
        });
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    targetDiv.innerHTML = tableHtml;

    return contentDiv ? '' : targetDiv.outerHTML; // If temporary, return HTML string, else empty
}


/**
 * Renders a table for Poincaré Plot data.
 * @param {number[]} data - Array of RR intervals.
 * @param {string} contentDivId - The ID of the content div to render into.
 */
export function renderPoincareTable(data, contentDivId) {
    const contentDiv = document.getElementById(contentDivId);
    contentDiv.innerHTML = ''; // Clear existing content

    if (data.length < 2) {
        contentDiv.innerHTML = '<p class="text-red-400">Not enough data for a Poincaré table (requires at least 2 RR intervals).</p>';
        return;
    }

    let tableHtml = '<table class="w-full text-left table-auto"><thead><tr class="bg-gray-800"><th>RRn (ms)</th><th>RRn+1 (ms)</th></tr></thead><tbody>';
    for (let i = 0; i < data.length - 1; i++) {
        tableHtml += `<tr><td>${data[i].toFixed(2)}</td><td>${data[i+1].toFixed(2)}</td></tr>`;
    }
    tableHtml += '</tbody></table>';
    contentDiv.innerHTML = tableHtml;
}

/**
 * Renders a table for histogram data.
 * @param {number[]} data - Array of numerical data.
 * @param {string} contentDivId - The ID of the content div to render into.
 * @param {string} label - Label for the values (e.g., 'RR Interval').
 */
export function renderHistogramTable(data, contentDivId, label) {
    const contentDiv = document.getElementById(contentDivId);
    contentDiv.innerHTML = '';

    if (data.length === 0) {
        contentDiv.innerHTML = `<p class="text-red-400">No data for ${label} histogram table.</p>`;
        return;
    }

    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const numBins = Math.ceil(Math.sqrt(data.length));
    const binWidth = (maxVal - minVal) / (numBins > 0 ? numBins : 1);

    let bins = Array(numBins).fill(0);
    let binLabels = [];

    if (binWidth === 0 && data.length > 0) {
         // Handle case where all values are identical
        const singleBinLabel = `${minVal.toFixed(1)} ${label.includes('BPM') ? 'BPM' : 'ms'}`;
        bins = [data.length];
        binLabels = [singleBinLabel];
    } else {
        for (let i = 0; i < numBins; i++) {
            const lowerBound = minVal + i * binWidth;
            const upperBound = minVal + (i + 1) * binWidth;
            binLabels.push(`${lowerBound.toFixed(1)}-${upperBound.toFixed(1)}`);
        }
        data.forEach(value => {
            let binIndex = Math.floor((value - minVal) / binWidth);
            if (binIndex >= numBins) binIndex = numBins - 1;
            if (binIndex < 0) binIndex = 0;
            bins[binIndex]++;
        });
    }

    let tableHtml = `<table class="w-full text-left table-auto"><thead><tr class="bg-gray-800"><th>${label} Bin</th><th>Frequency</th></tr></thead><tbody>`;
    binLabels.forEach((binLabel, index) => {
        tableHtml += `<tr><td>${binLabel}</td><td>${bins[index]}</td></tr>`;
    });
    tableHtml += '</tbody></table>';
    contentDiv.innerHTML = tableHtml;
}

/**
 * Renders a table for time series data.
 * @param {number[]} data - Array of numerical data.
 * @param {string} contentDivId - The ID of the content div to render into.
 * @param {Array<number>} timestamps - Array of timestamps corresponding to data points.
 * @param {string} label - Label for the values (e.g., 'RR Interval (ms)').
 */
export function renderTimeSeriesTable(data, contentDivId, timestamps, label) {
    const contentDiv = document.getElementById(contentDivId);
    contentDiv.innerHTML = '';

    if (data.length === 0) {
        contentDiv.innerHTML = `<p class="text-red-400">No data for ${label} time series table.</p>`;
        return;
    }

    let tableHtml = `<table class="w-full text-left table-auto"><thead><tr class="bg-gray-800"><th>Time</th><th>${label}</th></tr></thead><tbody>`;
    data.forEach((value, index) => {
        const timeString = timestamps[index] ? new Date(timestamps[index]).toLocaleString() : 'N/A';
        tableHtml += `<tr><td>${timeString}</td><td>${value.toFixed(2)}</td></tr>`;
    });
    tableHtml += '</tbody></table>';
    contentDiv.innerHTML = tableHtml;
}
// Specific time series table wrappers
export function renderRrTimeSeriesTable(data, contentDivId, timestamps) {
    renderTimeSeriesTable(data, contentDivId, timestamps, 'RR Interval (ms)');
}
export function renderHrTimeSeriesTable(data, contentDivId, timestamps) {
    renderTimeSeriesTable(data.map(rr => 60000 / rr), contentDivId, timestamps, 'Heart Rate (BPM)');
}

/**
 * Renders a table for successive differences histogram data.
 * @param {number[]} data - Array of RR intervals.
 * @param {string} contentDivId - The ID of the content div to render into.
 */
export function renderSuccessiveDifferencesTable(data, contentDivId) {
    const contentDiv = document.getElementById(contentDivId);
    contentDiv.innerHTML = '';

    if (data.length < 2) {
        contentDiv.innerHTML = '<p class="text-red-400">Not enough data for successive differences table (requires at least 2 RR intervals).</p>';
        return;
    }

    const differences = data.slice(0, -1).map((value, i) => Math.abs(data[i + 1] - value));

    const minVal = Math.min(...differences);
    const maxVal = Math.max(...differences);
    const numBins = Math.ceil(Math.sqrt(differences.length));
    const binWidth = (maxVal - minVal) / (numBins > 0 ? numBins : 1);

    let bins = Array(numBins).fill(0);
    let binLabels = [];

    if (binWidth === 0 && differences.length > 0) {
        const singleBinLabel = `${minVal.toFixed(1)} ms`;
        bins = [differences.length];
        binLabels = [singleBinLabel];
    } else {
        for (let i = 0; i < numBins; i++) {
            const lowerBound = minVal + i * binWidth;
            const upperBound = minVal + (i + 1) * binWidth;
            binLabels.push(`${lowerBound.toFixed(1)}-${upperBound.toFixed(1)}`);
        }
        differences.forEach(value => {
            let binIndex = Math.floor((value - minVal) / binWidth);
            if (binIndex >= numBins) binIndex = numBins - 1;
            if (binIndex < 0) binIndex = 0;
            bins[binIndex]++;
        });
    }

    let tableHtml = `<table class="w-full text-left table-auto"><thead><tr class="bg-gray-800"><th>Absolute Difference (ms) Bin</th><th>Frequency</th></tr></thead><tbody>`;
    binLabels.forEach((binLabel, index) => {
        tableHtml += `<tr><td>${binLabel}</td><td>${bins[index]}</td></tr>`;
    });
    tableHtml += '</tbody></table>';
    contentDiv.innerHTML = tableHtml;
}


// --- Text Explanation Functions ---
/**
 * Renders an editable text explanation.
 * @param {string} contentDivId - The ID of the content div to render into.
 * @param {string} defaultText - The default text to display.
 */
export function renderTextExplanation(contentDivId, defaultText) {
    const contentDiv = document.getElementById(contentDivId);
    contentDiv.innerHTML = `<div class="editable-text" contenteditable="true">${defaultText}</div>`;
}

// Specific text explanation wrappers
export function renderPoincareText(contentDivId) {
    const text = `
        <p><strong>Poincaré Plot Interpretation:</strong></p>
        <p>The Poincaré plot is a visual representation of Heart Rate Variability (HRV), plotting each RR interval (RRn) against the subsequent RR interval (RRn+1). This plot is particularly useful for assessing the short-term and long-term variability of heart rate.</p>
        <p>A healthy heart typically shows a "comet-shaped" or "torpedo-shaped" plot, indicating good variability. The width of the scatter (SD1) is related to short-term variability (parasympathetic activity), while the length of the scatter (SD2) relates to long-term variability (sympathetic and parasympathetic activity).</p>
        <p><strong>Common Patterns:</strong></p>
        <ul>
            <li><strong>Dense, rounded cloud:</strong> Indicates healthy, high HRV.</li>
            <li><strong>Elongated, narrow cloud:</strong> May suggest reduced HRV, often seen in stress or certain cardiovascular conditions.</li>
            <li><strong>Scattered, irregular points:</b> Can indicate arrhythmias or ectopic beats.</li>
        </ul>
        <p>This visualization helps identify patterns that might be missed by simple statistical measures.</p>
    `;
    renderTextExplanation(contentDivId, text);
}

export function renderHistogramText(contentDivId, type) {
    const text = `
        <p><strong>${type} Histogram Interpretation:</strong></p>
        <p>A histogram displays the distribution of ${type} values. For RR intervals, it shows how frequently different interval durations occur. For Heart Rate, it shows the distribution of beats per minute (BPM).</p>
        <p><strong>Typical Shapes:</strong></p>
        <ul>
            <li><strong>Symmetric, bell-shaped distribution:</strong> Often indicates healthy, stable heart rhythm.</li>
            <li><strong>Skewed or multi-modal distribution:</b> Can suggest influences like exercise, stress, or sleep stages, or the presence of arrhythmias.</li>
            <li><strong>Narrow distribution:</b> Indicates low variability, where heart rate doesn't change much.</li>
            <li><strong>Wide distribution:</strong> Indicates high variability, a sign of adaptability.</li>
        </ul>
        <p>Analyzing the shape, spread, and peak(s) of the histogram provides insights into the overall heart rate regulation.</p>
    `;
    renderTextExplanation(contentDivId, text);
}
export function renderRrHistogramText(contentDivId) { renderHistogramText(contentDivId, 'RR Interval'); }
export function renderHrHistogramText(contentDivId) { renderHistogramText(contentDivId, 'Heart Rate'); }


export function renderTimeSeriesText(contentDivId, type) {
    const text = `
        <p><strong>${type} Time Series Interpretation:</strong></p>
        <p>A time series plot shows the sequence of ${type} values over time (or interval number in this case). It allows you to observe trends, patterns, and sudden changes in heart rhythm.</p>
        <p><strong>What to Look For:</strong></p>
        <ul>
            <li><strong>Overall trend:</strong> Is the ${type} increasing, decreasing, or stable?</li>
            <li><strong>Variability:</strong> How much do the points fluctuate around a mean? High variability is generally a sign of good cardiovascular adaptability.</li>
            <li><strong>Outliers or anomalies:</strong> Sudden, large spikes or drops could indicate artifacts (errors in measurement) or actual physiological events like ectopic beats.</li>
            <li><strong>Rhythmic patterns:</strong> Are there any recurring cycles, such as slower heart rate during rest and faster during activity?</li>
        </ul>
        <p>This plot is essential for identifying non-stationary patterns and understanding the dynamic behavior of heart rate.</p>
    `;
    renderTextExplanation(contentDivId, text);
}
export function renderRrTimeSeriesText(contentDivId) { renderTimeSeriesText(contentDivId, 'RR Interval'); }
export function renderHrTimeSeriesText(contentDivId) { renderTimeSeriesText(contentDivId, 'Heart Rate'); }


export function renderSuccessiveDifferencesHistogramText(contentDivId) {
    const text = `
        <p><strong>Successive Differences Histogram Interpretation:</strong></p>
        <p>This histogram visualizes the distribution of the absolute differences between consecutive RR intervals (|RRn+1 - RRn|). It's primarily used to assess short-term heart rate variability.</p>
        <p><strong>Key Insights:</strong></p>
        <ul>
            <li><strong>Concentration around zero:</strong> A large peak near zero indicates many small differences between successive heartbeats, suggesting stable rhythms.</li>
            <li><strong>Spread of the distribution:</strong> A wider spread indicates greater short-term variability, often associated with higher parasympathetic (vagal) tone.</li>
            <li><strong>Outliers:</strong> Large differences (far from zero) might indicate artifacts or significant changes in heart rate.</li>
        </ul>
        <p>The Root Mean Square of Successive Differences (RMSSD) is a common metric derived from these differences, reflecting parasympathetic activity.</p>
    `;
    renderTextExplanation(contentDivId, text);
}

export function renderGeneralSummaryText(contentDivId) {
    const text = `
        <p><strong>General Summary Statistics Interpretation:</strong></p>
        <p>This section provides key time-domain Heart Rate Variability (HRV) metrics and general heart rate information, offering a quick overview of cardiac autonomic regulation.</p>
        <ul>
            <li><strong>Number of RR Intervals:</strong> The total count of valid heartbeats analyzed. More data generally leads to more reliable metrics.</li>
            <li><strong>Min RR Interval:</strong> The shortest RR interval observed.</li>
            <li><strong>Max RR Interval:</strong> The longest RR interval observed.</li>
            <li><strong>Mean RR Interval:</strong> The average time between consecutive heartbeats. A higher value indicates a slower average heart rate.</li>
            <li><strong>Median RR Interval:</strong> The middle value of the RR intervals when sorted. Less sensitive to outliers than the mean.</li>
            <li><strong>RMSSD (Root Mean Square of Successive Differences):</strong> A primary measure of short-term HRV, reflecting vagal (parasympathetic) tone. Higher RMSSD generally indicates greater parasympathetic activity and better cardiac health/recovery capacity.</li>
            <li><strong>SDNN (Standard Deviation of NN Intervals):</strong> A measure of overall HRV, reflecting both sympathetic and parasympathetic influences. Higher SDNN indicates greater overall variability.</li>
            <li><strong>NN50:</strong> The number of successive NN intervals that differ by more than 50 milliseconds.</li>
            <li><strong>pNN50 (Percentage of successive NN intervals differing by more than 50ms):</strong> Another short-term HRV measure, highly correlated with vagal activity. A higher pNN50 suggests stronger parasympathetic influence.</li>
            <li><strong>SDSD (Standard Deviation of Successive Differences):</strong> A measure of short-term variability, similar to RMSSD.</li>
            <li><strong>Average Heart Rate:</strong> The mean beats per minute during the measurement period.</li>
        </ul>
        <p>These metrics, especially RMSSD and SDNN, are valuable indicators of physiological stress, recovery, and overall adaptability of the cardiovascular system.</p>
    `;
    renderTextExplanation(contentDivId, text);
}

export function renderAllRrDataRawText(contentDivId) {
    const text = `
        <p><strong>Raw RR Interval Data:</strong></p>
        <p>This displays the raw RR interval data points as measured, typically in milliseconds, along with their corresponding timestamps. This is the fundamental data from which all Heart Rate Variability (HRV) metrics and plots are derived.</p>
        <p><strong>Usage:</strong></p>
        <ul>
            <li><strong>Data Integrity Check:</strong> Visually inspect for obvious outliers or errors that might indicate measurement artifacts (e.g., excessively short or long intervals that are physiologically impossible).</li>
            <li><strong>Temporal Analysis:</strong> The inclusion of timestamps allows for understanding the sequence of events and how RR intervals change over time during a measurement period.</li>
            <li><strong>Manual Review:</strong> Useful for researchers or clinicians who wish to perform their own manual inspection or additional custom analyses outside of the provided tools.</li>
            <li><strong>Transparency:</strong> Provides full transparency into the data being analyzed.</li>
        </ul>
        <p>While direct interpretation of raw numbers can be challenging, it forms the basis for more meaningful visualizations and statistical summaries.</p>
    `;
    renderTextExplanation(contentDivId, text);
}

// --- New Report Type Rendering Functions ---

export function renderUserSettingsReport(data, contentDivId) {
    const columns = ['id', 'email', 'firstName', 'lastName', 'age', 'gender', 'weight', 'height', 'fatPercentage', 'userBaseAtHR'];
    const headers = ['User ID', 'Email', 'First Name', 'Last Name', 'Age', 'Gender', 'Weight (kg)', 'Height (cm)', 'Fat %', 'Base AT HR'];
    return renderGenericTable(data, contentDivId, columns, headers); // Ensure it returns the HTML string
}

export function renderMembersReport(data, contentDivId) {
    const columns = ['id', 'name', 'email', 'phone', 'membershipStatus', 'joinDate'];
    const headers = ['Member ID', 'Name', 'Email', 'Phone', 'Membership Status', 'Join Date'];
    return renderGenericTable(data, contentDivId, columns, headers);
}

export function renderSubscriptionsReport(data, contentDivId) {
    const columns = ['id', 'memberId', 'planName', 'startDate', 'endDate', 'status', 'price'];
    const headers = ['Subscription ID', 'Member ID', 'Plan Name', 'Start Date', 'End Date', 'Status', 'Price'];
    return renderGenericTable(data, contentDivId, columns, headers);
}

export function renderFinancialsReport(data, contentDivId) {
    const columns = ['id', 'type', 'amount', 'date', 'description'];
    const headers = ['Transaction ID', 'Type', 'Amount', 'Date', 'Description'];
    return renderGenericTable(data, contentDivId, columns, headers);
}

/**
 * Renders a comprehensive user report. This function orchestrates fetching data
 * from various IndexedDB stores and rendering it into a structured report.
 * This is a placeholder for extensive logic that would dynamically generate
 * multiple sub-sections (biometry, training, sleep, etc.) with graphs, tables,
 * explanations, comparisons, strengths, weaknesses, and advice.
 *
 * @param {string} contentDivId - The ID of the content div to render into.
 */
export async function renderComprehensiveUserReport(contentDivId) {
    const contentDiv = document.getElementById(contentDivId);
    contentDiv.innerHTML = '<p class="text-gray-400 text-center">Generating Comprehensive User Report...</p>';

    const currentUserId = getOrCreateUserId(); // Assuming the report is for the current user

    try {
        const userProfile = await getData('userProfile', currentUserId);
        const trainingSessions = await getAllData('trainingSessions');
        const sleepData = await getAllData('sleepData');
        const nutritionPrograms = await getAllData('nutritionPrograms');
        const assignedNutritionPrograms = await getAllData('assignedNutritionPrograms');
        const testProtocols = await getAllData('testProtocols');
        const logs = await getAllData('logs');
        const memberActivity = await getAllData('memberActivity'); // Assuming this stores progress
        const customMeasurements = await getAllData('customMeasurements');
        const trainingDays = await getAllData('trainingDays');
        const trainingWeeks = await getAllData('trainingWeeks');
        const trainingBlocks = await getAllData('trainingBlocks');
        const configuredSessions = await getAllData('configuredSessions');
        const lessons = await getAllData('lessons');
        const gymSections = await getAllData('gymSections');


        let reportHtml = `<h3 class="text-xl font-bold text-gray-100 mb-4">Comprehensive Report for User: ${userProfile?.firstName || 'N/A'} ${userProfile?.lastName || 'N/A'}</h3>`;
        
        // Helper to render a section
        const renderSection = (sectionTitle, data, interpretationType, columns, headers) => {
            let sectionHtml = `<h4 class="text-lg font-semibold text-blue-300 mt-6 mb-3">${sectionTitle}</h4>`;
            if (data && data.length > 0) {
                sectionHtml += `<div class="mb-4">${renderGenericTable(data, null, columns, headers)}</div>`;
                sectionHtml += renderInterpretationText(null, interpretationType);
            } else {
                sectionHtml += `<p class="text-gray-400">No ${sectionTitle.toLowerCase()} data available.</p>`;
            }
            return sectionHtml;
        };

        // --- Section 1: User Profile & Biometrics ---
        reportHtml += renderSection(
            '1. User Profile & Biometrics',
            userProfile ? [userProfile] : [],
            'user_profile_interpretation',
            ['id', 'email', 'firstName', 'lastName', 'age', 'gender', 'weight', 'height', 'fatPercentage', 'userBaseAtHR'],
            ['User ID', 'Email', 'First Name', 'Last Name', 'Age', 'Gender', 'Weight (kg)', 'Height (cm)', 'Fat %', 'Base AT HR']
        );

        // --- Section 2: Training Sessions ---
        reportHtml += renderSection(
            '2. Training Sessions Overview',
            trainingSessions.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
            'training_interpretation',
            ['date', 'duration', 'avgHr', 'rmssd'],
            ['Date', 'Duration (min)', 'Avg HR (BPM)', 'RMSSD (ms)']
        );

        // --- Section 3: Sleep Data ---
        reportHtml += renderSection(
            '3. Sleep Patterns',
            sleepData.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
            'sleep_interpretation',
            ['date', 'durationHours', 'quality', 'awakenings'],
            ['Date', 'Duration (hrs)', 'Quality', 'Awakenings']
        );

        // --- Section 4: Nutrition Programs ---
        const assignedProgramsWithNames = assignedNutritionPrograms.map(ap => {
            const program = nutritionPrograms.find(np => np.id === ap.programId);
            return {
                'Program Name': program?.name || 'N/A',
                'Assigned Date': ap.assignedDate,
                'Status': ap.status
            };
        });
        reportHtml += renderSection(
            '4. Nutrition Programs',
            assignedProgramsWithNames,
            'nutrition_interpretation',
            ['Program Name', 'Assigned Date', 'Status']
        );

        // --- Section 5: Test Protocols ---
        reportHtml += renderSection(
            '5. Test Results',
            testProtocols.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
            'tests_interpretation',
            ['name', 'date', 'result'],
            ['Test Name', 'Date', 'Result']
        );

        // --- Section 6: Logs & Activity ---
        reportHtml += renderSection(
            '6. Recent Activity Logs',
            logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5),
            'logs_interpretation',
            ['timestamp', 'type', 'description'],
            ['Timestamp', 'Type', 'Description']
        );

        // --- Section 7: Member Progress (from memberActivity) ---
        reportHtml += renderSection(
            '7. Member Progress Overview',
            memberActivity.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
            'progress_interpretation',
            ['date', 'type', 'value', 'unit'],
            ['Date', 'Activity Type', 'Value', 'Unit']
        );

        // --- Section 8: Custom Measurements ---
        reportHtml += renderSection(
            '8. Custom Measurements',
            customMeasurements.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
            'custom_measurements_interpretation',
            ['date', 'name', 'value', 'unit'],
            ['Date', 'Measurement Name', 'Value', 'Unit']
        );

        // --- Section 9: Training Schedules (Training Days, Weeks, Blocks, Configured Sessions) ---
        reportHtml += `<h4 class="text-lg font-semibold text-blue-300 mt-6 mb-3">9. Training Schedules</h4>`;
        if (trainingDays.length > 0 || trainingWeeks.length > 0 || trainingBlocks.length > 0 || configuredSessions.length > 0) {
            reportHtml += `<p class="text-gray-300 text-base leading-relaxed mb-2">Detailed breakdown of planned training schedules.</p>`;
            if (trainingDays.length > 0) {
                reportHtml += `<h5 class="text-md font-semibold text-gray-200 mt-4 mb-2">Training Days:</h5>`;
                reportHtml += `<div class="mb-4">${renderGenericTable(trainingDays, null, ['date', 'notes'], ['Date', 'Notes'])}</div>`;
            }
            if (trainingWeeks.length > 0) {
                reportHtml += `<h5 class="text-md font-semibold text-gray-200 mt-4 mb-2">Training Weeks:</h5>`;
                reportHtml += `<div class="mb-4">${renderGenericTable(trainingWeeks, null, ['startDate', 'endDate', 'goal'], ['Start Date', 'End Date', 'Goal'])}</div>`;
            }
            if (trainingBlocks.length > 0) {
                reportHtml += `<h5 class="text-md font-semibold text-gray-200 mt-4 mb-2">Training Blocks:</h5>`;
                reportHtml += `<div class="mb-4">${renderGenericTable(trainingBlocks, null, ['name', 'type', 'duration'], ['Name', 'Type', 'Duration'])}</div>`;
            }
            if (configuredSessions.length > 0) {
                reportHtml += `<h5 class="text-md font-semibold text-gray-200 mt-4 mb-2">Configured Sessions:</h5>`;
                reportHtml += `<div class="mb-4">${renderGenericTable(configuredSessions, null, ['name', 'sport', 'difficulty'], ['Name', 'Sport', 'Difficulty'])}</div>`;
            }
            reportHtml += renderInterpretationText(null, 'training_schedules_interpretation');
        } else {
            reportHtml += `<p class="text-gray-400">No training schedule data available.</p>`;
        }

        // --- Section 10: Lessons ---
        reportHtml += renderSection(
            '10. Lessons Overview',
            lessons.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
            'lessons_interpretation',
            ['date', 'name', 'instructor', 'duration'],
            ['Date', 'Lesson Name', 'Instructor', 'Duration (min)']
        );

        // --- Section 11: Gym Sections ---
        reportHtml += renderSection(
            '11. Gym Sections',
            gymSections,
            'gym_sections_interpretation',
            ['name', 'capacity', 'currentOccupancy'],
            ['Section Name', 'Capacity', 'Current Occupancy']
        );


        contentDiv.innerHTML = reportHtml;

        // After rendering, ensure tables are styled correctly (they use the generic table renderer's internal styling)
        contentDiv.querySelectorAll('table').forEach(table => {
            table.classList.add('bg-gray-900', 'text-gray-200', 'rounded-lg', 'overflow-hidden');
            table.querySelectorAll('th, td').forEach(cell => {
                cell.classList.add('px-4', 'py-2');
            });
        });

    } catch (error) {
        console.error("Error generating comprehensive user report:", error);
        contentDiv.innerHTML = `<p class="text-red-400">Error loading data for comprehensive report: ${error.message}</p>`;
        // showNotification("Failed to generate comprehensive report.", 'error'); // Notifications are handled in reportsView.js
    }
}


export function renderComprehensiveUserReportText(contentDivId) {
    renderInterpretationText(contentDivId, 'comprehensive_user_report');
}

/**
 * Renders a generic text explanation for various reports.
 * @param {string|null} contentDivId - The ID of the content div, or null to return HTML string.
 * @param {string} type - The type of report (e.g., 'user_profile_interpretation', 'training_interpretation').
 */
export function renderInterpretationText(contentDivId, type) {
    let title = '';
    let description = '';
    let advice = '';
    let strengths = '';
    let weaknesses = '';
    let comparisons = '';

    switch (type) {
        case 'user_profile_interpretation':
            title = 'User Profile & Biometrics Interpretation';
            description = 'This section provides an overview of the user\'s fundamental biometric data and personal settings. These metrics are crucial for tailoring training and nutrition plans.';
            strengths = 'Well-documented biometrics allow for precise goal setting and personalized program design.';
            weaknesses = 'Inaccurate or outdated biometric data can lead to suboptimal recommendations.';
            comparisons = 'Biometric data can be compared against population averages or personal historical data to track changes over time.';
            advice = 'Regularly update biometric data to ensure accuracy in personalized recommendations. Consider how changes in weight, body composition, or activity levels might influence other health metrics.';
            break;
        case 'training_interpretation':
            title = 'Training Sessions Interpretation';
            description = 'An analysis of recent training sessions, highlighting consistency, intensity, and performance trends. This helps in understanding the user\'s training load and adaptation.';
            strengths = 'Consistent training and progressive overload indicate good discipline and adaptation.';
            weaknesses = 'Inconsistent attendance or lack of progressive challenge may hinder progress.';
            comparisons = 'Compare training volume and intensity week-over-week or month-over-month to identify trends. Compare against prescribed plan to assess adherence.';
            advice = 'Review training consistency and intensity. If performance is stagnating, consider adjusting training variables like volume, intensity, or recovery periods. Celebrate consistent effort!';
            break;
        case 'sleep_interpretation':
            title = 'Sleep Patterns Interpretation';
            description = 'Sleep is fundamental for recovery and performance. This section summarizes sleep duration and quality, key indicators of overall well-being.';
            strengths = 'Adequate sleep duration and high sleep quality support optimal recovery and cognitive function.';
            weaknesses = 'Chronic sleep deprivation can impair recovery, increase injury risk, and negatively impact performance and mood.';
            comparisons = 'Compare sleep duration and quality against recommended guidelines (7-9 hours for adults) and personal baseline. Look for correlations with training performance or stress levels.';
            advice = 'Prioritize sufficient and quality sleep. Aim for 7-9 hours per night. If sleep quality is poor, consider sleep hygiene practices like a consistent sleep schedule, a dark and quiet room, and avoiding screens before bed.';
            break;
        case 'nutrition_interpretation':
            title = 'Nutrition Programs Interpretation';
            description = 'This section outlines the user\'s assigned nutrition programs and their adherence. Nutrition plays a vital role in supporting training goals and overall health.';
            strengths = 'Consistent adherence to a balanced nutrition plan accelerates progress towards fitness and health goals.';
            weaknesses = 'Poor adherence or an imbalanced diet can impede recovery, energy levels, and body composition goals.';
            comparisons = 'Assess adherence to prescribed macros/calories. Compare dietary intake with energy expenditure from training to ensure adequate fueling.';
            advice = 'Adherence to nutrition plans is key for results. If struggling, seek support from a nutritionist or coach to find sustainable strategies. Ensure your nutrition aligns with your training demands.';
            break;
        case 'tests_interpretation':
            title = 'Test Results Interpretation';
            description = 'An overview of performance and physiological test results. These tests provide objective measures of fitness components like strength, endurance, or specific skills.';
            strengths = 'Improved test scores demonstrate effective training and physiological adaptation.';
            weaknesses = 'Stagnant or declining test results may indicate a need for program adjustments or addressing underlying issues (e.g., recovery, nutrition).';
            comparisons = 'Compare current test results against previous tests, personal bests, and age/gender-matched norms to track progress and identify areas for improvement.';
            advice = 'Analyze test results to identify areas of strength and weakness. Use this data to set new, specific, measurable, achievable, relevant, and time-bound (SMART) goals for future training cycles.';
            break;
        case 'logs_interpretation':
            title = 'Recent Activity Logs Interpretation';
            description = 'A summary of recent interactions and activities recorded in the system. This can include personal notes, system events, or communication logs.';
            strengths = 'Detailed logs provide a clear history of user engagement and support, facilitating personalized coaching and problem-solving.';
            weaknesses = 'Incomplete logs can lead to missed opportunities for support or misinterpretation of user needs.';
            comparisons = 'Review log frequency and content to understand user activity patterns and engagement levels over time.';
            advice = 'Regularly review logs to track progress, identify patterns, and ensure all interactions are documented. This provides valuable context for overall user engagement.';
            break;
        case 'progress_interpretation':
            title = 'Member Progress Interpretation';
            description = 'This section tracks key progress indicators over time, which could include changes in strength, endurance, body composition, or skill acquisition.';
            strengths = 'Consistent positive trends in progress metrics indicate effective training and adherence.';
            weaknesses = 'Plateaus or regressions in progress require re-evaluation of the training plan, recovery, or external factors.';
            comparisons = 'Compare progress metrics against initial baselines, personal goals, and peer groups (anonymously) to provide motivation and context.';
            advice = 'Celebrate progress, no matter how small! If progress has stalled, re-evaluate training, nutrition, and recovery. Consistency over perfection is often the key to long-term success.';
            break;
        case 'custom_measurements_interpretation':
            title = 'Custom Measurements Interpretation';
            description = 'This section provides an overview of custom measurements recorded for the user. These can be any specific metrics relevant to their unique goals or conditions.';
            strengths = 'Flexibility to track highly specific metrics tailored to individual needs.';
            weaknesses = 'Interpretation relies heavily on the context and purpose of each custom measurement.';
            comparisons = 'Compare custom measurements over time to identify trends or responses to specific interventions.';
            advice = 'Ensure custom measurements are consistently recorded and relevant to current goals. Use them to fine-tune personalized programs.';
            break;
        case 'training_schedules_interpretation':
            title = 'Training Schedules Interpretation';
            description = 'This section details the planned training schedules, including daily, weekly, and block-based plans, as well as configured sessions. It reflects the structured approach to the user\'s training.';
            strengths = 'A well-structured and adhered-to schedule promotes consistent progress and prevents overtraining/undertraining.';
            weaknesses = 'Lack of adherence or an overly rigid schedule can lead to frustration or burnout.';
            comparisons = 'Compare planned vs. actual training load and adherence. Analyze how schedule changes impact performance and recovery.';
            advice = 'Adhere to the training schedule as much as possible, but be flexible when needed for recovery or unexpected events. Regular communication with a coach can help optimize the schedule.';
            break;
        case 'lessons_interpretation':
            title = 'Lessons Overview Interpretation';
            description = 'This section summarizes the lessons attended by the user, providing insights into their participation in group or individual classes.';
            strengths = 'Consistent lesson attendance indicates engagement and a commitment to structured learning or group activities.';
            weaknesses = 'Infrequent attendance might suggest scheduling conflicts or a mismatch with lesson offerings.';
            comparisons = 'Track attendance rates over time. Compare participation across different lesson types or instructors.';
            advice = 'Actively participate in lessons to maximize learning and skill development. Provide feedback on lesson content to ensure it meets your needs.';
            break;
        case 'gym_sections_interpretation':
            title = 'Gym Sections Overview Interpretation';
            description = 'This section provides an overview of the gym sections, including their capacity and current occupancy. While not directly user-specific, it offers context on the training environment.';
            strengths = 'Understanding gym section usage can help in planning optimal training times and avoiding overcrowding.';
            weaknesses = 'High occupancy during preferred training times can impact workout quality.';
            comparisons = 'Compare occupancy rates across different times of day or days of the week to find less busy periods.';
            advice = 'Utilize less busy times or explore alternative sections to optimize your training experience. Provide feedback on facility usage if consistent issues arise.';
            break;
        case 'comprehensive_user_report':
            title = 'Comprehensive User Report Overview';
            description = 'This report integrates various data points to provide a holistic view of the user\'s health and fitness journey. It aims to identify interdependencies between different aspects like training, sleep, and nutrition.';
            strengths = 'Provides a unified perspective, allowing for identification of overarching trends and correlations that single-metric reports might miss.';
            weaknesses = 'Requires careful interpretation to avoid drawing causal links where only correlations exist. Data quality across all integrated sources is critical.';
            comparisons = 'Individual sections can be compared against historical data for the user, or aggregated anonymous data from similar user groups.';
            advice = 'Use this report to gain a deeper understanding of the user\'s overall well-being. Focus on areas where multiple metrics suggest a need for intervention (e.g., poor sleep AND low training performance). Consider consulting with a multidisciplinary team (coach, nutritionist, sleep specialist) for tailored interventions.';
            break;
        case 'all_user_settings_text':
            title = 'All User Settings Report';
            description = 'This report provides a comprehensive list of all user profiles and their associated settings stored in the system. It is useful for administrative overview and data verification.';
            strengths = 'Centralized view of all user configurations, facilitating quick audits and bulk management.';
            weaknesses = 'May contain sensitive personal data, requiring strict access controls. Data accuracy depends on user input.';
            comparisons = 'Can be used to identify common settings or demographic distributions among users.';
            advice = 'Ensure user settings are accurate and up-to-date for personalized services. Regularly review this data for consistency and completeness.';
            break;
        case 'all_members_text':
            title = 'All Members Report';
            description = 'This report lists all registered members of the gym, including their contact details and membership status. It serves as a central registry for member management.';
            strengths = 'Provides a clear, sortable list of all members for administrative tasks, communication, and membership tracking.';
            weaknesses = 'Does not include detailed activity or financial data, requiring cross-referencing with other reports.';
            comparisons = 'Membership growth can be tracked over time. Member demographics can be compared to target audience profiles.';
            advice = 'Use this report to manage member demographics, contact information, and to identify membership trends. Maintain data accuracy for effective communication.';
            break;
        case 'all_subscriptions_text':
            title = 'All Subscriptions Report';
            description = 'This report provides a detailed overview of all subscription plans, including active, expired, and pending subscriptions. It helps in managing recurring revenue and member access.';
            strengths = 'Essential for financial forecasting, identifying popular subscription tiers, and managing member access rights.';
            weaknesses = 'May not capture one-time purchases or other revenue streams, giving an incomplete financial picture on its own.';
            comparisons = 'Analyze subscription trends (e.g., monthly new subscriptions, churn rate). Compare revenue generated by different plans.';
            advice = 'Monitor subscription statuses to ensure smooth operations and revenue flow. Identify popular plans and potential churn risks. Consider offering incentives for renewals.';
            break;
        case 'all_financials_text':
            title = 'All Financials Report';
            description = 'This report summarizes all financial transactions within the system, including income and expenses. It is crucial for financial oversight and budgeting.';
            strengths = 'Provides a transparent view of all financial inflows and outflows, critical for budgeting, tax preparation, and profitability analysis.';
            weaknesses = 'Requires careful categorization of transactions to provide actionable insights. May not include external operational costs not managed through the CRM.';
            comparisons = 'Compare income vs. expenses over different periods. Analyze spending patterns to identify areas for cost reduction or investment.';
            advice = 'Regularly review financial reports to track profitability, manage expenses, and identify areas for financial optimization. Ensure all transactions are accurately recorded.';
            break;
        default:
            title = 'General Interpretation';
            description = 'No specific interpretation available for this data type.';
            strengths = 'Data provides objective insights.';
            weaknesses = 'Interpretation requires context.';
            comparisons = 'Trends can be identified by comparing data points.';
            advice = 'Consult with a professional for personalized insights.';
    }

    const htmlContent = `
        <div class="bg-gray-700 rounded-lg p-4 shadow-md mt-4">
            <h4 class="text-lg font-semibold text-blue-300 mb-2">${title}</h4>
            <p class="text-gray-300 text-base leading-relaxed mb-2"><strong>Description:</strong> ${description}</p>
            ${strengths ? `<p class="text-gray-300 text-base leading-relaxed mb-2"><strong>Strengths:</strong> ${strengths}</p>` : ''}
            ${weaknesses ? `<p class="text-gray-300 text-base leading-relaxed mb-2"><strong>Weaknesses:</strong> ${weaknesses}</p>` : ''}
            ${comparisons ? `<p class="text-gray-300 text-base leading-relaxed mb-2"><strong>Comparisons:</strong> ${comparisons}</p>` : ''}
            <p class="text-gray-200 text-base leading-relaxed"><strong>Advice:</strong> ${advice}</p>
            <p class="text-gray-400 text-sm italic mt-2">Note: For personalized comparisons, detailed strengths/weaknesses, and advanced advice, an AI model or expert human analysis is typically required.</p>
        </div>
    `;
    // If contentDivId is null, return the HTML string, otherwise render to the div
    if (contentDivId === null) {
        return htmlContent;
    } else {
        const contentDiv = document.getElementById(contentDivId);
        if (contentDiv) {
            contentDiv.innerHTML = htmlContent;
        } else {
            console.error(`Content div with ID '${contentDivId}' not found for interpretation text.`);
        }
    }
}

export function renderUserSettingsText(contentDivId) {
    renderInterpretationText(contentDivId, 'all_user_settings_text');
}

export function renderMembersText(contentDivId) {
    renderInterpretationText(contentDivId, 'all_members_text');
}

export function renderSubscriptionsText(contentDivId) {
    renderInterpretationText(contentDivId, 'all_subscriptions_text');
}

export function renderFinancialsText(contentDivId) {
    renderInterpretationText(contentDivId, 'all_financials_text');
}
