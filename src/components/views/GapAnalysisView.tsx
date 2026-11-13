"use client";

import { useMemo, useState } from "react";
import type {
  NavSectionId,
  QuizAttempt,
  StudyMaterial,
  TopicMasteryItem,
} from "@/types/dashboard";
import { ArrowRightIcon } from "@/components/icons";
import { extractConceptualGapsFromTopic } from "@/lib/gapAnalysis";

interface GapAnalysisViewProps {
  topics: TopicMasteryItem[];
  attempts?: QuizAttempt[];
  materials?: StudyMaterial[];
  onNavigate: (id: NavSectionId) => void;
  onSelectTopicForQuiz?: (topicId: string) => void;
}

export type TopicTier = "weak" | "medium" | "strong" | "not_assessed";

function ChevronDownIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronUpIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12.5L10 7.5L15 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GapAnalysisView({
  topics,
  attempts = [],
  materials = [],
  onNavigate,
  onSelectTopicForQuiz,
}: GapAnalysisViewProps) {
  const [filter, setFilter] = useState<"all" | TopicTier>("all");
  // Collapsed by default: track which topics the student chooses to expand
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(new Set());
  // Collapsible section for unassessed topics
  const [isUnassessedOpen, setIsUnassessedOpen] = useState<boolean>(false);

  // Material ID to Material Title lookup map
  const materialTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of materials) {
      map.set(m.id, m.title);
    }
    return map;
  }, [materials]);

  // Strict pedagogical categorization:
  // - Topics without quiz attempts (questionsAnswered === 0) are strictly "not_assessed", NEVER "weak".
  // - Weak: below 50%
  // - Medium: 50–79%
  // - Strong: 80% or above
  const enrichedTopics = useMemo(() => {
    return topics.map((t) => {
      const isAssessed =
        t.questionsAnswered > 0 &&
        t.lastPracticed !== "Never" &&
        t.lastPracticed !== "Not practiced yet";

      let tier: TopicTier = "not_assessed";
      if (!isAssessed) {
        tier = "not_assessed";
      } else if (t.mastery >= 80) {
        tier = "strong";
      } else if (t.mastery >= 50) {
        tier = "medium";
      } else {
        tier = "weak";
      }

      // Match actual quiz attempts for this topic
      const topicAttempts = attempts.filter((a) => {
        if (a.topicId && t.id) {
          return a.topicId === t.id;
        }
        return a.focusArea.trim().toLowerCase() === t.name.trim().toLowerCase();
      });

      const latestAttempt = topicAttempts[topicAttempts.length - 1];

      // Formulate genuine, student-friendly diagnostic explanation
      let explanation = "";
      if (tier === "not_assessed") {
        explanation =
          "You have not taken a quiz on this topic yet. Try a quick quiz to see what you know!";
      } else if (tier === "weak") {
        explanation = latestAttempt
          ? `Your current score is ${t.mastery}% across ${t.questionsAnswered} questions (most recent quiz: ${latestAttempt.score}%). A few key ideas need more practice.`
          : `Your current score is ${t.mastery}% across ${t.questionsAnswered} questions. Reviewing this topic will quickly boost your understanding.`;
      } else if (tier === "medium") {
        explanation = latestAttempt
          ? `Good job! You are at ${t.mastery}% across ${t.questionsAnswered} questions (most recent quiz: ${latestAttempt.score}%). Just a little more practice to reach 80% (Mastered)!`
          : `Good job! You are at ${t.mastery}% across ${t.questionsAnswered} questions. A quick review will lift this into the Mastered zone.`;
      } else {
        explanation = latestAttempt
          ? `Great work! High score of ${t.mastery}% across ${t.questionsAnswered} questions (most recent quiz: ${latestAttempt.score}%). Keep it fresh with a quick review once in a while.`
          : `Great work! High score of ${t.mastery}% across ${t.questionsAnswered} questions. You have mastered this topic!`;
      }

      const gaps = extractConceptualGapsFromTopic(t);
      const totalMistakes = gaps.reduce((acc, g) => acc + g.mistakeCount, 0);

      return {
        ...t,
        tier,
        isAssessed,
        explanation,
        attemptCount: topicAttempts.length,
        gaps,
        totalMistakes,
      };
    });
  }, [topics, attempts]);

  // Priority ranking:
  // Requirement 2: Display weak topics first, followed by medium and strong topics.
  const assessedTopics = useMemo(() => {
    const tierPriority: Record<TopicTier, number> = {
      weak: 1,
      medium: 2,
      strong: 3,
      not_assessed: 4,
    };

    return enrichedTopics
      .filter((t) => t.isAssessed)
      .sort((a, b) => {
        if (tierPriority[a.tier] !== tierPriority[b.tier]) {
          return tierPriority[a.tier] - tierPriority[b.tier];
        }
        return a.mastery - b.mastery;
      });
  }, [enrichedTopics]);

  // Unassessed topics (Requirement 6)
  const unassessedTopics = useMemo(() => {
    return enrichedTopics.filter((t) => !t.isAssessed);
  }, [enrichedTopics]);

  // Category counts
  const totalMappedCount = enrichedTopics.length;
  const assessedCount = assessedTopics.length;
  const weakCount = assessedTopics.filter((t) => t.tier === "weak").length;
  const mediumCount = assessedTopics.filter((t) => t.tier === "medium").length;
  const strongCount = assessedTopics.filter((t) => t.tier === "strong").length;
  const notAssessedCount = unassessedTopics.length;

  // Filtered lists
  const filteredAssessedTopics = useMemo(() => {
    if (filter === "all") return assessedTopics;
    if (filter === "not_assessed") return [];
    return assessedTopics.filter((t) => t.tier === filter);
  }, [assessedTopics, filter]);

  const showUnassessedList = filter === "all" || filter === "not_assessed";

  // Identify highest priority weak topic for immediate study recommendation
  const primaryWeakTopic =
    assessedTopics.find((t) => t.tier === "weak") ||
    assessedTopics.find((t) => t.tier === "medium") ||
    unassessedTopics[0];

  const handleStartQuizForTopic = (topicId: string) => {
    if (onSelectTopicForQuiz) {
      onSelectTopicForQuiz(topicId);
    }
    onNavigate("diagnostic-quiz");
  };

  const toggleTopicDetails = (topicId: string) => {
    setExpandedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* 1. Header & Student-Friendly Explanation */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Gap Analysis
              </h2>
              <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                Learning Checkup
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl">
              See what you know well and find the exact topics to practice next,
              based on your diagnostic quiz answers.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate("revision-planner")}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
            >
              <span>Revision Planner</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* 2. Student-Friendly Performance Tiers (Ages 9–12) */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 border-t border-slate-100 pt-3.5 text-xs">
          <div className="rounded-md border border-rose-100 bg-rose-50/60 p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-rose-800">Needs Practice</span>
              <span className="font-mono text-[11px] font-bold text-rose-700">
                &lt; 50%
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-rose-700 leading-snug">
              Key topics to revise first.
            </p>
          </div>

          <div className="rounded-md border border-amber-100 bg-amber-50/60 p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-800">Almost There</span>
              <span className="font-mono text-[11px] font-bold text-amber-700">
                50%–79%
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-amber-700 leading-snug">
              Good foundation, nearly mastered.
            </p>
          </div>

          <div className="rounded-md border border-emerald-100 bg-emerald-50/60 p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-800">Mastered</span>
              <span className="font-mono text-[11px] font-bold text-emerald-700">
                &ge; 80%
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-emerald-700 leading-snug">
              Strong grasp of concepts!
            </p>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Not Tested Yet</span>
              <span className="font-mono text-[11px] font-semibold text-slate-500">
                0 quizzes
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">
              Ready for your first quiz.
            </p>
          </div>
        </div>

        {/* 3. Priority Recommendation Banner */}
        {primaryWeakTopic ? (
          <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-md border border-indigo-100 bg-indigo-50/70 p-3 text-xs">
            <div className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-[10px]">
                ★
              </span>
              <div>
                <span className="font-semibold text-indigo-950">
                  Recommended Next Step:
                </span>{" "}
                <span className="text-indigo-900">
                  Practice{" "}
                  <strong className="font-semibold text-indigo-950">
                    {primaryWeakTopic.name}
                  </strong>{" "}
                  {primaryWeakTopic.isAssessed ? (
                    <>(score: {primaryWeakTopic.mastery}%)</>
                  ) : (
                    <>(not tested yet)</>
                  )}
                  . {primaryWeakTopic.explanation}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleStartQuizForTopic(primaryWeakTopic.id)}
              className="inline-flex items-center gap-1 self-start sm:self-auto font-semibold text-indigo-700 hover:text-indigo-900 text-xs shrink-0"
            >
              <span>Take quick quiz</span>
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {/* 4. Empty State: When no topics exist yet */}
      {topics.length === 0 ? (
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
            How Gap Analysis Works
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-slate-500">
            Upload your study materials and take diagnostic quizzes to see your
            scores and knowledge gaps analyzed here.
          </p>

          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3 text-left">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="text-xs font-semibold text-indigo-700">
                1. Upload Material
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Add your PDF notes or textbook chapters.
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="text-xs font-semibold text-indigo-700">
                2. Map Topics
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                AI extracts all important syllabus topics.
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="text-xs font-semibold text-indigo-700">
                3. Diagnostic Quiz
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Answer 5 questions to find what to practice.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
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
              View Topic Map
            </button>
          </div>
        </div>
      ) : (
        /* 5. Metrics Cards & Category Filters */
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            <div className="rounded-lg border border-slate-200/90 bg-white p-3 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500">
                All Topics
              </span>
              <p className="mt-0.5 text-lg font-bold text-slate-900">
                {totalMappedCount}
              </p>
              <p className="text-[10px] text-slate-400">
                {assessedCount} assessed
              </p>
            </div>

            <div className="rounded-lg border border-rose-200/80 bg-rose-50/40 p-3 shadow-2xs">
              <span className="text-[11px] font-medium text-rose-700">
                Needs Practice (&lt;50%)
              </span>
              <p className="mt-0.5 text-lg font-bold text-rose-800">{weakCount}</p>
              <p className="text-[10px] text-rose-600">Top priority</p>
            </div>

            <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-3 shadow-2xs">
              <span className="text-[11px] font-medium text-amber-700">
                Almost There (50–79%)
              </span>
              <p className="mt-0.5 text-lg font-bold text-amber-800">
                {mediumCount}
              </p>
              <p className="text-[10px] text-amber-600">Nearly mastered</p>
            </div>

            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-3 shadow-2xs">
              <span className="text-[11px] font-medium text-emerald-700">
                Mastered (&ge;80%)
              </span>
              <p className="mt-0.5 text-lg font-bold text-emerald-800">
                {strongCount}
              </p>
              <p className="text-[10px] text-emerald-600">Great job!</p>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-lg border border-slate-200/90 bg-slate-50/70 p-3 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-600">
                Not Tested Yet
              </span>
              <p className="mt-0.5 text-lg font-bold text-slate-800">
                {notAssessedCount}
              </p>
              <p className="text-[10px] text-slate-400">Awaiting quiz</p>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200/80 pb-3">
            <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === "all"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                All ({totalMappedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter("weak")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === "weak"
                    ? "bg-white text-rose-800 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Needs Practice ({weakCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter("medium")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === "medium"
                    ? "bg-white text-amber-800 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Almost There ({mediumCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter("strong")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === "strong"
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Mastered ({strongCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilter("not_assessed");
                  setIsUnassessedOpen(true);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === "not_assessed"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Not Tested ({notAssessedCount})
              </button>
            </div>

            <div className="text-xs text-slate-500">
              {filter === "all" ? (
                <span>
                  {assessedCount} assessed topic{assessedCount !== 1 ? "s" : ""}
                </span>
              ) : filter === "not_assessed" ? (
                <span>{notAssessedCount} unassessed</span>
              ) : (
                <span>
                  {filteredAssessedTopics.length} topic
                  {filteredAssessedTopics.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {/* 6. Assessed Topics: Compact Cards (Requirements 2, 3, 4, 5) */}
          {filter !== "not_assessed" && filteredAssessedTopics.length > 0 && (
            <div className="space-y-2.5">
              {filteredAssessedTopics.map((topic, index) => {
                const isExpanded = expandedTopicIds.has(topic.id);
                const isWeak = topic.tier === "weak";
                const isMedium = topic.tier === "medium";
                const isStrong = topic.tier === "strong";

                const badgeClass = isWeak
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : isMedium
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : isStrong
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-100 text-slate-600";

                const barClass = isWeak
                  ? "bg-rose-500"
                  : isMedium
                  ? "bg-amber-500"
                  : "bg-emerald-500";

                const sourceDocTitle = topic.materialId
                  ? materialTitleMap.get(topic.materialId)
                  : null;

                const statusLabel = isWeak
                  ? "Needs Practice"
                  : isMedium
                  ? "Almost There"
                  : "Mastered";

                return (
                  <div
                    key={topic.id}
                    className="rounded-lg border border-slate-200/90 bg-white transition-colors hover:border-slate-300 shadow-2xs"
                  >
                    {/* Compact Card Header / Overview (Requirement 3) */}
                    <div className="p-3.5 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Left: Rank, Name, Badges & Mastery */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 font-mono text-[10.5px] font-semibold text-slate-700">
                              #{index + 1}
                            </span>
                            <h3 className="text-sm font-semibold text-slate-900 truncate max-w-[260px] sm:max-w-md">
                              {topic.name}
                            </h3>

                            {/* Performance Status Badge */}
                            <span
                              className={`rounded border px-2 py-0.5 text-[10.5px] font-semibold ${badgeClass}`}
                            >
                              {statusLabel} · {topic.mastery}%
                            </span>

                            {/* Identified Gaps Count Pill (Requirement 3) */}
                            {topic.gaps.length > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10.5px] font-medium text-rose-800">
                                <span>{topic.gaps.length}</span>
                                <span>
                                  gap{topic.gaps.length !== 1 ? "s" : ""} to fix
                                </span>
                              </span>
                            ) : (
                              <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-medium text-emerald-800">
                                No gaps found
                              </span>
                            )}
                          </div>

                          {/* Quick details & mini progress bar */}
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="truncate max-w-[180px]">
                              Module: <strong className="font-medium text-slate-700">{topic.module}</strong>
                            </span>
                            <span>
                              {topic.questionsAnswered} questions answered
                            </span>
                            {topic.lastPracticed && (
                              <span className="hidden sm:inline">
                                Practiced: {topic.lastPracticed}
                              </span>
                            )}
                          </div>

                          {/* Inline Progress Bar */}
                          <div className="mt-2 flex items-center gap-2 max-w-xs">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${barClass}`}
                                style={{ width: `${topic.mastery}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 tabular-nums">
                              {topic.mastery}%
                            </span>
                          </div>
                        </div>

                        {/* Right Actions: Quiz Button & View Details Toggle */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleStartQuizForTopic(topic.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
                          >
                            <span>Retest</span>
                            <ArrowRightIcon className="h-3 w-3" />
                          </button>

                          {/* Details Toggle Button (Requirements 3, 4, 5) */}
                          <button
                            type="button"
                            onClick={() => toggleTopicDetails(topic.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                            aria-expanded={isExpanded}
                          >
                            <span>{isExpanded ? "Hide Details" : "View Details"}</span>
                            {isExpanded ? (
                              <ChevronUpIcon className="h-3.5 w-3.5 text-slate-500" />
                            ) : (
                              <ChevronDownIcon className="h-3.5 w-3.5 text-slate-500" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Analysis Section (Collapsed by default, expands only on selection) */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/40 p-4 space-y-3.5 text-xs">
                        {/* Diagnostic Assessment Explanation */}
                        <div className="rounded-md border border-slate-200/80 bg-white p-3 text-slate-700">
                          <span className="font-semibold text-slate-900">
                            Teacher&apos;s Assessment:
                          </span>{" "}
                          {topic.explanation}
                        </div>

                        {/* Grouped Knowledge Gaps */}
                        {topic.gaps.length > 0 ? (
                          <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200/70 pb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9.5px] font-bold text-white">
                                  !
                                </span>
                                <h4 className="text-xs font-semibold text-rose-950">
                                  What to practice in this topic:
                                </h4>
                              </div>
                              <span className="rounded border border-rose-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-rose-800">
                                {topic.totalMistakes} mistake
                                {topic.totalMistakes !== 1 ? "s" : ""} identified
                              </span>
                            </div>

                            <div className="mt-2.5 space-y-2.5">
                              {topic.gaps.map((gap) => (
                                <div
                                  key={gap.id}
                                  className="rounded-md border border-rose-200/80 bg-white p-3 shadow-2xs"
                                >
                                  {gap.isFallback ? (
                                    <div className="space-y-1.5">
                                      <div className="text-slate-900 font-medium">
                                        &ldquo;{gap.questions[0] || gap.problem}&rdquo;
                                      </div>
                                      <p className="text-[11.5px] text-slate-600">
                                        <strong className="text-slate-700">What to do:</strong>{" "}
                                        {gap.recommendedAction}
                                        {gap.sourceCitation ? ` · Source: ${gap.sourceCitation}` : ""}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-slate-600">
                                            Knowledge gap:
                                          </span>
                                          <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-950">
                                            {gap.concept}
                                          </span>
                                        </div>
                                        <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-rose-700">
                                          {gap.mistakeCount}{" "}
                                          {gap.mistakeCount === 1 ? "miss" : "misses"}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 gap-1 pt-0.5 text-[11.5px]">
                                        <div>
                                          <span className="font-semibold text-slate-700">
                                            Problem:
                                          </span>{" "}
                                          <span className="text-rose-900 font-medium">
                                            {gap.problem}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="font-semibold text-slate-700">
                                            Recommended action:
                                          </span>{" "}
                                          <span className="text-slate-800">
                                            {gap.recommendedAction}
                                          </span>
                                        </div>
                                        {gap.sourceCitation && (
                                          <div className="flex items-center gap-1 text-[11px] text-slate-600">
                                            <span className="font-semibold text-slate-700">
                                              Where to read:
                                            </span>{" "}
                                            <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-slate-800">
                                              {gap.sourceCitation}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Underlying question prompts */}
                                      {gap.questions && gap.questions.length > 0 && (
                                        <div className="mt-1 border-t border-slate-100 pt-1 text-[10.5px] text-slate-500">
                                          <span className="font-medium text-slate-600">
                                            Missed question{gap.questions.length > 1 ? "s" : ""}:
                                          </span>
                                          <ul className="mt-0.5 space-y-0.5">
                                            {gap.questions.map((q, qIdx) => (
                                              <li key={qIdx} className="italic text-slate-600">
                                                &ldquo;{q}&rdquo;
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-md border border-emerald-100 bg-emerald-50/50 p-2.5 text-xs text-emerald-800 font-medium">
                            ✓ No specific conceptual gaps detected on this topic.
                          </div>
                        )}

                        {/* Source Document, Key Concepts & Evidence */}
                        <div className="flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-slate-500 pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {sourceDocTitle && (
                              <span className="font-medium text-slate-700">
                                📄 {sourceDocTitle}
                              </span>
                            )}
                            {topic.sourcePageNumbers && topic.sourcePageNumbers.length > 0 && (
                              <span>
                                Pages:{" "}
                                <strong className="font-mono text-slate-700">
                                  {topic.sourcePageNumbers.map((p) => `p. ${p}`).join(", ")}
                                </strong>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onNavigate("revision-planner")}
                              className="font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              Add to Revision Planner →
                            </button>
                          </div>
                        </div>

                        {/* Key Concepts Tags */}
                        {topic.keyConcepts && topic.keyConcepts.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700">
                              Key Ideas:
                            </span>
                            {topic.keyConcepts.slice(0, 5).map((c, i) => (
                              <span
                                key={i}
                                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-700"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Extracted Evidence Quote if available */}
                        {topic.evidenceText && (
                          <div className="text-[11px] italic text-slate-500 pl-2.5 border-l-2 border-slate-200">
                            &ldquo;{topic.evidenceText}&rdquo;
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 7. Grouped Collapsible Unassessed Topics Section (Requirement 6) */}
          {showUnassessedList && unassessedTopics.length > 0 && (
            <div className="rounded-lg border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
              {/* Header: normal non-interactive div with informational content */}
              <div className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Unassessed Topics
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[11px] font-bold text-slate-600">
                      {unassessedTopics.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Topics awaiting your first diagnostic quiz to determine your baseline.
                  </p>
                </div>

                {/* Dedicated accessible toggle button */}
                <button
                  type="button"
                  id="unassessed-topics-toggle"
                  aria-expanded={isUnassessedOpen}
                  aria-controls="unassessed-topics-list"
                  onClick={() => setIsUnassessedOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                >
                  <span>{isUnassessedOpen ? "Hide topics" : "Show topics"}</span>
                  {isUnassessedOpen ? (
                    <ChevronUpIcon className="h-3.5 w-3.5 text-slate-500" />
                  ) : (
                    <ChevronDownIcon className="h-3.5 w-3.5 text-slate-500" />
                  )}
                </button>
              </div>

              {/* Collapsible Body with matching stable ID */}
              {isUnassessedOpen && (
                <div
                  id="unassessed-topics-list"
                  role="region"
                  aria-labelledby="unassessed-topics-toggle"
                  className="border-t border-slate-100 p-3.5 sm:p-4 bg-slate-50/30"
                >
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {unassessedTopics.map((topic) => {
                      const docTitle = topic.materialId
                        ? materialTitleMap.get(topic.materialId)
                        : null;

                      return (
                        <div
                          key={topic.id}
                          className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-2xs"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1.5">
                              <h4 className="font-semibold text-slate-900 leading-snug">
                                {topic.name}
                              </h4>
                              <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shrink-0">
                                Not Assessed
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Module: <span className="font-medium text-slate-700">{topic.module}</span>
                            </p>
                            {docTitle && (
                              <p className="mt-0.5 text-[10.5px] text-slate-400 truncate" title={docTitle}>
                                📄 {docTitle}
                              </p>
                            )}
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10.5px] text-slate-400">
                              0 quizzes taken
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartQuizForTopic(topic.id)}
                              className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 transition-colors"
                            >
                              <span>Take Quiz</span>
                              <ArrowRightIcon className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 8. Filter Empty State */}
          {filter !== "all" &&
            filter !== "not_assessed" &&
            filteredAssessedTopics.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-xs text-slate-500 shadow-2xs">
                No topics in the selected category ({filter}).
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Show all topics
                  </button>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
