"use client";

import { useState } from "react";
import { GapFinderLogo } from "@/components/icons";

interface AuthScreenProps {
  initialError?: string | null;
}

export function AuthScreen({ initialError = null }: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const { supabase } = await import("@/lib/supabase");

      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }
      } else {
        const trimmedName = fullName.trim();
        if (!trimmedName) {
          setError("Please enter your full name.");
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: trimmedName,
              title: title.trim() || "Student",
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (data.user && !data.session) {
          setNotice(
            "Account created. Please check your email to confirm your address, then sign in."
          );
          setMode("signin");
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to Supabase authentication."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-slate-200/90 bg-white p-8 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <GapFinderLogo className="h-8 w-8 shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              GapFinder
            </span>
            <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
              AI
            </span>
          </div>
        </div>

        <h1 className="mt-6 text-xl font-semibold tracking-tight text-slate-900">
          {mode === "signin"
            ? "Sign in to your workspace"
            : "Create your GapFinder account"}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {mode === "signin"
            ? "Access your study materials, diagnostics, and revision plan."
            : "Start tracking topic mastery and uploading study materials."}
        </p>

        <div className="mt-5 grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
              setNotice(null);
            }}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
              mode === "signin"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
              setNotice(null);
            }}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
              mode === "signup"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Sign Up
          </button>
        </div>

        {notice ? (
          <div
            role="status"
            className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
          >
            {notice}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {mode === "signup" ? (
            <>
              <div>
                <label
                  htmlFor="auth-fullname"
                  className="block text-xs font-medium text-slate-700"
                >
                  Full Name
                </label>
                <input
                  id="auth-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Rajesh Mani"
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-title"
                  className="block text-xs font-medium text-slate-700"
                >
                  Role / Title (optional)
                </label>
                <input
                  id="auth-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="AI Engineer"
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                />
              </div>
            </>
          ) : null}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-medium text-slate-700"
            >
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "signin" ? "Enter your password" : "Minimum 6 characters"
              }
              className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="h-9 w-full rounded-md bg-indigo-600 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? mode === "signin"
                ? "Signing in..."
                : "Creating account..."
              : mode === "signin"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

