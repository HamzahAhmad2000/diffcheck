import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const DEFAULT_COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
  '#9966FF', '#FF9F40', '#E7E9ED', '#8A8A8A'
];

const RankingDistributionChart = ({ items, matrix, totalResponses = 0, showPercentages = false }) => {
  if (!items || items.length === 0 || !matrix) return null;
  const numRanks = items.length;

  const datasets = Array.from({ length: numRanks }, (_, idx) => {
    const rank = idx + 1;
    const dataCounts = items.map(it => matrix[it]?.[rank] ?? 0);
    const data = showPercentages && totalResponses > 0
      ? dataCounts.map(c => (c * 100) / totalResponses)
      : dataCounts;
    return {
      label: `Rank ${rank}`,
      data,
      backgroundColor: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
    };
  });

  const data = {
    labels: items,
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom' },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw;
            const count = showPercentages
              ? matrix[context.label]?.[context.datasetIndex + 1] ?? 0
              : value;
            const prefix = showPercentages ? `${value.toFixed(1)}%` : count;
            return `${context.dataset.label}: ${prefix}`;
          },
        },
      },
    },
    scales: {
      x: { stacked: true },
      y: {
        stacked: true,
        beginAtZero: true,
        title: {
          display: true,
          text: showPercentages ? 'Percentage (%)' : 'Count',
        },
      },
    },
  };

  return (
    <div style={{ height: '350px', position: 'relative', margin: '20px 0' }}>
      <Bar data={data} options={options} />
    </div>
  );
};

export default RankingDistributionChart;
