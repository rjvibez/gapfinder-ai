import type { QuizAttempt, TopicMasteryItem } from "@/types/dashboard";

interface StatCardsProps {
  topics: TopicMasteryItem[];
  attempts: QuizAttempt[];
  studyHoursThisWeek: number;
  weeklyGoalHours: number;
}

export function StatCards({
  topics,
  attempts,
  studyHoursThisWeek,
  weeklyGoalHours,
}: StatCardsProps) {
  const masteredCount = topics.filter((t) => t.status === "strong").length;
  const improveCount = topics.filter(
    (t) => t.status === "weak" || t.status === "medium"
  ).length;
  const weakCount = topics.filter((t) => t.status === "weak").length;

  const hasAttempts = attempts.length > 0;
  const latestAttempt = hasAttempts ? attempts[attempts.length - 1] : null;
  const latestScore = latestAttempt ? latestAttempt.score : 0;
  const latestDelta = latestAttempt ? latestAttempt.improvement : 0;

  const goalPercentage =
    weeklyGoalHours > 0
      ? Math.round((studyHoursThisWeek / weeklyGoalHours) * 100)
      : 0;

  const cards = [
    {
      label: "Topics Mastered",
      value: topics.length > 0 ? `${masteredCount} / ${topics.length}` : "0",
      delta: topics.length > 0 ? "Strong (≥80%)" : "No topics yet",
      deltaTone:
        topics.length > 0
          ? "text-emerald-700 bg-emerald-50 border-emerald-200/80"
          : "text-slate-600 bg-slate-100 border-slate-200",
      subtext:
        topics.length > 0
          ? "Based on diagnostic mastery"
          : "No topics evaluated yet",
    },
    {
      label: "Topics to Improve",
      value: String(improveCount),
      delta: `${weakCount} high priority`,
      deltaTone:
        weakCount > 0
          ? "text-rose-700 bg-rose-50 border-rose-200/80"
          : "text-slate-600 bg-slate-100 border-slate-200",
      subtext:
        improveCount > 0 ? "Weak or medium mastery" : "No gaps detected yet",
    },
    {
      label: "Quiz Accuracy",
      value: hasAttempts ? `${latestScore}%` : "No attempts yet",
      delta: hasAttempts
        ? `${latestDelta >= 0 ? "+" : ""}${latestDelta}% last quiz`
        : "0 quizzes",
      deltaTone: !hasAttempts
        ? "text-slate-600 bg-slate-100 border-slate-200"
        : latestDelta >= 0
        ? "text-indigo-700 bg-indigo-50 border-indigo-200/80"
        : "text-amber-700 bg-amber-50 border-amber-200/80",
      subtext: hasAttempts
        ? `From ${attempts.length} diagnostic checks`
        : "Complete a diagnostic quiz to track accuracy",
    },
    {
      label: "Study Hours",
      value: studyHoursThisWeek > 0 ? `${studyHoursThisWeek.toFixed(1)}h` : "0",
      delta: `${goalPercentage}% of goal`,
      deltaTone: "text-slate-700 bg-slate-100 border-slate-200",
      subtext: `Weekly target: ${weeklyGoalHours}h`,
    },
  ];

  return (
    <section
      aria-label="Key learning statistics"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-slate-200/90 bg-white p-5 transition-colors hover:border-slate-300"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              {card.label}
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${card.deltaTone}`}
            >
              {card.delta}
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {card.value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{card.subtext}</p>
        </div>
      ))}
    </section>
  );
}
