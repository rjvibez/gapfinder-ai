"use client";

import { useState } from "react";
import type { QuizAttempt } from "@/types/dashboard";

interface LearningProgressChartProps {
  attempts: QuizAttempt[];
}

export function LearningProgressChart({ attempts }: LearningProgressChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(
    attempts.length > 0 ? attempts.length - 1 : null
  );

  if (attempts.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200/90 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Learning Progress
        </h2>
        <div className="mt-6 flex h-52 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <p className="text-sm font-medium text-slate-700">
            No learning data yet
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Upload study materials and complete your first diagnostic quiz.
          </p>
        </div>
      </section>
    );
  }

  const width = 640;
  const height = 220;
  const padLeft = 36;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 32;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const minY = 0;
  const maxY = 100;

  const points = attempts.map((attempt, index) => {
    const x =
      attempts.length === 1
        ? padLeft + plotWidth / 2
        : padLeft + (index / (attempts.length - 1)) * plotWidth;
    const clampedScore = Math.max(minY, Math.min(maxY, attempt.score));
    const y =
      padTop + ((maxY - clampedScore) / (maxY - minY)) * plotHeight;
    return { x, y, attempt };
  });

  const linePath = points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(
    padTop + plotHeight
  ).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + plotHeight).toFixed(1)} Z`;

  const yTicks = [0, 20, 40, 60, 80, 100];
  const activePoint =
    hoveredIndex !== null && points[hoveredIndex]
      ? points[hoveredIndex]
      : points[points.length - 1];

  const firstScore = attempts[0].score;
  const latestScore = attempts[attempts.length - 1].score;
  const overallGain = latestScore - firstScore;

  return (
    <section className="rounded-lg border border-slate-200/90 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Learning Progress
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Accuracy across your last {attempts.length} diagnostic quiz attempts
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-right">
            <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Net Gain
            </span>
            <span className="text-xs font-semibold text-indigo-700 tabular-nums">
              {overallGain >= 0 ? "+" : ""}
              {overallGain}% overall
            </span>
          </div>
        </div>
      </div>

      {/* Selected point summary bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-indigo-600" />
          <span className="font-medium text-slate-900">
            {activePoint.attempt.title}
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">{activePoint.attempt.date}</span>
        </div>
        <div className="flex items-center gap-3 tabular-nums">
          <span className="font-semibold text-slate-900">
            {activePoint.attempt.score}% score
          </span>
          <span
            className={`font-medium ${
              activePoint.attempt.improvement > 0
                ? "text-emerald-600"
                : activePoint.attempt.improvement < 0
                ? "text-rose-600"
                : "text-slate-500"
            }`}
          >
            {activePoint.attempt.improvement > 0
              ? `+${activePoint.attempt.improvement}%`
              : activePoint.attempt.improvement < 0
              ? `${activePoint.attempt.improvement}%`
              : "Baseline"}
          </span>
        </div>
      </div>

      {/* Responsive SVG Chart */}
      <div className="mt-3 w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-52 w-full overflow-visible"
          role="img"
          aria-label="Line chart of quiz accuracy over recent attempts"
        >
          <defs>
            <linearGradient id="progressAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal gridlines */}
          {yTicks.map((tick) => {
            const y =
              padTop + ((maxY - tick) / (maxY - minY)) * plotHeight;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray={tick === 0 ? undefined : "3 3"}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] tabular-nums"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#progressAreaFill)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#4F46E5"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Vertical guide on active point */}
          <line
            x1={activePoint.x}
            y1={padTop}
            x2={activePoint.x}
            y2={padTop + plotHeight}
            stroke="#C7D2FE"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          {/* Data points & X labels */}
          {points.map((pt, index) => {
            const isActive =
              hoveredIndex !== null
                ? hoveredIndex === index
                : index === points.length - 1;

            return (
              <g
                key={pt.attempt.id}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(index)}
                onFocus={() => setHoveredIndex(index)}
                tabIndex={0}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={14}
                  fill="transparent"
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isActive ? 5 : 3.5}
                  fill={isActive ? "#4F46E5" : "#FFFFFF"}
                  stroke="#4F46E5"
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <text
                  x={pt.x}
                  y={height - 8}
                  textAnchor="middle"
                  className={`text-[10px] ${
                    isActive
                      ? "fill-indigo-700 font-semibold"
                      : "fill-slate-400"
                  }`}
                >
                  {pt.attempt.shortDate}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

