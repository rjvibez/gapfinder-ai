"use client";

import { useMemo, useState } from "react";
import type {
  NavSectionId,
  QuizAttempt,
  RevisionTask,
  TopicMasteryItem,
  TopicStatus,
} from "@/types/dashboard";
import { LearningProgressChart } from "@/components/LearningProgressChart";

interface ProgressViewProps {
  topics?: TopicMasteryItem[];
  attempts?: QuizAttempt[];
  tasks?: RevisionTask[];
  onNavigate: (id: NavSectionId) => void;
  onRefresh?: () => void;
}

type TopicTier = "all" | TopicStatus | "not_assessed";

const STATUS_BADGE: Record<TopicStatus | "not_assessed", string> = {
  weak: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  strong: "border-emerald-200 bg-emerald-50 text-emerald-700",
  not_assessed: "border-slate-200 bg-slate-100 text-slate-600",
};

const STATUS_BAR: Record<TopicStatus | "not_assessed", string> = {
  weak: "bg-rose-500",
  medium: "bg-amber-500",
  strong: "bg-emerald-500",
  not_assessed: "bg-slate-300",
};

export function ProgressView({
  topics = [],
  attempts = [],
  tasks = [],
  onNavigate,
  onRefresh,
}: ProgressViewProps) {
  const [topicFilter, setTopicFilter] = useState<TopicTier>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      await Promise.resolve(onRefresh());
      setRefreshMessage("Progress data synced with Supabase.");
      setTimeout(() => setRefreshMessage(null), 3500);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Strict pedagogical categorization:
  // - Topics without quiz attempts (questionsAnswered === 0) are strictly "not_assessed", never "weak".
  // - Weak: below 50%
  // - Medium: 50–79%
  // - Strong: 80% or above
  const classifiedTopics = useMemo(() => {
    return topics.map((t) => {
      const isAssessed =
        t.questionsAnswered > 0 &&
        t.lastPracticed !== "Never" &&
        t.lastPracticed !== "Not practiced yet";

      let strictStatus: TopicStatus | "not_assessed" = "not_assessed";
      if (!isAssessed) {
        strictStatus = "not_assessed";
      } else if (t.mastery >= 80) {
        strictStatus = "strong";
      } else if (t.mastery >= 50) {
        strictStatus = "medium";
      } else {
        strictStatus = "weak";
      }

      // Match genuine quiz attempts for this topic using exact topic ID first, then exact focusArea match
      const topicAttempts = attempts.filter((a) => {
        if (a.topicId && t.id) {
          return a.topicId === t.id;
        }
        return a.focusArea.trim().toLowerCase() === t.name.trim().toLowerCase();
      });

      const firstScore = topicAttempts[0]?.score;
      const latestScore = topicAttempts[topicAttempts.length - 1]?.score;
      const topicImprovement =
        topicAttempts.length > 1 &&
        typeof firstScore === "number" &&
        typeof latestScore === "number"
          ? latestScore - firstScore
          : null;

      return {
        ...t,
        strictStatus,
        isAssessed,
        topicAttempts,
        topicImprovement,
      };
    });
  }, [topics, attempts]);

  const totalTopics = classifiedTopics.length;
  const weakTopics = classifiedTopics.filter((t) => t.strictStatus === "weak");
  const mediumTopics = classifiedTopics.filter(
    (t) => t.strictStatus === "medium",
  );
  const strongTopics = classifiedTopics.filter(
    (t) => t.strictStatus === "strong",
  );
  const notAssessedTopics = classifiedTopics.filter(
    (t) => t.strictStatus === "not_assessed",
  );

  // Overall Diagnostic Accuracy across all genuine saved attempts
  const totalAttempts = attempts.length;
  const averageScore = useMemo(() => {
    if (totalAttempts === 0) return 0;
    const sum = attempts.reduce((acc, a) => acc + a.score, 0);
    return Math.round(sum / totalAttempts);
  }, [attempts, totalAttempts]);

  // Tasks statistics
  const completedTasks = tasks.filter((t) => t.completed).length;
  const pendingTasks = tasks.filter((t) => !t.completed).length;
  const taskCompletionRate =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // Filter topics
  const filteredTopics = useMemo(() => {
    if (topicFilter === "all") return classifiedTopics;
    return classifiedTopics.filter((t) => t.strictStatus === topicFilter);
  }, [classifiedTopics, topicFilter]);

  // Attempts with strict topic-specific comparison (Requirement 8):
  // Compare an attempt ONLY against the previous attempt for the same topic.
  const attemptsWithTopicComparison = useMemo(() => {
    return attempts.map((attempt, index) => {
      // Find the prior attempt for the SAME topic that occurred before this one (exact match)
      const previousSameTopic = attempts
        .slice(0, index)
        .reverse()
        .find((a) => {
          if (a.topicId && attempt.topicId) {
            return a.topicId === attempt.topicId;
          }
          return (
            a.focusArea.trim().toLowerCase() ===
            attempt.focusArea.trim().toLowerCase()
          );
        });

      const delta = previousSameTopic
        ? attempt.score - previousSameTopic.score
        : null;

      return {
        ...attempt,
        hasPriorSameTopicAttempt: Boolean(previousSameTopic),
        topicDelta: delta,
        priorScore: previousSameTopic?.score,
      };
    });
  }, [attempts]);

  const hasAnyData = totalTopics > 0 || totalAttempts > 0 || tasks.length > 0;

  return (
    <div className="space-y-6">
      {/* 1. Header & Working Refresh Action */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Student Learning Progress
              </h2>
              <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                Verified Analytics
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Real-time synthesis of syllabus mastery, diagnostic quiz accuracy,
              and revision schedule execution.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh ? (
              <button
                type="button"
                disabled={isRefreshing}
                onClick={() => void handleRefresh()}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <svg
                  className={`h-3.5 w-3.5 text-slate-500 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{isRefreshing ? "Syncing..." : "Refresh Progress"}</span>
              </button>
            ) : null}
          </div>
        </div>

        {refreshMessage ? (
          <div
            role="status"
            className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800"
          >
            {refreshMessage}
          </div>
        ) : null}

        {/* 2. Educational Explainer: How Learning Progress Works */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4 border-t border-slate-100 pt-4 text-xs">
          <div className="rounded-md border border-slate-100 bg-slate-50/70 p-2.5">
            <span className="font-semibold text-slate-800">
              1. Quiz Accuracy
            </span>
            <p className="mt-1 text-[11px] text-slate-600 leading-snug">
              Average percentage across all completed diagnostic assessments.
            </p>
          </div>

          <div className="rounded-md border border-slate-100 bg-slate-50/70 p-2.5">
            <span className="font-semibold text-slate-800">
              2. Topic Mastery
            </span>
            <p className="mt-1 text-[11px] text-slate-600 leading-snug">
              Categorized into Strong (≥80%), Medium (50–79%), and Weak
              (&lt;50%).
            </p>
          </div>

          <div className="rounded-md border border-slate-100 bg-slate-50/70 p-2.5">
            <span className="font-semibold text-slate-800">
              3. Revision Execution
            </span>
            <p className="mt-1 text-[11px] text-slate-600 leading-snug">
              Completion rate of targeted study blocks in your Revision Planner.
            </p>
          </div>

          <div className="rounded-md border border-slate-100 bg-slate-50/70 p-2.5">
            <span className="font-semibold text-slate-800">
              4. Learning Trends
            </span>
            <p className="mt-1 text-[11px] text-slate-600 leading-snug">
              Same-topic score progression tracked across diagnostic re-tests.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Empty State when student has no learning data yet */}
      {!hasAnyData ? (
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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>

          <h3 className="text-base font-semibold text-slate-900">
            Welcome to Your Learning Progress Dashboard
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-slate-500">
            This dashboard dynamically visualizes your verified academic
            progress. Scores, syllabus coverage, and learning curves update
            automatically each time you complete a diagnostic quiz or check off
            revision tasks.
          </p>

          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-3.5 sm:grid-cols-3 text-left">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-indigo-700">
                1. Upload Material
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Upload your course PDF notes in My Materials.
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-indigo-700">
                2. Map Topics
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                AI extracts verified syllabus topics and subtopics.
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-indigo-700">
                3. Diagnostic Quizzes
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Take quizzes to calibrate your accuracy and mastery trends.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate("materials")}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
            >
              <span>Upload Study Materials</span>
              <span>→</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("topic-map")}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Go to Topic Map
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 4. Top KPI Summary Cards (Omitting study hours, only genuine data) */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Topics & Mastery Breakdown */}
            <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">
                Total Topics Mapped
              </span>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {totalTopics}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium">
                <span className="text-emerald-700">
                  {strongTopics.length} Strong
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-amber-700">
                  {mediumTopics.length} Medium
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-rose-700">{weakTopics.length} Weak</span>
              </div>
            </div>

            {/* Quiz Attempts & Average Accuracy */}
            <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">
                Diagnostic Quizzes
              </span>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {totalAttempts} {totalAttempts === 1 ? "attempt" : "attempts"}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Average accuracy:{" "}
                <span className="font-semibold text-indigo-700 tabular-nums">
                  {totalAttempts > 0 ? `${averageScore}%` : "No attempts"}
                </span>
              </p>
            </div>

            {/* Revision Tasks Execution */}
            <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">
                Revision Tasks Completed
              </span>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {completedTasks}{" "}
                <span className="text-xs font-normal text-slate-500">
                  / {tasks.length}
                </span>
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>{pendingTasks} pending</span>
                <span className="font-semibold text-indigo-700">
                  {taskCompletionRate}%
                </span>
              </div>
            </div>

            {/* Syllabus Health (Strong mastery topics proportion) */}
            <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">
                Syllabus Health
              </span>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {totalTopics > 0
                  ? `${Math.round((strongTopics.length / totalTopics) * 100)}%`
                  : "0%"}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                {strongTopics.length} of {totalTopics} topics &ge; 80% mastery
              </p>
            </div>
          </section>

          {/* 5. Performance Trend Chart & Same-Topic Quiz History */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <LearningProgressChart attempts={attempts} />
            </div>

            {/* Strict Same-Topic Comparison Quiz History (Requirement 8) */}
            <div className="xl:col-span-5">
              <section className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Recent Diagnostic Attempts
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Evaluated against prior attempt on the same topic.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate("diagnostic-quiz")}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Take quiz
                  </button>
                </div>

                {attemptsWithTopicComparison.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No diagnostic attempts recorded yet.
                  </div>
                ) : (
                  <div className="mt-3.5 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10.5px] font-medium uppercase tracking-wider text-slate-400">
                          <th className="pb-2 pr-2">Topic</th>
                          <th className="pb-2 pr-2">Date</th>
                          <th className="pb-2 pr-2 text-right">Score</th>
                          <th className="pb-2 text-right">Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attemptsWithTopicComparison
                          .slice(-5)
                          .reverse()
                          .map((attempt) => {
                            const isBaseline =
                              !attempt.hasPriorSameTopicAttempt;
                            const delta = attempt.topicDelta;

                            let deltaLabel = "Baseline";
                            let deltaClass =
                              "text-slate-600 bg-slate-100 border-slate-200";

                            if (!isBaseline && typeof delta === "number") {
                              if (delta > 0) {
                                deltaLabel = `+${delta}%`;
                                deltaClass =
                                  "text-emerald-700 bg-emerald-50 border-emerald-200";
                              } else if (delta < 0) {
                                deltaLabel = `${delta}%`;
                                deltaClass =
                                  "text-rose-700 bg-rose-50 border-rose-200";
                              } else {
                                deltaLabel = "±0%";
                                deltaClass =
                                  "text-slate-600 bg-slate-50 border-slate-200";
                              }
                            }

                            return (
                              <tr
                                key={attempt.id}
                                className="hover:bg-slate-50/60"
                              >
                                <td className="py-2.5 pr-2">
                                  <p className="font-semibold text-slate-900 truncate max-w-[130px]">
                                    {attempt.title}
                                  </p>
                                  <p className="text-[10.5px] text-slate-400">
                                    {attempt.focusArea}
                                  </p>
                                </td>
                                <td className="whitespace-nowrap py-2.5 pr-2 text-slate-500 font-mono text-[11px]">
                                  {attempt.shortDate || attempt.date}
                                </td>
                                <td className="whitespace-nowrap py-2.5 pr-2 text-right font-bold text-slate-900 tabular-nums">
                                  {attempt.score}%
                                </td>
                                <td className="whitespace-nowrap py-2.5 text-right">
                                  <span
                                    title={
                                      attempt.hasPriorSameTopicAttempt &&
                                      typeof attempt.priorScore === "number"
                                        ? `Prior score on ${attempt.focusArea}: ${attempt.priorScore}%`
                                        : "First diagnostic on this topic"
                                    }
                                    className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${deltaClass}`}
                                  >
                                    {deltaLabel}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* 6. Detailed Topic-wise Mastery Table with Filtering & Historical Assessment Trajectory */}
          <section className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Topic-wise Mastery Breakdown &amp; Assessment History
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Actual mastery percentage, questions answered, and historical
                  trajectory per syllabus topic.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {[
                  { id: "all", label: `All (${classifiedTopics.length})` },
                  { id: "weak", label: `Weak (${weakTopics.length})` },
                  { id: "medium", label: `Medium (${mediumTopics.length})` },
                  { id: "strong", label: `Strong (${strongTopics.length})` },
                  {
                    id: "not_assessed",
                    label: `Not Assessed (${notAssessedTopics.length})`,
                  },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTopicFilter(f.id as TopicTier)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      topicFilter === f.id
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredTopics.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No topics in this category ({topicFilter}).
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      <th className="pb-2.5 pr-4">Topic &amp; Module</th>
                      <th className="pb-2.5 pr-4">Status</th>
                      <th className="pb-2.5 pr-4">Questions Answered</th>
                      <th className="pb-2.5 pr-4">Last Practiced</th>
                      <th className="pb-2.5 pr-4">Topic History</th>
                      <th className="pb-2.5 text-right">Mastery Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTopics.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60">
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-slate-900">
                            {t.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {t.module}
                          </p>
                        </td>

                        <td className="whitespace-nowrap py-3 pr-4">
                          <span
                            className={`inline-block rounded border px-2 py-0.5 text-[10.5px] font-semibold capitalize ${
                              STATUS_BADGE[t.strictStatus]
                            }`}
                          >
                            {t.strictStatus === "not_assessed"
                              ? "Not Assessed"
                              : t.strictStatus}
                          </span>
                        </td>

                        <td className="whitespace-nowrap py-3 pr-4 font-mono text-slate-700 tabular-nums">
                          {t.questionsAnswered}{" "}
                          {t.questionsAnswered === 1 ? "question" : "questions"}
                        </td>

                        <td className="whitespace-nowrap py-3 pr-4 text-slate-500">
                          {t.lastPracticed || "Not practiced yet"}
                        </td>

                        {/* Historical Assessment Trajectory (Requirement 5) */}
                        <td className="whitespace-nowrap py-3 pr-4 text-xs">
                          {t.topicAttempts.length === 0 ? (
                            t.isAssessed ? (
                              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                Assessment recorded — attempt history
                                unavailable
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">
                                Awaiting first quiz
                              </span>
                            )
                          ) : t.topicAttempts.length === 1 ? (
                            <span className="text-slate-600 text-[11px]">
                              1 attempt ({t.topicAttempts[0].score}%)
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-700">
                              {t.topicAttempts.length} attempts ·{" "}
                              {typeof t.topicImprovement === "number" &&
                              t.topicImprovement > 0 ? (
                                <span className="font-semibold text-emerald-700">
                                  +{t.topicImprovement}% gain
                                </span>
                              ) : typeof t.topicImprovement === "number" &&
                                t.topicImprovement < 0 ? (
                                <span className="font-semibold text-rose-700">
                                  {t.topicImprovement}%
                                </span>
                              ) : (
                                <span className="text-slate-500">steady</span>
                              )}
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap py-3 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full ${
                                  STATUS_BAR[t.strictStatus]
                                } transition-all duration-300`}
                                style={{
                                  width:
                                    t.strictStatus === "not_assessed"
                                      ? "0%"
                                      : `${t.mastery}%`,
                                }}
                              />
                            </div>
                            <span className="w-10 font-bold text-slate-900 tabular-nums">
                              {t.strictStatus === "not_assessed"
                                ? "—"
                                : `${t.mastery}%`}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 7. Revision Tasks Execution Summary (Requirement 6) */}
          {tasks.length > 0 ? (
            <section className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Revision Schedule Execution
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Tracking completed vs. pending tasks scheduled in your
                    Revision Planner.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate("revision-planner")}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <span>Go to Planner</span>
                  <span>→</span>
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Completed tasks list */}
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 text-xs">
                      Completed Tasks ({completedTasks})
                    </span>
                    <span className="text-xs font-bold text-emerald-700">
                      {taskCompletionRate}%
                    </span>
                  </div>
                  {completedTasks === 0 ? (
                    <p className="mt-3 text-xs text-slate-400">
                      No tasks marked completed yet.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {tasks
                        .filter((t) => t.completed)
                        .slice(0, 5)
                        .map((t) => (
                          <li
                            key={t.id}
                            className="flex items-center justify-between text-xs text-slate-600"
                          >
                            <span className="truncate pr-2 line-through text-slate-400">
                              {t.title}
                            </span>
                            <span className="shrink-0 text-[10.5px] text-slate-400">
                              {t.durationMinutes}m
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>

                {/* Pending tasks list */}
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 text-xs">
                      Pending Revision Tasks ({pendingTasks})
                    </span>
                    <span className="text-xs font-bold text-amber-700">
                      {100 - taskCompletionRate}%
                    </span>
                  </div>
                  {pendingTasks === 0 ? (
                    <p className="mt-3 text-xs text-slate-400">
                      All scheduled tasks are completed.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {tasks
                        .filter((t) => !t.completed)
                        .slice(0, 5)
                        .map((t) => (
                          <li
                            key={t.id}
                            className="flex items-center justify-between text-xs text-slate-700"
                          >
                            <span className="truncate pr-2 font-medium">
                              {t.title}
                            </span>
                            <span className="shrink-0 text-[10.5px] font-semibold text-slate-500">
                              {t.priority} · {t.durationMinutes}m
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
