"use client";

import { useId, useState } from "react";
import type {
  DiagnosticQuestion,
  NavSectionId,
  TopicMasteryItem,
  TopicStatus,
} from "@/types/dashboard";

interface DiagnosticQuizViewProps {
  topics?: TopicMasteryItem[];
  preselectedTopicId?: string;
  onQuizCompleted?: () => void;
  onNavigate?: (section: NavSectionId) => void;
}

const STATUS_BADGE: Record<TopicStatus, string> = {
  weak: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  strong: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function DiagnosticQuizView({
  topics = [],
  preselectedTopicId,
  onQuizCompleted,
  onNavigate,
}: DiagnosticQuizViewProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    preselectedTopicId || (topics[0]?.id ?? "")
  );

  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>(
    {}
  );
  const [submitted, setSubmitted] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    score: number;
    correctCount: number;
    total: number;
    status: string;
    updatedMastery: number;
  } | null>(null);

  const topicSelectorId = useId();

  // Sync selection safely with preselectedTopicId if valid
  const effectiveTopicId =
    preselectedTopicId && topics.some((t) => t.id === preselectedTopicId)
      ? preselectedTopicId
      : selectedTopicId || (topics[0]?.id ?? "");

  const activeTopic =
    topics.find((t) => t.id === effectiveTopicId) || topics[0];

  const handleGenerateQuiz = async (topicIdToUse?: string) => {
    const targetTopicId = topicIdToUse || effectiveTopicId;
    if (!targetTopicId) return;

    setGenerating(true);
    setGenerateError(null);
    setSubmitted(false);
    setSelectedAnswers({});
    setCurrentIndex(0);
    setSubmitResult(null);
    setShowSubmitConfirm(false);

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

      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ topicId: targetTopicId }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        questions?: DiagnosticQuestion[];
      };

      if (!res.ok || !data.success || !Array.isArray(data.questions)) {
        throw new Error(
          data.error ||
            "Unable to generate diagnostic questions from your uploaded document."
        );
      }

      if (data.questions.length === 0) {
        throw new Error(
          "No questions could be generated. Please ensure your uploaded material contains relevant text."
        );
      }

      setQuestions(data.questions);
    } catch (err) {
      setGenerateError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while generating the quiz."
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectOption = (optionIndex: number) => {
    if (submitted || submitting) return;
    const currentQ = questions[currentIndex];
    if (!currentQ) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionIndex,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (questions.length === 0 || !activeTopic) return;
    setSubmitting(true);
    setShowSubmitConfirm(false);

    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Authentication required. Please sign in.");
      }

      const answersPayload = questions.map((q) => {
        const chosen = selectedAnswers[q.id] ?? -1;
        return {
          questionId: q.id,
          topic: q.topic,
          prompt: q.prompt,
          selectedOption: chosen,
          selectedAnswerText:
            chosen >= 0 && chosen < q.options.length
              ? q.options[chosen]
              : "No answer selected",
          correctOption: q.correctIndex,
          correctAnswerText: q.options[q.correctIndex] ?? "",
          isCorrect: chosen === q.correctIndex,
          explanation: q.explanation ?? "",
          sourcePages: q.sourcePages ?? [],
          supportingText: q.supportingText ?? "",
        };
      });

      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          topicId: activeTopic.id,
          topicName: activeTopic.name,
          answers: answersPayload,
          durationMinutes: 5,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        score?: number;
        correctCount?: number;
        totalQuestions?: number;
        status?: string;
        updatedMastery?: number;
      };

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "Failed to save diagnostic quiz results to Supabase."
        );
      }

      setSubmitResult({
        score: data.score ?? 0,
        correctCount: data.correctCount ?? 0,
        total: data.totalQuestions ?? questions.length,
        status: data.status ?? "weak",
        updatedMastery: data.updatedMastery ?? data.score ?? 0,
      });

      setSubmitted(true);
      onQuizCompleted?.();
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Failed to submit quiz."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Beginner-friendly Empty State when student has no topics yet
  if (topics.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
          <h2 className="text-base font-semibold text-slate-900">
            Diagnostic Quiz
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Adaptive, low-stakes diagnostic assessments grounded directly in your
            course study materials.
          </p>
        </div>

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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>

          <h3 className="text-base font-semibold text-slate-900">
            What is a Diagnostic Quiz?
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-slate-500">
            A diagnostic quiz is a formative learning tool designed to identify
            what you already understand and pinpoint conceptual gaps needing
            attention. <strong>It is not a final graded exam.</strong> Answering
            incorrectly is a valuable signal that directly shapes your
            Personalized Revision Planner.
          </p>

          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-3.5 sm:grid-cols-3 text-left">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-indigo-700">
                1. Upload Material
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Add your PDF notes or lecture slides in My Materials.
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-indigo-700">
                2. Map Topics
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Extract curriculum topics with page citations in Topic Map.
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-indigo-700">
                3. Take Diagnostic
              </span>
              <p className="mt-1 text-[11px] text-slate-600">
                Answer 5 questions to uncover gaps and calibrate your revision
                plan.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate?.("materials")}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
            >
              <span>Upload Study Material</span>
              <span>→</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.("topic-map")}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Go to Topic Map
            </button>
          </div>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(selectedAnswers).length;
  const currentQ = questions[currentIndex];

  const isAssessed =
    activeTopic &&
    activeTopic.questionsAnswered > 0 &&
    activeTopic.lastPracticed !== "Never" &&
    activeTopic.lastPracticed !== "Not practiced yet";

  return (
    <div className="space-y-6">
      {/* 2. Top Header & Educational Reassurance Banner */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Diagnostic Quiz
              </h2>
              <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                Formative Assessment
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Low-stakes diagnostic assessment designed to uncover what you already
              know and highlight conceptual gaps — not a final exam.
            </p>
          </div>

          {/* Topic Selector & Quiz Generator Trigger */}
          <div className="flex flex-wrap items-center gap-2.5">
            <label
              htmlFor={topicSelectorId}
              className="text-xs font-medium text-slate-600"
            >
              Select Topic:
            </label>
            <select
              id={topicSelectorId}
              value={effectiveTopicId}
              disabled={generating || submitting || (questions.length > 0 && !submitted)}
              onChange={(e) => {
                setSelectedTopicId(e.target.value);
                setQuestions([]);
                setSubmitted(false);
                setSubmitResult(null);
              }}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
            >
              {topics.map((t) => {
                const topicAssessed =
                  t.questionsAnswered > 0 &&
                  t.lastPracticed !== "Never" &&
                  t.lastPracticed !== "Not practiced yet";
                const label = topicAssessed
                  ? `${t.name} (${t.module}) · ${t.mastery}%`
                  : `${t.name} (${t.module}) · Unassessed`;

                return (
                  <option key={t.id} value={t.id}>
                    {label}
                  </option>
                );
              })}
            </select>

            <button
              type="button"
              disabled={generating || !selectedTopicId || submitting}
              onClick={() => void handleGenerateQuiz()}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-2xs transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Generating MCQs...</span>
                </>
              ) : questions.length > 0 && !submitted ? (
                "Restart Quiz"
              ) : questions.length > 0 && submitted ? (
                "New Quiz"
              ) : (
                "Generate Diagnostic Quiz"
              )}
            </button>
          </div>
        </div>

        {/* Low-Stakes Reassurance Note */}
        <div className="mt-4 flex items-start gap-2.5 rounded-md border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-600">
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
            <span className="font-semibold text-slate-800">
              Low-stakes check:
            </span>{" "}
            Take this quiz without worry. Any incorrect answer helps the system
            identify knowledge gaps and automatically recommend focused revision
            tasks.
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {generateError ? (
        <div
          role="alert"
          className="flex items-start justify-between rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
        >
          <div className="flex items-start gap-2">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
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
            <span>{generateError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGenerateError(null)}
            className="text-rose-700 hover:text-rose-900"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* 3. Pre-Quiz Setup View (When questions are not yet generated) */}
      {questions.length === 0 && !generating ? (
        <div className="space-y-4">
          {/* Selected Topic Overview Card */}
          {activeTopic ? (
            <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Selected Syllabus Topic
                  </span>
                  <h3 className="text-base font-semibold text-slate-900">
                    {activeTopic.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Module: {activeTopic.module}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-[11px] font-medium capitalize ${
                      isAssessed
                        ? STATUS_BADGE[activeTopic.status]
                        : "border-indigo-200 bg-indigo-50 text-indigo-700"
                    }`}
                  >
                    {isAssessed
                      ? `Mastery: ${activeTopic.mastery}% (${activeTopic.status})`
                      : "Mapped · Unassessed"}
                  </span>
                </div>
              </div>

              {/* Quiz Parameters & Format Information */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <span className="text-[11px] font-medium text-slate-500">
                    Question Set
                  </span>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    5 Source-Grounded MCQs
                  </p>
                  <p className="text-[10.5px] text-slate-400">
                    Single correct answer with 4 choices
                  </p>
                </div>

                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <span className="text-[11px] font-medium text-slate-500">
                    Estimated Duration
                  </span>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    ~5 Minutes
                  </p>
                  <p className="text-[10.5px] text-slate-400">
                    1 minute recommended per question
                  </p>
                </div>

                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <span className="text-[11px] font-medium text-slate-500">
                    Grounded Source
                  </span>
                  <p className="mt-1 text-sm font-semibold text-slate-800 truncate">
                    Uploaded Document Chunks
                  </p>
                  <p className="text-[10.5px] text-slate-400">
                    Page citations and evidence retained
                  </p>
                </div>
              </div>

              {/* Key Concepts if available */}
              {activeTopic.keyConcepts && activeTopic.keyConcepts.length > 0 ? (
                <div className="mt-4 text-xs">
                  <span className="font-semibold text-slate-700">
                    Concepts Covered:
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {activeTopic.keyConcepts.map((c, i) => (
                      <span
                        key={i}
                        className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => void handleGenerateQuiz()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
                >
                  <span>Start Topic Diagnostic</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 4. Generation Loading State */}
      {generating ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200/90 bg-white p-12 text-center shadow-2xs">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mb-3" />
          <p className="text-sm font-semibold text-slate-800">
            Generating Grounded Diagnostic Quiz...
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Reading your uploaded document chunks for &ldquo;{activeTopic?.name}&rdquo;
            and constructing 5 multiple-choice questions with verified page citations.
          </p>
        </div>
      ) : null}

      {/* 5. Active Quiz Taking Stepper View */}
      {!submitted && questions.length > 0 && currentQ ? (
        <div className="rounded-lg border border-slate-200/90 bg-white p-6 shadow-2xs">
          {/* Progress Bar & Question Step Navigation */}
          <div className="space-y-2 border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-indigo-700">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-slate-500 tabular-nums">
                {answeredCount} of {questions.length} answered
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                style={{
                  width: `${((currentIndex + 1) / questions.length) * 100}%`,
                }}
              />
            </div>

            {/* Stepper Buttons (1 to 5) */}
            <div className="flex items-center justify-center gap-2 pt-2">
              {questions.map((q, idx) => {
                const isAnswered = typeof selectedAnswers[q.id] === "number";
                const isCurrent = idx === currentIndex;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                      isCurrent
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : isAnswered
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Prompt */}
          <div className="mt-5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Question {currentIndex + 1}
            </span>
            <h3 className="mt-1 text-base font-semibold leading-relaxed text-slate-900">
              {currentQ.prompt}
            </h3>
          </div>

          {/* MCQ Options (A, B, C, D) */}
          <div className="mt-5 space-y-2.5">
            {currentQ.options.map((option, idx) => {
              const selected = selectedAnswers[currentQ.id] === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectOption(idx)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-xs transition-colors ${
                    selected
                      ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 font-medium"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                      selected
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 text-slate-500"
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="leading-relaxed">{option}</span>
                </button>
              );
            })}
          </div>

          {/* Navigation & Submission Controls */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>

            <div className="flex items-center gap-2">
              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
                  }
                  className="rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Next question
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 shadow-2xs"
                >
                  <span>Submit Diagnostic</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Submit Diagnostic Quiz?
            </h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              You have answered <strong>{answeredCount}</strong> of{" "}
              <strong>{questions.length}</strong> questions.
            </p>

            {answeredCount < questions.length ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                ⚠️ Notice: You still have unanswered questions. We recommend
                answering every question for an accurate diagnostic baseline,
                though you can submit now.
              </div>
            ) : null}

            <p className="mt-3 text-xs text-slate-500">
              Submitting will grade your responses, reveal explanations with
              page citations, and calibrate your topic mastery in Supabase.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowSubmitConfirm(false)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Review Answers
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmitQuiz()}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Grading & Saving...</span>
                  </>
                ) : (
                  <span>Confirm & Submit</span>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 6. Completed Quiz Results View */}
      {submitted && submitResult ? (
        <div className="rounded-lg border border-slate-200/90 bg-white p-6 shadow-2xs">
          {/* Performance Summary Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  Diagnostic Result · {activeTopic?.name}
                </span>
                <span
                  className={`rounded border px-2 py-0.5 text-[10.5px] font-semibold capitalize ${
                    STATUS_BADGE[
                      submitResult.status === "strong" ||
                      submitResult.status === "medium" ||
                      submitResult.status === "weak"
                        ? submitResult.status
                        : "weak"
                    ]
                  }`}
                >
                  {submitResult.status} Performance
                </span>
              </div>

              <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                Score: {submitResult.score}% ({submitResult.correctCount} / {submitResult.total} correct)
              </h3>

              <p className="mt-1 text-xs text-slate-600">
                Updated Topic Mastery:{" "}
                <strong className="text-slate-900">
                  {submitResult.updatedMastery}%
                </strong>{" "}
                —{" "}
                {submitResult.score >= 80 ? (
                  <span className="text-emerald-700 font-medium">
                    Strong comprehension! Keep practicing to maintain recall.
                  </span>
                ) : submitResult.score >= 50 ? (
                  <span className="text-amber-700 font-medium">
                    Medium foundation. Review key concepts identified below.
                  </span>
                ) : (
                  <span className="text-rose-700 font-medium">
                    Knowledge gaps identified. Prioritized in your Revision Planner.
                  </span>
                )}
              </p>
            </div>

            {/* Quick Actions after quiz */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleGenerateQuiz()}
                className="rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Retake Quiz on this Topic
              </button>
              {onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate("gap-analysis")}
                  className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 shadow-2xs"
                >
                  View in Gap Analysis →
                </button>
              ) : null}
            </div>
          </div>

          {/* List of Questions with Detailed Explanations and Citations */}
          <div className="mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Detailed Question Analysis & Citations
            </h4>

            <ul className="mt-3 space-y-4">
              {questions.map((q, idx) => {
                const chosen = selectedAnswers[q.id];
                const isCorrect = chosen === q.correctIndex;

                return (
                  <li
                    key={q.id}
                    className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-4 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">
                        Question {idx + 1}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-[10.5px] font-semibold ${
                          isCorrect
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {isCorrect ? "✓ Correct (+20%)" : "✕ Incorrect"}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-medium text-slate-900 leading-relaxed">
                      {q.prompt}
                    </p>

                    {/* Options Breakdown */}
                    <div className="mt-3 space-y-1.5">
                      {q.options.map((opt, optIdx) => {
                        const isOptionSelected = chosen === optIdx;
                        const isOptionCorrect = optIdx === q.correctIndex;

                        return (
                          <div
                            key={optIdx}
                            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-xs ${
                              isOptionCorrect
                                ? "border border-emerald-300 bg-emerald-50/70 font-semibold text-emerald-950"
                                : isOptionSelected
                                ? "border border-rose-200 bg-rose-50/80 text-rose-900 font-medium"
                                : "border border-slate-200/60 bg-white text-slate-600"
                            }`}
                          >
                            <span className="h-4 w-4 shrink-0 font-mono text-[11px] font-semibold">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <span className="flex-1 leading-relaxed">{opt}</span>
                            {isOptionCorrect ? (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                                Correct Answer
                              </span>
                            ) : isOptionSelected ? (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                                Your Answer
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation & Source Citations */}
                    <div className="mt-3.5 space-y-2 rounded-md border border-slate-200/80 bg-white p-3 text-slate-700">
                      <div>
                        <span className="font-semibold text-slate-900">
                          Pedagogical Explanation:
                        </span>{" "}
                        <span className="leading-relaxed">{q.explanation}</span>
                      </div>

                      {q.sourcePages && q.sourcePages.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <span className="font-semibold text-slate-700">
                            Source Document Citation:
                          </span>
                          {q.sourcePages.map((p) => (
                            <span
                              key={p}
                              className="rounded bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-indigo-700"
                            >
                              Page {p}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {q.supportingText ? (
                        <div className="text-[11px] italic text-slate-500 pl-2 border-l-2 border-slate-200">
                          &ldquo;{q.supportingText}&rdquo;
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
