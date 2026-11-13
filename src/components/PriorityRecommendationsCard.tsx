import type { NavSectionId, PriorityRecommendation } from "@/types/dashboard";
import { ArrowRightIcon, ClockIcon } from "@/components/icons";

interface PriorityRecommendationsCardProps {
  recommendations: PriorityRecommendation[];
  onNavigate: (id: NavSectionId) => void;
}

export function PriorityRecommendationsCard({
  recommendations,
  onNavigate,
}: PriorityRecommendationsCardProps) {
  return (
    <section className="rounded-lg border border-slate-200/90 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Priority Recommendations
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Top 3 topics to revise based on diagnostic gaps and prerequisites
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("gap-analysis")}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          View full analysis
        </button>
      </div>

      {recommendations.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No learning data yet
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Upload study materials and complete your first diagnostic quiz.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {recommendations.map((rec, index) => {
            const statusBadge =
              rec.status === "weak"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-amber-200 bg-amber-50 text-amber-700";

            return (
              <div
                key={rec.id}
                className="flex flex-col justify-between rounded-lg border border-slate-200/90 bg-slate-50/40 p-4 transition-colors hover:border-indigo-200 hover:bg-white"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-indigo-50 text-[11px] font-semibold text-indigo-700">
                      {index + 1}
                    </span>
                    <span
                      className={`rounded border px-2 py-0.5 text-[10.5px] font-medium ${statusBadge}`}
                    >
                      {rec.impactLabel} · {rec.mastery}%
                    </span>
                  </div>

                  <h3 className="mt-3 text-[13.5px] font-semibold leading-snug text-slate-900">
                    {rec.topicName}
                  </h3>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                    {rec.module}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {rec.reason}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3">
                  <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-500">
                    <ClockIcon className="h-3.5 w-3.5 text-slate-400" />
                    {rec.estimatedMinutes} min
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate("revision-planner")}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Revise
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

