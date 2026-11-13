import type { NavSectionId, QuizAttempt } from "@/types/dashboard";

interface RecentAttemptsCardProps {
  attempts: QuizAttempt[];
  onNavigate: (id: NavSectionId) => void;
}

export function RecentAttemptsCard({
  attempts,
  onNavigate,
}: RecentAttemptsCardProps) {
  const recent = [...attempts].reverse().slice(0, 5);

  return (
    <section className="rounded-lg border border-slate-200/90 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Recent Diagnostic Attempts
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Quiz dates, scores, and attempt-over-attempt change
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("diagnostic-quiz")}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Take diagnostic
        </button>
      </div>

      {recent.length === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No learning data yet
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Upload study materials and complete your first diagnostic quiz.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                <th className="pb-2.5 pr-3 font-medium">Diagnostic</th>
                <th className="pb-2.5 pr-3 font-medium">Date</th>
                <th className="pb-2.5 pr-3 text-right font-medium">Score</th>
                <th className="pb-2.5 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((attempt) => {
                const deltaText =
                  attempt.improvement > 0
                    ? `+${attempt.improvement}%`
                    : attempt.improvement < 0
                    ? `${attempt.improvement}%`
                    : "Baseline";

                const deltaStyle =
                  attempt.improvement > 0
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                    : attempt.improvement < 0
                    ? "text-rose-700 bg-rose-50 border-rose-200"
                    : "text-slate-600 bg-slate-50 border-slate-200";

                return (
                  <tr key={attempt.id} className="hover:bg-slate-50/60">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-slate-900">
                        {attempt.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {attempt.focusArea} · {attempt.questionsCount} Qs
                      </p>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-slate-500">
                      {attempt.date}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-right font-semibold text-slate-900 tabular-nums">
                      {attempt.score}%
                    </td>
                    <td className="whitespace-nowrap py-3 text-right">
                      <span
                        className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${deltaStyle}`}
                      >
                        {deltaText}
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
  );
}

