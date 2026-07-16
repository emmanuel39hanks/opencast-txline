"use client";

import * as React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Chart.js requires explicit registration of every element + plugin used.
// We do it once at module load — every chart in the app gets the same set.
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
);

interface Point {
  /** Unix ms or seconds — only used for the X-axis label tooltip. */
  t?: number;
  /** YES probability, 0–1. */
  yes: number;
}

interface Props {
  data: Point[];
  /** Used for the single-line fallback when `data` is empty. */
  fallbackYes?: number;
  className?: string;
  /** Show tooltip on hover. Disabled by default for compact previews. */
  tooltip?: boolean;
  /** Override the line + fill colour. Defaults to Punt ink + lime. */
  lineColour?: string;
  fillColour?: string;
}

/**
 * Reusable Punt-styled Chart.js sparkline. Renders the YES probability
 * over time as a smooth area chart with a glowing endpoint dot.
 *
 * The chart hides axes/gridlines + scales tightly to its container so it
 * fits anywhere a hand-rolled SVG used to.
 */
export function PriceSparkline({
  data,
  fallbackYes = 0.5,
  className,
  tooltip = false,
  lineColour = "#0A0A0A",
  fillColour = "rgba(201, 244, 104, 0.45)",
}: Props) {
  const points = data.length
    ? data
    : [
        { yes: fallbackYes },
        { yes: fallbackYes },
      ];

  // Labels are positional indexes — we don't need real timestamps for a
  // sparkline; tooltips can pretty-print elsewhere if needed.
  const chartData: ChartData<"line"> = React.useMemo(
    () => ({
      labels: points.map((_, i) => String(i)),
      datasets: [
        {
          data: points.map((p) => Math.max(0, Math.min(1, p.yes))),
          borderColor: lineColour,
          borderWidth: 1.5,
          backgroundColor: fillColour,
          fill: "origin",
          tension: 0.35,
          pointRadius: (ctx) =>
            ctx.dataIndex === points.length - 1 ? 4 : 0,
          pointBackgroundColor: "#C9F468",
          pointBorderColor: "#0A0A0A",
          pointBorderWidth: 1.5,
          pointHoverRadius: 5,
        },
      ],
    }),
    [points, lineColour, fillColour],
  );

  const options: ChartOptions<"line"> = React.useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: tooltip
          ? {
              backgroundColor: "#0A0A0A",
              titleColor: "#F2F2EE",
              bodyColor: "#F2F2EE",
              borderColor: "#0A0A0A",
              borderWidth: 0,
              padding: 8,
              displayColors: false,
              callbacks: {
                title: () => "",
                label: (item) =>
                  `${Math.round(Number(item.raw) * 100)}% Yes`,
              },
            }
          : { enabled: false },
      },
      interaction: {
        intersect: false,
        mode: "index" as const,
      },
      scales: {
        x: { display: false },
        y: {
          display: false,
          min: 0,
          max: 1,
        },
      },
      elements: {
        line: { capBezierPoints: true },
      },
      animation: { duration: 350 },
    }),
    [tooltip],
  );

  return (
    <div className={className}>
      <Line data={chartData} options={options} />
    </div>
  );
}
