// src/AnalyticsComponents/exportChart.js
import  Chart  from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels'; // Import the plugin

/**
 * Creates a high-resolution PNG image from a Chart.js configuration.
 * @param {object} config - Chart configuration.
 * @param {string} config.type - Chart type (e.g., 'bar', 'pie').
 * @param {object} config.data - Chart data object.
 * @param {object} config.options - Chart options object.
 * @param {number} [config.width=1200] - Canvas width for rendering.
 * @param {number} [config.height=700] - Canvas height for rendering. (Adjusted for better aspect ratio)
 * @returns {Promise<string>} - A promise resolving with the base64 PNG data URL.
 */
export function createChartImage({ type, data, options, width = 1200, height = 700 }) {
  // Register the datalabels plugin locally for this export context
  Chart.register(ChartDataLabels);

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // Style canvas for off-screen rendering to avoid layout shifts
    canvas.style.position = 'absolute';
    canvas.style.left = '-9999px';
    canvas.style.top = '-9999px';

    document.body.appendChild(canvas); // Append off-screen
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        document.body.removeChild(canvas);
        return reject(new Error("Failed to get canvas context"));
    }

    // Ensure background is white for non-transparent export
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let chart = null;
    try {
        chart = new Chart(ctx, {
            type,
            data,
            options: {
                ...options,
                animation: false, // Disable animation for static export
                responsive: false, // Ensure fixed size rendering
                maintainAspectRatio: false // Allow custom dimensions
            }
        });

        // Use requestAnimationFrame to ensure rendering completes before capturing
        // Double frame can help ensure paints complete in some browsers/complex charts
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                try {
                    const img = canvas.toDataURL('image/png', 1.0); // Use quality 1.0
                    if (chart) {
                        chart.destroy();
                    }
                    document.body.removeChild(canvas);
                    resolve(img);
                } catch (e) {
                    console.error("Error converting canvas to data URL:", e);
                     if (chart) chart.destroy();
                    document.body.removeChild(canvas);
                    reject(new Error("Failed to export chart image"));
                }
            });
        });

    } catch (chartError) {
         console.error("Error creating Chart instance:", chartError);
         if (chart) chart.destroy(); // Attempt cleanup
         document.body.removeChild(canvas);
         Chart.unregister(ChartDataLabels); // Unregister on error
         reject(new Error("Failed to initialize chart for export"));
    }
  });
}