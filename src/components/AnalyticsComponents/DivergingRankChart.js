import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const DEFAULT_COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
  '#9966FF', '#FF9F40', '#E7E9ED', '#8A8A8A'
];

const DivergingRankChart = ({ items, matrix, totalResponses = 0 }) => {
  if (!items || items.length === 0 || !matrix) return null;
  const numRanks = items.length;

  const datasets = Array.from({ length: numRanks }, (_, idx) => {
    const rank = idx + 1;
    const counts = items.map(item => matrix[item]?.[rank] ?? 0);
    const percentages = totalResponses > 0
      ? counts.map(c => (c * 100) / totalResponses)
      : counts.map(() => 0);
    return {
      label: `Rank ${rank}`,
      data: percentages,
      backgroundColor: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
      stack: 'stack'
    };
  });

  const data = { labels: items, datasets };

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true, max: 100, title: { display: true, text: 'Percentage (%)' } },
      y: { stacked: true }
    },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const item = ctx.label;
            const rankPos = ctx.datasetIndex + 1;
            const count = matrix[item]?.[rankPos] ?? 0;
            const pct = totalResponses > 0 ? ((count * 100) / totalResponses).toFixed(1) : '0';
            return `${ctx.dataset.label}: ${pct}% (${count})`;
          }
        }
      }
    }
  };

  return (
    <div style={{ height: '400px', position: 'relative', margin: '20px 0' }}>
      <Bar data={data} options={options} />
    </div>
  );
};

export default DivergingRankChart;
