"use client";

import { useMemo, useState } from "react";
import type {
  NavSectionId,
  RevisionTask,
  TopicMasteryItem,
} from "@/types/dashboard";
import { CheckIcon, ClockIcon } from "@/components/icons";

interface RevisionPlannerViewProps {
  tasks: RevisionTask[];
  topics?: TopicMasteryItem[];
  searchQuery: string;
  onToggleTask: (taskId: string) => void;
  onNavigate?: (id: NavSectionId) => void;
  onSelectTopicForQuiz?: (topicId: string) => void;
  onRefresh?: () => void;
}

type TaskStatusFilter = "all" | "pending" | "completed";

export function RevisionPlannerView({
  tasks,
  topics = [],
  searchQuery,
  onToggleTask,
  onNavigate,
  onSelectTopicForQuiz,
  onRefresh,
}: RevisionPlannerViewProps) {
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | RevisionTask["priority"]
  >("all");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [generating, setGenerating] = useState(false);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [plannerSuccess, setPlannerSuccess] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Topic lookup map for genuine recommendation reasons and mastery scores
  const topicMap = useMemo(() => {
    const map = new Map<string, TopicMasteryItem>();
    for (const t of topics) {
      map.set(t.id, t);
      // Also map by name lowercase as fallback
      map.set(t.name.toLowerCase(), t);
    }
    return map;
  }, [topics]);

  const handleGeneratePlan = async (replaceAll = false) => {
    setGenerating(true);
    setPlannerError(null);
    setPlannerSuccess(null);
    setShowResetConfirm(false);

    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Authentication session expired. Please sign in to your student account."
        );
      }

      const res = await fetch("/api/planner/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ replaceAll }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        tasksCount?: number;
      };

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "Failed to generate personalized revision tasks."
        );
      }

      setPlannerSuccess(
        replaceAll
          ? `Created a fresh revision schedule of ${data.tasksCount ?? 0} tasks prioritizing your weak and medium topics.`
          : `Updated revision plan with ${data.tasksCount ?? 0} prioritized tasks while preserving your previously completed tasks.`
      );
      onRefresh?.();
    } catch (err) {
      setPlannerError(
        err instanceof Error ? err.message : "Failed to generate plan."
      );
    } finally {
      setGenerating(false);
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Filter tasks by priority, status and search query
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesPriority =
        priorityFilter === "all" || t.priority === priorityFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && !t.completed) ||
        (statusFilter === "completed" && t.completed);

      const matchesSearch =
        !normalizedQuery ||
        t.title.toLowerCase().includes(normalizedQuery) ||
        t.topicName.toLowerCase().includes(normalizedQuery) ||
        (t.learningObjectives &&
          t.learningObjectives.some((obj) =>
            obj.toLowerCase().includes(normalizedQuery)
          ));

      return matchesPriority && matchesStatus && matchesSearch;
    });
  }, [tasks, priorityFilter, statusFilter, normalizedQuery]);

  // Today's vs Upcoming Tasks
  const todayTasks = useMemo(() => {
    return filteredTasks
      .filter((t) => !t.scheduledDate || t.scheduledDate === todayStr)
      .sort((a, b) => {
        // High priority first, then Medium, then Low
        const pOrder = { High: 1, Medium: 2, Low: 3 };
        return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
      });
  }, [filteredTasks, todayStr]);

  const upcomingTasks = useMemo(() => {
    return filteredTasks
      .filter((t) => t.scheduledDate && t.scheduledDate !== todayStr)
      .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""));
  }, [filteredTasks, todayStr]);

  // Summary Metrics
  const completedCount = tasks.filter((t) => t.completed).length;
  const pendingCount = tasks.filter((t) => !t.completed).length;
  const totalMinutes = tasks.reduce((sum, t) => sum + t.durationMinutes, 0);
  const remainingMinutes = tasks
    .filter((t) => !t.completed)
    .reduce((sum, t) => sum + t.durationMinutes, 0);

  const completionPct =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const handlePracticeQuiz = (topicId?: string) => {
    if (topicId && onSelectTopicForQuiz) {
      onSelectTopicForQuiz(topicId);
    }
    if (onNavigate) {
      onNavigate("diagnostic-quiz");
    }
  };

  // Helper to determine why a task is recommended
  const getRecommendationReason = (task: RevisionTask): string => {
    const topic =
      (task.topicId ? topicMap.get(task.topicId) : undefined) ||
      topicMap.get(task.topicName.toLowerCase());

    if (!topic) {
      return task.priority === "High"
        ? "High-priority revision block recommended to reinforce core topic concepts."
        : "Scheduled to maintain consistent study progress.";
    }

    const isAssessed =
      topic.questionsAnswered > 0 &&
      topic.lastPracticed !== "Never" &&
      topic.lastPracticed !== "Not practiced yet";

    if (!isAssessed) {
      return `Topic "${topic.name}" is not yet assessed. This task helps benchmark baseline understanding.`;
    }

    if (topic.errorPattern && task.type === "Error Log") {
      let patternText = topic.errorPattern;
      try {
        const parsed = JSON.parse(topic.errorPattern);
        if (parsed.summary) {
          patternText = parsed.summary;
        } else if (Array.isArray(parsed.gaps) && parsed.gaps.length > 0) {
          patternText = parsed.gaps.map((g: { concept: string }) => g.concept).join(", ");
        }
      } catch {}
      return `Targeted to resolve observed diagnostic error pattern: "${patternText}".`;
    }

    if (topic.mastery < 50) {
      return `Mastery is ${topic.mastery}% (Weak Tier). Targeted review is recommended before taking advanced diagnostic drills.`;
    }

    if (topic.mastery < 80) {
      return `Mastery is ${topic.mastery}% (Medium Tier). Focused practice will elevate this topic past the 80% Strong threshold.`;
    }

    return `Mastery is ${topic.mastery}% (Strong Tier). Scheduled for spaced recall to maintain long-term memory retention.`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Educational Explainer */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Personalized Revision Planner
              </h2>
              <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                Adaptive Study Engine
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl">
              Your revision plan is dynamically generated from actual diagnostic
              quiz results and syllabus learning objectives. It prioritizes weak
              topics first, then medium topics, pacing study blocks for optimal
              retention.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {tasks.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset Plan
              </button>
            ) : null}

            <button
              type="button"
              disabled={generating || topics.length === 0}
              onClick={() => void handleGeneratePlan(false)}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Generating Schedule...</span>
                </>
              ) : tasks.length > 0 ? (
                "Update Plan (Keep Completed)"
              ) : (
                "Generate Revision Plan"
              )}
            </button>
          </div>
        </div>

        {/* Informative Note: Grounded in Real Quiz Results */}
        <div className="mt-4 flex items-start gap-2.5 rounded-md border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-950">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <span className="font-semibold text-indigo-900">
              Diagnostic-Grounded Prioritization:
            </span>{" "}
            Tasks are scheduled based on verified quiz performance. Assessed
            weak topics (&lt;50%) are assigned high-priority review blocks;
            medium topics (50–79%) receive targeted recall; unassessed topics
            receive diagnostic checks without being penalized.
          </div>
        </div>

        {/* Success Alert */}
        {plannerSuccess ? (
          <div
            role="status"
            className="mt-4 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
          >
            <span>{plannerSuccess}</span>
            <button
              type="button"
              onClick={() => setPlannerSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900"
            >
              ✕
            </button>
          </div>
        ) : null}

        {/* Error Alert */}
        {plannerError ? (
          <div
            role="alert"
            className="mt-4 flex items-start justify-between rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
          >
            <span>{plannerError}</span>
            <button
              type="button"
              onClick={() => setPlannerError(null)}
              className="text-rose-700 hover:text-rose-900"
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>

      {/* 2. Empty State when no tasks exist */}
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-slate-200/90 bg-white p-8 text-center shadow-2xs sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-4">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h3 className="text-base font-semibold text-slate-900">
            No Revision Tasks Scheduled Yet
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-slate-500">
            The Revision Planner turns your diagnostic quiz results into a structured
            daily routine. It schedules 15 to 25-minute study blocks focused on your
            weakest areas first so you study with maximum efficiency.
          </p>

          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-3.5 sm:grid-cols-3 text-left">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-indigo-700">
                1. Upload Material
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Upload your course documents in My Materials.
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-indigo-700">
                2. Extract Topics
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Extract curriculum hierarchy in Topic Map.
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-indigo-700">
                3. Diagnostic Quizzes
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Take quizzes to calibrate your personalized plan.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {topics.length > 0 ? (
              <button
                type="button"
                disabled={generating}
                onClick={() => void handleGeneratePlan(false)}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate Revision Plan Now"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate?.("materials")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
                >
                  <span>Upload Study Materials</span>
                  <span>→</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.("topic-map")}
                  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Go to Topic Map
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* 3. Main Revision Planner Dashboard */
        <div className="space-y-4">
          {/* Filter Bar: Status & Priority Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
            {/* Status Tabs: All, Pending, Completed */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === "all"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                All Tasks ({tasks.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === "pending"
                    ? "bg-white text-indigo-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === "completed"
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Completed ({completedCount})
              </button>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Priority:</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {(["all", "High", "Medium", "Low"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriorityFilter(p)}
                    className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize transition-colors ${
                      priorityFilter === p
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Today's Tasks Timeline */}
            <div className="space-y-4 lg:col-span-8">
              <section className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Today&apos;s Revision Schedule
                    </h3>
                    <p className="text-xs text-slate-500">
                      {completedCount} of {tasks.length} tasks completed ·{" "}
                      {remainingMinutes}m study time remaining
                    </p>
                  </div>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 tabular-nums">
                    {completionPct}% Complete
                  </span>
                </div>

                {todayTasks.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">
                    No tasks matching the selected filter for today.
                  </p>
                ) : (
                  <ol className="relative mt-5 space-y-4 before:absolute before:bottom-3 before:left-[52px] before:top-3 before:w-px before:bg-slate-200">
                    {todayTasks.map((task) => {
                      const priorityClass =
                        task.priority === "High"
                          ? "text-rose-700 bg-rose-50 border-rose-200"
                          : task.priority === "Medium"
                          ? "text-amber-700 bg-amber-50 border-amber-200"
                          : "text-slate-600 bg-slate-100 border-slate-200";

                      const recommendationReason = getRecommendationReason(task);

                      return (
                        <li
                          key={task.id}
                          className="relative flex items-start gap-3"
                        >
                          {/* Time Slot */}
                          <span className="w-10 shrink-0 pt-2 text-right font-mono text-[11px] font-medium text-slate-400 tabular-nums">
                            {task.timeSlot}
                          </span>

                          {/* Checkbox with Undo capability */}
                          <button
                            type="button"
                            onClick={() => onToggleTask(task.id)}
                            aria-label={`Mark task as ${
                              task.completed ? "incomplete (undo)" : "complete"
                            }`}
                            className={`relative z-10 mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                              task.completed
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-300 bg-white text-transparent hover:border-indigo-500"
                            }`}
                          >
                            <CheckIcon className="h-3.5 w-3.5" />
                          </button>

                          {/* Task Card Content */}
                          <div
                            className={`flex-1 rounded-lg border p-4 transition-colors ${
                              task.completed
                                ? "border-slate-100 bg-slate-50/70"
                                : "border-slate-200/90 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p
                                className={`text-[13.5px] font-semibold ${
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

                            {/* Meta Badges */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-medium text-indigo-700">
                                {task.topicName}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="text-[11px] text-slate-500">
                                {task.type}
                              </span>
                              <span
                                className={`ml-auto rounded border px-1.5 py-0.5 text-[10px] font-medium ${priorityClass}`}
                              >
                                {task.priority} Priority
                              </span>
                            </div>

                            {/* Recommendation Reason */}
                            <div className="mt-2.5 rounded-md border border-slate-100 bg-slate-50/60 p-2 text-[11px] text-slate-600">
                              <span className="font-semibold text-slate-700">
                                Why Recommended:
                              </span>{" "}
                              {recommendationReason}
                            </div>

                            {/* Specific Learning Objectives */}
                            {task.learningObjectives &&
                            task.learningObjectives.length > 0 ? (
                              <div className="mt-2.5 text-[11px] text-slate-600">
                                <span className="font-semibold text-slate-700">
                                  Learning Objectives:
                                </span>
                                <ul className="mt-1 list-inside list-disc space-y-0.5 pl-1">
                                  {task.learningObjectives.map((obj, i) => (
                                    <li key={i}>{obj}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {/* Practice Diagnostic Quiz Action */}
                            {task.type === "Practice Set" ||
                            task.priority === "High" ? (
                              <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-2.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handlePracticeQuiz(task.topicId)
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                                >
                                  <span>Take Diagnostic Practice</span>
                                  <span>→</span>
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>

            {/* Upcoming Schedule & Study Metrics */}
            <div className="space-y-4 lg:col-span-4">
              <section className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
                <h3 className="text-sm font-semibold text-slate-900">
                  Upcoming Revision Schedule
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Spaced repetition blocks scheduled for future sessions.
                </p>

                {upcomingTasks.length === 0 ? (
                  <p className="mt-4 text-xs text-slate-400">
                    No upcoming tasks scheduled past today.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2.5">
                    {upcomingTasks.map((ut) => (
                      <li
                        key={ut.id}
                        className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between font-medium text-slate-900">
                          <span>{ut.topicName}</span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {ut.scheduledDate}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600">{ut.title}</p>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                          <span>{ut.type}</span>
                          <span>{ut.durationMinutes} min</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Study Time Planned & Logged Card */}
              <section className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
                <h3 className="text-sm font-semibold text-slate-900">
                  Study Time Logged
                </h3>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {(totalMinutes / 60).toFixed(1)}h{" "}
                  <span className="text-xs font-normal text-slate-500">
                    planned
                  </span>
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
                  <span>{completedCount} tasks completed</span>
                  <span>{pendingCount} remaining</span>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Reset Entire Revision Schedule?
            </h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              This will remove all current tasks — including your completed tasks
              — and regenerate a completely fresh schedule based on your current
              topic mastery.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              To keep your completed tasks, use &ldquo;Update Plan (Keep
              Completed)&rdquo; instead.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={() => void handleGeneratePlan(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {generating ? "Resetting..." : "Confirm & Reset All"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
