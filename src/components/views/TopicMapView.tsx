"use client";

import { useMemo, useState } from "react";
import type {
  NavSectionId,
  StudyMaterial,
  TopicMasteryItem,
  TopicStatus,
} from "@/types/dashboard";

interface TopicMapViewProps {
  topics: TopicMasteryItem[];
  materials?: StudyMaterial[];
  searchQuery: string;
  onRefresh?: () => void;
  onNavigate?: (section: NavSectionId) => void;
  onSelectTopicForQuiz?: (topicId: string) => void;
}

type TopicFilterTab = "all" | "assessed" | "unassessed";

const STATUS_BADGE: Record<TopicStatus, string> = {
  weak: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  strong: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const IMPORTANCE_BADGE: Record<"High" | "Medium" | "Low", string> = {
  High: "border-rose-200 bg-rose-50 text-rose-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-slate-200 bg-slate-50 text-slate-600",
};

export function TopicMapView({
  topics,
  materials = [],
  searchQuery,
  onRefresh,
  onNavigate,
  onSelectTopicForQuiz,
}: TopicMapViewProps) {
  const [extractingMaterialId, setExtractingMaterialId] = useState<string | null>(
    null
  );
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(
    new Set()
  );
  const [activeTab, setActiveTab] = useState<TopicFilterTab>("all");

  // Material ID to Material Title lookup map
  const materialTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of materials) {
      map.set(m.id, m.title);
    }
    return map;
  }, [materials]);

  // Track which materials already have topics extracted
  const mappedMaterialIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of topics) {
      if (t.materialId) {
        set.add(t.materialId);
      }
    }
    return set;
  }, [topics]);

  const unmappedMaterials = useMemo(() => {
    return materials.filter((m) => !mappedMaterialIds.has(m.id));
  }, [materials, mappedMaterialIds]);

  // Topic classification: Assessed vs Mapped (Unassessed)
  const assessedTopics = useMemo(() => {
    return topics.filter(
      (t) =>
        t.questionsAnswered > 0 &&
        t.lastPracticed !== "Never" &&
        t.lastPracticed !== "Not practiced yet"
    );
  }, [topics]);

  const unassessedTopics = useMemo(() => {
    return topics.filter(
      (t) =>
        t.questionsAnswered === 0 ||
        t.lastPracticed === "Never" ||
        t.lastPracticed === "Not practiced yet"
    );
  }, [topics]);

  // Filter topics by search query and active tab
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      // Tab filter
      const isAssessed =
        t.questionsAnswered > 0 &&
        t.lastPracticed !== "Never" &&
        t.lastPracticed !== "Not practiced yet";

      if (activeTab === "assessed" && !isAssessed) return false;
      if (activeTab === "unassessed" && isAssessed) return false;

      // Search filter
      if (!normalizedQuery) return true;
      const matchesName = t.name.toLowerCase().includes(normalizedQuery);
      const matchesModule = t.module.toLowerCase().includes(normalizedQuery);
      const matchesConcepts =
        t.keyConcepts &&
        t.keyConcepts.some((c) => c.toLowerCase().includes(normalizedQuery));
      const matchesSubtopics =
        t.subtopics &&
        t.subtopics.some((s) => s.toLowerCase().includes(normalizedQuery));

      return (
        matchesName || matchesModule || matchesConcepts || matchesSubtopics
      );
    });
  }, [topics, activeTab, normalizedQuery]);

  const modules = useMemo(() => {
    return Array.from(new Set(filteredTopics.map((t) => t.module)));
  }, [filteredTopics]);

  const handleToggleExpand = (topicId: string) => {
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

  const handleExpandAll = () => {
    setExpandedTopicIds(new Set(filteredTopics.map((t) => t.id)));
  };

  const handleCollapseAll = () => {
    setExpandedTopicIds(new Set());
  };

  const handleExtract = async (materialId: string) => {
    setExtractError(null);
    setExtractSuccess(null);
    setExtractingMaterialId(materialId);

    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Authentication session expired. Please sign in again."
        );
      }

      const res = await fetch("/api/topics/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ materialId }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        topicsCount?: number;
      };

      if (!res.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to extract syllabus topics from this study material."
        );
      }

      const count = data.topicsCount ?? 0;
      setExtractSuccess(
        `Successfully extracted and mapped ${count} curriculum topic${
          count === 1 ? "" : "s"
        } with verified page citations!`
      );
      onRefresh?.();
    } catch (err) {
      setExtractError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while mapping topics."
      );
    } finally {
      setExtractingMaterialId(null);
    }
  };

  const handleStartQuizForTopic = (topicId: string) => {
    onSelectTopicForQuiz?.(topicId);
    onNavigate?.("diagnostic-quiz");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Topic Map</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Interactive curriculum knowledge graph parsed directly from your
              uploaded study materials with page citations and prerequisite tracking.
            </p>
          </div>

          {topics.length > 0 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExpandAll}
                className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Expand all
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Collapse all
              </button>
            </div>
          ) : null}
        </div>

        {/* Status Alerts */}
        {extractSuccess ? (
          <div
            role="status"
            className="mt-4 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-emerald-600 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>{extractSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setExtractSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900"
            >
              ✕
            </button>
          </div>
        ) : null}

        {extractError ? (
          <div
            role="alert"
            className="mt-4 flex items-start justify-between rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
          >
            <div className="flex items-start gap-2">
              <svg
                className="mt-0.5 h-4 w-4 text-rose-600 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{extractError}</span>
            </div>
            <button
              type="button"
              onClick={() => setExtractError(null)}
              className="text-rose-700 hover:text-rose-900"
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>

      {/* 2. Extraction Action Banner when unmapped materials exist */}
      {unmappedMaterials.length > 0 && materials.length > 0 ? (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                <h3 className="text-xs font-semibold text-indigo-900">
                  {unmappedMaterials.length} Unmapped Study Material
                  {unmappedMaterials.length === 1 ? "" : "s"} Ready
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-indigo-700">
                Extract syllabus topics and subtopics from your newly uploaded
                documents to incorporate them into your knowledge graph.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {unmappedMaterials.map((mat) => {
                const isExtracting = extractingMaterialId === mat.id;
                return (
                  <button
                    key={mat.id}
                    type="button"
                    disabled={Boolean(extractingMaterialId)}
                    onClick={() => void handleExtract(mat.id)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isExtracting ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Analyzing with AI...</span>
                      </>
                    ) : (
                      <>
                        <span>Map Topics from &ldquo;{mat.title}&rdquo;</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* 3. Empty State 1: No study materials exist at all */}
      {materials.length === 0 ? (
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
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>

          <h3 className="text-base font-semibold text-slate-900">
            Welcome to your Topic Knowledge Map
          </h3>
          <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-slate-500">
            The Topic Map is your interactive curriculum graph. When you upload
            study materials, GapFinder AI parses the document page-by-page, extracts
            the syllabus hierarchy, identifies prerequisites, and tracks your
            diagnostic quiz mastery across every topic.
          </p>

          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3 text-left">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="font-semibold text-indigo-700 text-xs">
                1. Upload PDF
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Add lecture slides, textbook chapters, or problem sets in My
                Materials.
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="font-semibold text-indigo-700 text-xs">
                2. Extract Topics
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                AI extracts verified subtopics, key concepts, formulas, and page
                citations.
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="font-semibold text-indigo-700 text-xs">
                3. Diagnose Mastery
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Take quizzes to categorize topics as Weak, Medium, or Strong.
              </p>
            </div>
          </div>

          <div className="mt-7">
            <button
              type="button"
              onClick={() => onNavigate?.("materials")}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <span>Upload Study Material to Get Started</span>
            </button>
          </div>
        </div>
      ) : topics.length === 0 ? (
        /* 4. Empty State 2: Materials exist, but topics have not been extracted yet */
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
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
          </div>

          <h3 className="text-base font-semibold text-slate-900">
            Study Materials Uploaded · Ready to Map Topics
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
            You have {materials.length} study material
            {materials.length === 1 ? "" : "s"} in your library, but topics have
            not been extracted yet. Click below to analyze your document and
            construct your syllabus map.
          </p>

          <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2.5">
            {materials.map((mat) => {
              const isExtracting = extractingMaterialId === mat.id;
              return (
                <button
                  key={mat.id}
                  type="button"
                  disabled={Boolean(extractingMaterialId)}
                  onClick={() => void handleExtract(mat.id)}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/30 disabled:opacity-50"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      {mat.title}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {mat.course || "General Study"} · {mat.pageCount ?? 1} pages
                    </p>
                  </div>
                  <div className="shrink-0">
                    {isExtracting ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-indigo-600">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                        Mapping...
                      </span>
                    ) : (
                      <span className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white shadow-2xs">
                        Map Topics →
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* 5. Main Topic Map Display */
        <div className="space-y-5">
          {/* Status Metric Breakdown & Tabs (Distinguishing Unmapped, Mapped, Assessed) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500">
                Total Topics Mapped
              </span>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {topics.length}
              </p>
              <p className="text-[11px] text-slate-400">
                Across {modules.length} curriculum module{modules.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-emerald-700">
                Assessed Topics
              </span>
              <p className="mt-1 text-lg font-bold text-emerald-800">
                {assessedTopics.length}
              </p>
              <p className="text-[11px] text-emerald-600">
                Verified with diagnostic quiz attempts
              </p>
            </div>

            <div className="rounded-lg border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-indigo-700">
                Mapped · Unassessed
              </span>
              <p className="mt-1 text-lg font-bold text-indigo-800">
                {unassessedTopics.length}
              </p>
              <p className="text-[11px] text-indigo-600">
                Ready for diagnostic baseline test
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                All Topics ({topics.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("assessed")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === "assessed"
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Assessed ({assessedTopics.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("unassessed")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === "unassessed"
                    ? "bg-white text-indigo-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Mapped / Unassessed ({unassessedTopics.length})
              </button>
            </div>

            <span className="text-xs text-slate-500">
              Showing {filteredTopics.length} of {topics.length} topics
            </span>
          </div>

          {/* Empty State when filter or search query returns 0 matches */}
          {filteredTopics.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-2xs">
              <p className="text-sm font-semibold text-slate-800">
                No topics match your current filter
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {searchQuery
                  ? `No topics found matching "${searchQuery}".`
                  : activeTab === "assessed"
                  ? "You have not completed diagnostic quizzes for any topics yet."
                  : "All topics have already been assessed."}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Show all topics
              </button>
            </div>
          ) : (
            /* Module & Topic Grid Hierarchy */
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {modules.map((mod) => {
                const modTopics = filteredTopics.filter((t) => t.module === mod);

                return (
                  <div
                    key={mod}
                    className="flex flex-col justify-between rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs"
                  >
                    <div>
                      {/* Module Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Curriculum Module
                          </span>
                          <h3 className="text-sm font-semibold text-slate-900">
                            {mod}
                          </h3>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                          {modTopics.length} topic
                          {modTopics.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      {/* Topic List */}
                      <ul className="mt-3.5 space-y-3">
                        {modTopics.map((topic) => {
                          const isExpanded = expandedTopicIds.has(topic.id);
                          const importance = topic.importance ?? "Medium";
                          const isAssessed =
                            topic.questionsAnswered > 0 &&
                            topic.lastPracticed !== "Never" &&
                            topic.lastPracticed !== "Not practiced yet";

                          const sourceDocTitle = topic.materialId
                            ? materialTitleMap.get(topic.materialId)
                            : null;

                          return (
                            <li
                              key={topic.id}
                              className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3.5 transition-colors hover:border-slate-300"
                            >
                              {/* Top Bar: Topic Name & Status Badges */}
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[13.5px] font-semibold text-slate-900">
                                      {topic.name}
                                    </span>
                                    <span
                                      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize ${IMPORTANCE_BADGE[importance]}`}
                                    >
                                      {importance}
                                    </span>

                                    {/* Mapped vs Assessed Badge */}
                                    {isAssessed ? (
                                      <span
                                        className={`rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize ${STATUS_BADGE[topic.status]}`}
                                      >
                                        Assessed · {topic.mastery}% ({topic.status})
                                      </span>
                                    ) : (
                                      <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                                        Mapped · Unassessed
                                      </span>
                                    )}
                                  </div>

                                  {/* Source Document & Page Citations */}
                                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                    {sourceDocTitle ? (
                                      <span className="truncate max-w-[200px] text-slate-600 font-medium" title={sourceDocTitle}>
                                        📄 {sourceDocTitle}
                                      </span>
                                    ) : null}

                                    {topic.sourcePageNumbers &&
                                    topic.sourcePageNumbers.length > 0 ? (
                                      <span className="inline-flex items-center gap-1 text-slate-500">
                                        <span>•</span>
                                        <span>
                                          Pages:{" "}
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

                                {/* Header Actions: Details Toggle + Quiz Button */}
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleExpand(topic.id)}
                                    className="text-xs font-medium text-slate-600 hover:text-slate-900"
                                  >
                                    {isExpanded ? "Hide" : "Details"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleStartQuizForTopic(topic.id)
                                    }
                                    className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                                  >
                                    {isAssessed ? "Re-test" : "Take Quiz"}
                                  </button>
                                </div>
                              </div>

                              {/* Prerequisites: Only displayed when supported by extracted evidence */}
                              {topic.prerequisites &&
                              topic.prerequisites.length > 0 ? (
                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 border-t border-slate-200/60 pt-2">
                                  <span className="font-semibold text-slate-700">
                                    Prerequisites:
                                  </span>
                                  {topic.prerequisites.map((req, idx) => (
                                    <span
                                      key={idx}
                                      className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-700"
                                    >
                                      {req}
                                    </span>
                                  ))}
                                </div>
                              ) : null}

                              {/* Expandable Hierarchy & Deep Details */}
                              {isExpanded ? (
                                <div className="mt-3 space-y-2.5 border-t border-slate-200/80 pt-3 text-xs">
                                  {/* Subtopics Hierarchy Tree */}
                                  {topic.subtopics &&
                                  topic.subtopics.length > 0 ? (
                                    <div>
                                      <span className="font-semibold text-slate-800">
                                        Subtopics Hierarchy:
                                      </span>
                                      <div className="mt-1.5 space-y-1 pl-2 border-l-2 border-indigo-200">
                                        {topic.subtopics.map((sub, idx) => (
                                          <div
                                            key={idx}
                                            className="flex items-start gap-1.5 text-slate-600 text-[11.5px]"
                                          >
                                            <span className="text-indigo-500 font-bold">
                                              ↳
                                            </span>
                                            <span>{sub}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {/* Learning Objectives */}
                                  {topic.learningObjectives &&
                                  topic.learningObjectives.length > 0 ? (
                                    <div>
                                      <span className="font-semibold text-slate-800">
                                        Learning Objectives:
                                      </span>
                                      <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11.5px] text-slate-600">
                                        {topic.learningObjectives.map(
                                          (obj, idx) => (
                                            <li key={idx}>{obj}</li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  ) : null}

                                  {/* Key Concepts */}
                                  {topic.keyConcepts &&
                                  topic.keyConcepts.length > 0 ? (
                                    <div>
                                      <span className="font-semibold text-slate-800">
                                        Key Concepts:
                                      </span>
                                      <div className="mt-1 flex flex-wrap gap-1.5">
                                        {topic.keyConcepts.map((c, idx) => (
                                          <span
                                            key={idx}
                                            className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                                          >
                                            {c}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {/* Formulas */}
                                  {topic.formulas &&
                                  topic.formulas.length > 0 ? (
                                    <div>
                                      <span className="font-semibold text-slate-800">
                                        Formulas & Equations:
                                      </span>
                                      <div className="mt-1 space-y-1">
                                        {topic.formulas.map((f, idx) => (
                                          <code
                                            key={idx}
                                            className="block rounded bg-white border border-slate-200 px-2 py-1 font-mono text-[11px] text-indigo-900"
                                          >
                                            {f}
                                          </code>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {/* Evidence Quote from Document */}
                                  {topic.evidenceText ? (
                                    <div className="rounded-md border border-slate-200/80 bg-white p-2.5 text-[11.5px] text-slate-600">
                                      <span className="font-semibold text-slate-800">
                                        Extracted Evidence Citation:
                                      </span>{" "}
                                      &ldquo;{topic.evidenceText}&rdquo;
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
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
