"use client";

import { useState } from "react";
import type { TopicMasteryItem, TopicStatus } from "@/types/dashboard";

interface TopicMasteryCardProps {
  topics: TopicMasteryItem[];
  searchQuery: string;
}

const STATUS_CONFIG: Record<
  TopicStatus,
  { label: string; badgeClass: string; barClass: string }
> = {
  weak: {
    label: "Weak",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
    barClass: "bg-rose-500",
  },
  medium: {
    label: "Medium",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    barClass: "bg-amber-500",
  },
  strong: {
    label: "Strong",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    barClass: "bg-emerald-500",
  },
};

export function TopicMasteryCard({
  topics,
  searchQuery,
}: TopicMasteryCardProps) {
  const [filter, setFilter] = useState<"all" | TopicStatus>("all");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTopics = topics.filter((topic) => {
    const matchesStatus = filter === "all" || topic.status === filter;
    const matchesSearch =
      !normalizedQuery ||
      topic.name.toLowerCase().includes(normalizedQuery) ||
      topic.module.toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesSearch;
  });

  const filters: Array<{ id: "all" | TopicStatus; label: string }> = [
    { id: "all", label: "All" },
    { id: "weak", label: "Weak" },
    { id: "medium", label: "Medium" },
    { id: "strong", label: "Strong" },
  ];

  return (
    <section className="rounded-lg border border-slate-200/90 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Topic Mastery
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Estimated mastery from recent diagnostic accuracy
          </p>
        </div>

        <div
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
          role="tablist"
          aria-label="Filter topics by mastery status"
        >
          {filters.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {topics.length === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No learning data yet
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Upload study materials and complete your first diagnostic quiz.
          </p>
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No matching topics found
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Try clearing your search query or switching the mastery filter.
          </p>
          {filter !== "all" ? (
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Show all topics
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {filteredTopics.slice(0, 6).map((topic) => {
            const cfg = STATUS_CONFIG[topic.status];
            return (
              <li key={topic.id} className="py-3 first:pt-1 last:pb-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-900">
                      {topic.name}
                    </p>
                    <p className="text-[11.5px] text-slate-500">
                      {topic.module} · {topic.questionsAnswered} questions ·{" "}
                      {topic.lastPracticed}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span
                      className={`rounded border px-2 py-0.5 text-[11px] font-medium ${cfg.badgeClass}`}
                    >
                      {cfg.label}
                    </span>
                    <span className="w-9 text-right text-xs font-semibold text-slate-800 tabular-nums">
                      {topic.mastery}%
                    </span>
                  </div>
                </div>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${cfg.barClass}`}
                    style={{ width: `${topic.mastery}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

