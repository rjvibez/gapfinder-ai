"use client";

import type { RevisionTask } from "@/types/dashboard";
import { CheckIcon, ClockIcon } from "@/components/icons";

interface RevisionPlanCardProps {
  tasks: RevisionTask[];
  searchQuery: string;
  onToggleTask: (taskId: string) => void;
  onResetTasks: () => void;
}

export function RevisionPlanCard({
  tasks,
  searchQuery,
  onToggleTask,
  onResetTasks,
}: RevisionPlanCardProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleTasks = tasks.filter(
    (task) =>
      !normalizedQuery ||
      task.title.toLowerCase().includes(normalizedQuery) ||
      task.topicName.toLowerCase().includes(normalizedQuery)
  );

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalMinutes = tasks.reduce((acc, t) => acc + t.durationMinutes, 0);
  const remainingMinutes = tasks
    .filter((t) => !t.completed)
    .reduce((acc, t) => acc + t.durationMinutes, 0);

  return (
    <section className="rounded-lg border border-slate-200/90 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Today&apos;s Revision Plan
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {completedCount} of {tasks.length} tasks done · {remainingMinutes}{" "}
            min remaining (of {totalMinutes} min)
          </p>
        </div>

        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 tabular-nums">
          {Math.round((completedCount / Math.max(tasks.length, 1)) * 100)}%
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No learning data yet
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Upload study materials and complete your first diagnostic quiz.
          </p>
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No revision tasks match your filter
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Clear your search or restore the default study schedule.
          </p>
          <button
            type="button"
            onClick={onResetTasks}
            className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset today&apos;s plan
          </button>
        </div>
      ) : (
        <ol className="relative mt-5 space-y-3 before:absolute before:bottom-3 before:left-[52px] before:top-3 before:w-px before:bg-slate-200">
          {visibleTasks.map((task) => {
            const priorityClass =
              task.priority === "High"
                ? "text-rose-700 bg-rose-50 border-rose-200"
                : task.priority === "Medium"
                ? "text-amber-700 bg-amber-50 border-amber-200"
                : "text-slate-600 bg-slate-100 border-slate-200";

            return (
              <li key={task.id} className="relative flex items-start gap-3">
                <span className="w-10 shrink-0 pt-2 text-right font-mono text-[11px] font-medium text-slate-400 tabular-nums">
                  {task.timeSlot}
                </span>

                <button
                  type="button"
                  onClick={() => onToggleTask(task.id)}
                  aria-label={`Mark "${task.title}" as ${
                    task.completed ? "incomplete" : "complete"
                  }`}
                  className={`relative z-10 mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    task.completed
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 bg-white text-transparent hover:border-indigo-500"
                  }`}
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                </button>

                <div
                  className={`flex-1 rounded-lg border px-3.5 py-2.5 transition-colors ${
                    task.completed
                      ? "border-slate-100 bg-slate-50/70"
                      : "border-slate-200/90 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p
                      className={`text-[13px] font-medium ${
                        task.completed
                          ? "text-slate-400 line-through"
                          : "text-slate-900"
                      }`}
                    >
                      {task.title}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 tabular-nums">
                      <ClockIcon className="h-3 w-3 text-slate-400" />
                      {task.durationMinutes}m
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-500">
                      {task.topicName}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[11px] font-medium text-slate-500">
                      {task.type}
                    </span>
                    <span
                      className={`ml-auto rounded border px-1.5 py-0.5 text-[10px] font-medium ${priorityClass}`}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

