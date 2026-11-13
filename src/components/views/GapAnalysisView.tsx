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

export function GapAnalysisView({
  topics,
  attempts = [],
  materials = [],
  onNavigate,
  onSelectTopicForQuiz,
}: GapAnalysisViewProps) {
  const [filter, setFilter] = useState<"all" | TopicTier>("all");

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
      const topicAttempts = attempts.filter(
        (a) =>
          a.title.toLowerCase().includes(t.name.toLowerCase()) ||
          a.focusArea.toLowerCase().includes(t.name.toLowerCase())
      );

      const latestAttempt = topicAttempts[topicAttempts.length - 1];

      // Formulate genuine, evidence-based diagnostic explanation
      let explanation = "";
      if (tier === "not_assessed") {
        explanation =
          "Not yet assessed. Take a diagnostic quiz on this topic to evaluate your baseline comprehension.";
      } else if (tier === "weak") {
        explanation = latestAttempt
          ? `Score is ${t.mastery}% across ${t.questionsAnswered} questions (most recent quiz: ${latestAttempt.score}%). Critical knowledge gaps detected; recommend immediate revision.`
          : `Score is ${t.mastery}% across ${t.questionsAnswered} questions. Knowledge gaps identified; prioritize this in your revision plan.`;
      } else if (tier === "medium") {
        explanation = latestAttempt
          ? `Score is ${t.mastery}% across ${t.questionsAnswered} questions (most recent quiz: ${latestAttempt.score}%). Approaching the 80% threshold; targeted practice recommended.`
          : `Score is ${t.mastery}% across ${t.questionsAnswered} questions. Solid foundation; targeted recall will elevate this to Strong.`;
      } else {
        explanation = latestAttempt
          ? `High comprehension at ${t.mastery}% across ${t.questionsAnswered} questions (most recent quiz: ${latestAttempt.score}%). Retain with periodic spaced recall.`
          : `High comprehension at ${t.mastery}% across ${t.questionsAnswered} questions. Retain with periodic spaced recall.`;
      }

      return {
        ...t,
        tier,
        isAssessed,
        explanation,
        attemptCount: topicAttempts.length,
      };
    });
  }, [topics, attempts]);

  // Priority ranking:
  // 1. Weak topics (lowest mastery first)
  // 2. Medium topics (lowest mastery first)
  // 3. Not Assessed topics (awaiting diagnostic baseline)
  // 4. Strong topics (highest mastery)
  const rankedTopics = useMemo(() => {
    const tierPriority: Record<TopicTier, number> = {
      weak: 1,
      medium: 2,
      not_assessed: 3,
      strong: 4,
    };

    return [...enrichedTopics].sort((a, b) => {
      if (tierPriority[a.tier] !== tierPriority[b.tier]) {
        return tierPriority[a.tier] - tierPriority[b.tier];
      }
      return a.mastery - b.mastery;
    });
  }, [enrichedTopics]);

  // Category counts
  const assessedCount = rankedTopics.filter((t) => t.isAssessed).length;
  const weakCount = rankedTopics.filter((t) => t.tier === "weak").length;
  const mediumCount = rankedTopics.filter((t) => t.tier === "medium").length;
  const strongCount = rankedTopics.filter((t) => t.tier === "strong").length;
  const notAssessedCount = rankedTopics.filter(
    (t) => t.tier === "not_assessed"
  ).length;

  const filteredTopics = rankedTopics.filter((t) => {
    if (filter === "all") return true;
    return t.tier === filter;
  });

  // Identify highest priority weak topic for immediate study recommendation
  const primaryWeakTopic =
    rankedTopics.find((t) => t.tier === "weak") ||
    rankedTopics.find((t) => t.tier === "medium") ||
    rankedTopics.find((t) => t.tier === "not_assessed");

  const handleStartQuizForTopic = (topicId: string) => {
    if (onSelectTopicForQuiz) {
      onSelectTopicForQuiz(topicId);
    }
    onNavigate("diagnostic-quiz");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Beginner-Friendly Explanation of Gap Analysis */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Gap Analysis
              </h2>
              <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                Curriculum Diagnostics
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl">
              Gap Analysis benchmarks your syllabus topics against actual
              diagnostic quiz attempts to surface exactly where conceptual gaps
              exist, ranking your study priorities so you always know what to
              revise first.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate("revision-planner")}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
            >
              <span>Open Revision Planner</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* 2. Clear Performance Tier Definitions */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4 border-t border-slate-100 pt-4 text-xs">
          <div className="rounded-md border border-rose-100 bg-rose-50/50 p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-rose-800">Weak Mastery</span>
              <span className="font-mono text-[11px] font-bold text-rose-700">
                &lt; 50%
              </span>
            </div>
            <p className="mt-1 text-[11px] text-rose-700 leading-snug">
              Critical knowledge gaps identified. Highest revision priority.
            </p>
          </div>

          <div className="rounded-md border border-amber-100 bg-amber-50/50 p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-800">
                Medium Mastery
              </span>
              <span className="font-mono text-[11px] font-bold text-amber-700">
                50% – 79%
              </span>
            </div>
            <p className="mt-1 text-[11px] text-amber-700 leading-snug">
              Good foundation. Targeted practice needed to reach 80% threshold.
            </p>
          </div>

          <div className="rounded-md border border-emerald-100 bg-emerald-50/50 p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-800">
                Strong Mastery
              </span>
              <span className="font-mono text-[11px] font-bold text-emerald-700">
                &ge; 80%
              </span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-700 leading-snug">
              High comprehension demonstrated. Maintain with periodic recall.
            </p>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Not Assessed</span>
              <span className="font-mono text-[11px] font-semibold text-slate-500">
                0 quizzes
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 leading-snug">
              Mapped topics awaiting an initial diagnostic quiz attempt.
            </p>
          </div>
        </div>

        {/* 3. Priority Recommendation Banner linked to real weak topic */}
        {primaryWeakTopic ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-[10px]">
                !
              </div>
              <div>
                <span className="font-semibold text-indigo-950">
                  Priority Study Recommendation:
                </span>{" "}
                <span className="text-indigo-900">
                  Focus on{" "}
                  <strong className="font-semibold text-indigo-950">
                    {primaryWeakTopic.name}
                  </strong>{" "}
                  {primaryWeakTopic.isAssessed ? (
                    <>(current mastery: {primaryWeakTopic.mastery}%)</>
                  ) : (
                    <>(currently unassessed)</>
                  )}
                  . {primaryWeakTopic.explanation}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleStartQuizForTopic(primaryWeakTopic.id)}
                className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:text-indigo-900"
              >
                <span>Take diagnostic quiz</span>
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
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
            Gap Analysis needs learning data to evaluate your conceptual strengths
            and weaknesses. As soon as you upload study materials and complete
            diagnostic quizzes, your verified performance is automatically analyzed
            here.
          </p>

          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-3.5 sm:grid-cols-3 text-left">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-indigo-700">
                Step 1: Upload Material
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Upload your PDF syllabus or lecture notes in My Materials.
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-indigo-700">
                Step 2: Map Topics
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                AI extracts verified syllabus topics and subtopics.
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-indigo-700">
                Step 3: Diagnostic Quiz
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Complete a 5-question diagnostic to identify your gaps.
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
              View Topic Map
            </button>
          </div>
        </div>
      ) : (
        /* 5. Metrics Cards & Category Filters */
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500">
                Total Topics Mapped
              </span>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {rankedTopics.length}
              </p>
              <p className="text-[10.5px] text-slate-400">
                {assessedCount} assessed ({Math.round((assessedCount / rankedTopics.length) * 100)}%)
              </p>
            </div>

            <div className="rounded-lg border border-rose-200/80 bg-rose-50/30 p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-rose-700">
                Weak Topics (&lt;50%)
              </span>
              <p className="mt-1 text-xl font-bold text-rose-800">{weakCount}</p>
              <p className="text-[10.5px] text-rose-600">Immediate priority</p>
            </div>

            <div className="rounded-lg border border-amber-200/80 bg-amber-50/30 p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-amber-700">
                Medium Topics (50–79%)
              </span>
              <p className="mt-1 text-xl font-bold text-amber-800">
                {mediumCount}
              </p>
              <p className="text-[10.5px] text-amber-600">Approaching mastery</p>
            </div>

            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/30 p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-emerald-700">
                Strong Topics (&ge;80%)
              </span>
              <p className="mt-1 text-xl font-bold text-emerald-800">
                {strongCount}
              </p>
              <p className="text-[10.5px] text-emerald-600">Solid grasp</p>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-lg border border-slate-200/90 bg-slate-50/60 p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-600">
                Not Assessed
              </span>
              <p className="mt-1 text-xl font-bold text-slate-800">
                {notAssessedCount}
              </p>
              <p className="text-[10.5px] text-slate-400">No quizzes taken</p>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === "all"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                All ({rankedTopics.length})
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
                Weak ({weakCount})
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
                Medium ({mediumCount})
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
                Strong ({strongCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter("not_assessed")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === "not_assessed"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Not Assessed ({notAssessedCount})
              </button>
            </div>

            <span className="text-xs text-slate-500">
              Showing {filteredTopics.length} of {rankedTopics.length} topics
            </span>
          </div>

          {/* 6. Filter Empty State */}
          {filteredTopics.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-xs text-slate-500 shadow-2xs">
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
          ) : (
            /* 7. Ranked Topic Cards List */
            <div className="space-y-3.5">
              {filteredTopics.map((topic, index) => {
                const isWeak = topic.tier === "weak";
                const isMedium = topic.tier === "medium";
                const isStrong = topic.tier === "strong";
                const isNotAssessed = topic.tier === "not_assessed";

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
                  : isStrong
                  ? "bg-emerald-500"
                  : "bg-slate-300";

                const sourceDocTitle = topic.materialId
                  ? materialTitleMap.get(topic.materialId)
                  : null;

                const gaps = extractConceptualGapsFromTopic(topic);
                const totalMistakes = gaps.reduce((acc, g) => acc + g.mistakeCount, 0);

                return (
                  <div
                    key={topic.id}
                    className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs transition-colors hover:border-slate-300"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 font-mono text-[11px] font-semibold text-slate-700">
                            #{index + 1}
                          </span>
                          <h3 className="text-sm font-semibold text-slate-900">
                            {topic.name}
                          </h3>

                          {/* Tier Badge */}
                          <span
                            className={`rounded border px-2 py-0.5 text-[10.5px] font-semibold capitalize ${badgeClass}`}
                          >
                            {isNotAssessed
                              ? "Not Assessed"
                              : `${topic.tier} · ${topic.mastery}%`}
                          </span>
                        </div>

                        {/* Meta: Module, Questions Answered, Last Practiced */}
                        <p className="mt-1 text-xs text-slate-500">
                          Module:{" "}
                          <span className="font-medium text-slate-700">
                            {topic.module}
                          </span>{" "}
                          · {topic.questionsAnswered} questions answered · Last
                          practiced: {topic.lastPracticed}
                        </p>

                        {/* Source Document and Page Citations */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          {sourceDocTitle ? (
                            <span
                              className="font-medium text-slate-600 truncate max-w-[240px]"
                              title={sourceDocTitle}
                            >
                              📄 {sourceDocTitle}
                            </span>
                          ) : null}

                          {topic.sourcePageNumbers &&
                          topic.sourcePageNumbers.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <span>•</span>
                              <span>
                                Page references:{" "}
                                <span className="font-mono text-slate-700">
                                  {topic.sourcePageNumbers
                                    .map((p) => `p. ${p}`)
                                    .join(", ")}
                                </span>
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Topic Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartQuizForTopic(topic.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
                        >
                          <span>
                            {isNotAssessed ? "Take Diagnostic" : "Retest Topic"}
                          </span>
                          <ArrowRightIcon className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate("revision-planner")}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Plan Revision
                        </button>
                      </div>
                    </div>

                    {/* Mastery Bar */}
                    <div className="mt-3.5">
                      <div className="flex justify-between text-[10.5px] font-medium text-slate-500 mb-1">
                        <span>Mastery Benchmark</span>
                        <span>
                          {isNotAssessed
                            ? "Awaiting Quiz"
                            : `${topic.mastery}%`}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${barClass}`}
                          style={{
                            width: isNotAssessed ? "0%" : `${topic.mastery}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Evidence-Based Diagnostic Assessment */}
                    <div className="mt-3 rounded-md border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-700">
                      <span className="font-semibold text-slate-900">
                        Diagnostic Assessment:
                      </span>{" "}
                      {topic.explanation}
                    </div>

                    {/* Observed Conceptual Gaps: Grouped, grounded knowledge gaps */}
                    {gaps.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-rose-200/90 bg-rose-50/50 p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200/70 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10.5px] font-bold text-white">
                              !
                            </span>
                            <h4 className="text-xs font-semibold text-rose-950">
                              Identified Knowledge Gaps
                            </h4>
                          </div>
                          <span className="rounded-md border border-rose-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-rose-800">
                            {totalMistakes} mistake{totalMistakes !== 1 ? "s" : ""} across {gaps.length} concept{gaps.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        <div className="mt-2.5 space-y-2.5">
                          {gaps.map((gap) => (
                            <div
                              key={gap.id}
                              className="rounded-md border border-rose-200/80 bg-white p-3 text-xs shadow-2xs"
                            >
                              {gap.isFallback ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                                      Uncategorized Assessment Miss
                                    </span>
                                    <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-rose-700">
                                      {gap.mistakeCount} {gap.mistakeCount === 1 ? "mistake" : "mistakes"}
                                    </span>
                                  </div>
                                  <div className="text-slate-800 font-medium">
                                    &ldquo;{gap.questions[0] || gap.problem}&rdquo;
                                  </div>
                                  <p className="text-[11px] text-slate-500">
                                    <strong className="text-slate-700">Recommended action:</strong> {gap.recommendedAction}
                                    {gap.sourceCitation ? ` · Source: ${gap.sourceCitation}` : ""}
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-slate-600">Knowledge gap:</span>
                                      <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-950">
                                        {gap.concept}
                                      </span>
                                    </div>
                                    <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-rose-700">
                                      {gap.mistakeCount} {gap.mistakeCount === 1 ? "mistake" : "mistakes"}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 gap-1 text-[11.5px] pt-0.5">
                                    <div>
                                      <span className="font-semibold text-slate-700">Problem:</span>{" "}
                                      <span className="text-rose-900 font-medium">{gap.problem}</span>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-slate-700">Recommended action:</span>{" "}
                                      <span className="text-slate-800">{gap.recommendedAction}</span>
                                    </div>
                                    {gap.sourceCitation ? (
                                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                                        <span className="font-semibold text-slate-700">Source:</span>{" "}
                                        <span className="font-mono font-medium text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                                          {gap.sourceCitation}
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>

                                  {/* Underlying assessed questions (grouped) */}
                                  {gap.questions && gap.questions.length > 0 ? (
                                    <div className="mt-1 border-t border-slate-100 pt-1.5 text-[10.5px] text-slate-500">
                                      <span className="font-medium text-slate-600">
                                        Assessed question{gap.questions.length > 1 ? "s" : ""}:
                                      </span>
                                      <ul className="mt-0.5 space-y-0.5">
                                        {gap.questions.map((q, qIdx) => (
                                          <li key={qIdx} className="text-slate-600 italic">
                                            &ldquo;{q}&rdquo;
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Key Concepts from Syllabus Mapping */}
                    {topic.keyConcepts && topic.keyConcepts.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">
                          Key Concepts:
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
                    ) : null}

                    {/* Extracted Evidence Quote if available */}
                    {topic.evidenceText ? (
                      <div className="mt-2.5 text-[11px] italic text-slate-500 pl-2.5 border-l-2 border-slate-200">
                        &ldquo;{topic.evidenceText}&rdquo;
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
