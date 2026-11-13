"use client";

import { useId, useState } from "react";
import type { StudentProfile } from "@/types/dashboard";

interface SettingsViewProps {
  student: StudentProfile;
  weeklyGoalHours: number;
  onUpdateGoalHours: (hours: number) => void;
  onUpdateProfile?: (updated: {
    name: string;
    program: string;
    weeklyGoalHours: number;
  }) => Promise<void>;
  onRefreshData?: () => Promise<void>;
  onSignOut: () => void;
}

export function SettingsView({
  student,
  weeklyGoalHours,
  onUpdateGoalHours,
  onUpdateProfile,
  onRefreshData,
  onSignOut,
}: SettingsViewProps) {
  const [fullName, setFullName] = useState(student.name);
  const [roleTitle, setRoleTitle] = useState(student.program);
  const [goalHours, setGoalHours] = useState(weeklyGoalHours);

  const fullNameId = useId();
  const roleTitleId = useId();
  const emailId = useId();
  const weeklyGoalId = useId();

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);
    setSaving(true);

    try {
      const sanitizedName = fullName.trim() || student.name;
      const sanitizedRole = roleTitle.trim() || "Student";
      const sanitizedGoal = Math.max(1, Math.min(80, Number(goalHours) || 15));

      onUpdateGoalHours(sanitizedGoal);

      if (onUpdateProfile) {
        await onUpdateProfile({
          name: sanitizedName,
          program: sanitizedRole,
          weeklyGoalHours: sanitizedGoal,
        });
      }

      setSaveSuccess("Profile and weekly study targets successfully saved to Supabase.");
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Failed to save profile changes to Supabase."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshClick = async () => {
    if (!onRefreshData || refreshing) return;
    setRefreshing(true);
    setRefreshNotice(null);
    try {
      await onRefreshData();
      setRefreshNotice("Student profile and database records refreshed from Supabase.");
      setTimeout(() => setRefreshNotice(null), 3500);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Failed to reload data from Supabase."
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <form
        onSubmit={handleSave}
        className="rounded-lg border border-slate-200/90 bg-white p-6 shadow-2xs"
      >
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Student Profile &amp; Preferences
            </h2>
            <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
              Supabase Auth
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Manage your personal profile, academic role, and weekly study targets.
            All preferences are persisted to your authenticated Supabase user profile.
          </p>
        </div>

        {/* Success Alert */}
        {saveSuccess ? (
          <div
            role="status"
            className="mt-4 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
          >
            <span>{saveSuccess}</span>
            <button
              type="button"
              onClick={() => setSaveSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900"
            >
              ✕
            </button>
          </div>
        ) : null}

        {/* Refresh Notice */}
        {refreshNotice ? (
          <div
            role="status"
            className="mt-4 flex items-center justify-between rounded-md border border-indigo-100 bg-indigo-50 px-3.5 py-2.5 text-xs font-medium text-indigo-800"
          >
            <span>{refreshNotice}</span>
            <button
              type="button"
              onClick={() => setRefreshNotice(null)}
              className="text-indigo-700 hover:text-indigo-900"
            >
              ✕
            </button>
          </div>
        ) : null}

        {/* Error Alert */}
        {saveError ? (
          <div
            role="alert"
            className="mt-4 flex items-start justify-between rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
          >
            <span>{saveError}</span>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              className="text-rose-700 hover:text-rose-900"
            >
              ✕
            </button>
          </div>
        ) : null}

        {/* Form Inputs */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Full Name */}
          <div>
            <label
              htmlFor={fullNameId}
              className="block text-xs font-medium text-slate-700"
            >
              Full Name
            </label>
            <input
              id={fullNameId}
              type="text"
              required
              value={fullName}
              disabled={saving}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rajesh Mani"
              className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Displayed on your profile and sidebar avatar
            </p>
          </div>

          {/* Role / Title */}
          <div>
            <label
              htmlFor={roleTitleId}
              className="block text-xs font-medium text-slate-700"
            >
              Role / Academic Title
            </label>
            <input
              id={roleTitleId}
              type="text"
              value={roleTitle}
              disabled={saving}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. AI Engineer or Computer Science Student"
              className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Optional title or degree program
            </p>
          </div>

          {/* Email (Read-Only from Auth) */}
          <div>
            <label
              htmlFor={emailId}
              className="block text-xs font-medium text-slate-700"
            >
              Email Address
            </label>
            <input
              id={emailId}
              type="email"
              readOnly
              value={student.email}
              className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500 cursor-not-allowed select-all"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Authenticated user account in Supabase
            </p>
          </div>

          {/* Weekly Study Goal */}
          <div>
            <label
              htmlFor={weeklyGoalId}
              className="block text-xs font-medium text-slate-700"
            >
              Weekly Study Goal (hours)
            </label>
            <input
              id={weeklyGoalId}
              type="number"
              min={1}
              max={80}
              value={goalHours}
              disabled={saving}
              onChange={(e) =>
                setGoalHours(Math.max(1, Number(e.target.value) || 1))
              }
              className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Persisted across logins to pace your revision schedule
            </p>
          </div>

          {/* Daily Reminders (Clarified as Planned Future Feature) */}
          <div className="sm:col-span-2 rounded-md border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Daily Revision Reminders
                  </span>
                  <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    Coming in v2.0
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Automated email digests and browser notification reminders are
                  scheduled for a future release once background workers are deployed.
                </p>
              </div>

              <input
                type="checkbox"
                disabled
                checked={false}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 opacity-50 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={refreshing || saving}
              onClick={() => void handleRefreshClick()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {refreshing ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
                  <span>Refreshing...</span>
                </>
              ) : (
                <span>Refresh Data</span>
              )}
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors"
            >
              Sign out
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Preferences</span>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
