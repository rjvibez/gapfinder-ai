"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  DEMO_STUDENT,
  INITIAL_NOTIFICATIONS,
  INITIAL_REVISION_TASKS,
  INITIAL_TOPICS,
  NAV_ITEMS,
  PRIORITY_RECOMMENDATIONS,
  QUIZ_ATTEMPTS,
} from "@/data/demoData";
import type {
  NavSectionId,
  NotificationItem,
  PriorityRecommendation,
  QuizAttempt,
  RevisionTask,
  StudentProfile,
  StudyMaterial,
  TopicMasteryItem,
} from "@/types/dashboard";
import { AuthScreen } from "@/components/AuthScreen";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { StatCards } from "@/components/StatCards";
import { LearningProgressChart } from "@/components/LearningProgressChart";
import { TopicMasteryCard } from "@/components/TopicMasteryCard";
import { PriorityRecommendationsCard } from "@/components/PriorityRecommendationsCard";
import { RevisionPlanCard } from "@/components/RevisionPlanCard";
import { RecentAttemptsCard } from "@/components/RecentAttemptsCard";
import { MaterialsView } from "@/components/views/MaterialsView";
import { TopicMapView } from "@/components/views/TopicMapView";
import { DiagnosticQuizView } from "@/components/views/DiagnosticQuizView";
import { GapAnalysisView } from "@/components/views/GapAnalysisView";
import { RevisionPlannerView } from "@/components/views/RevisionPlannerView";
import { ProgressView } from "@/components/views/ProgressView";
import { SettingsView } from "@/components/views/SettingsView";

function buildStudentProfile(user: User): StudentProfile {
  const metadata = user.user_metadata as
    | {
        full_name?: unknown;
        title?: unknown;
        weekly_goal_hours?: unknown;
        target_accuracy?: unknown;
      }
    | undefined;

  const rawName =
    typeof metadata?.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : DEMO_STUDENT.name;

  const parts = rawName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || rawName;
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : rawName.slice(0, 2).toUpperCase();

  const program =
    typeof metadata?.title === "string" && metadata.title.trim()
      ? metadata.title.trim()
      : DEMO_STUDENT.program;

  const weeklyGoalHours =
    typeof metadata?.weekly_goal_hours === "number" &&
    metadata.weekly_goal_hours > 0
      ? metadata.weekly_goal_hours
      : DEMO_STUDENT.weeklyGoalHours;

  const targetAccuracy =
    typeof metadata?.target_accuracy === "number" &&
    metadata.target_accuracy > 0
      ? metadata.target_accuracy
      : DEMO_STUDENT.targetAccuracy;

  return {
    name: rawName,
    firstName,
    initials,
    program,
    email: user.email || DEMO_STUDENT.email,
    weeklyGoalHours,
    targetAccuracy,
  };
}

export function DashboardShell() {
  const [authStatus, setAuthStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authInitError, setAuthInitError] = useState<string | null>(null);

  const [activeNav, setActiveNav] = useState<NavSectionId>("overview");
  const [selectedQuizTopicId, setSelectedQuizTopicId] = useState<string | undefined>();
  const [quizNotice, setQuizNotice] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [topics, setTopics] = useState<TopicMasteryItem[]>(INITIAL_TOPICS);
  const [attempts, setAttempts] = useState<QuizAttempt[]>(QUIZ_ATTEMPTS);
  const [recommendations, setRecommendations] = useState<
    PriorityRecommendation[]
  >(PRIORITY_RECOMMENDATIONS);
  const [tasks, setTasks] = useState<RevisionTask[]>(INITIAL_REVISION_TASKS);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    INITIAL_NOTIFICATIONS
  );
  const [weeklyGoalHours, setWeeklyGoalHours] = useState(
    DEMO_STUDENT.weeklyGoalHours
  );

  const loadStudentData = useCallback(async (userId: string) => {
    try {
      const { supabase } = await import("@/lib/supabase");

      const [materialsRes, topicsRes, attemptsRes, recsRes, tasksRes] =
        await Promise.all([
          supabase
            .from("materials")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
          supabase
            .from("topics")
            .select(
              "id, name, module, mastery, status, questions_answered, last_practiced, error_pattern, prerequisites, material_id, importance, learning_objectives, key_concepts, definitions, formulas, subtopics, source_page_numbers, evidence_text"
            )
            .eq("user_id", userId),
          supabase
            .from("quiz_attempts")
            .select("*")
            .eq("user_id", userId),
          supabase
            .from("priority_recommendations")
            .select(
              "id, topic_id, topic_name, module, mastery, status, reason, impact_label, estimated_minutes"
            )
            .eq("user_id", userId)
            .limit(3),
          supabase
            .from("revision_tasks")
            .select(
              "id, time_slot, title, topic_name, type, duration_minutes, priority, completed, scheduled_date, learning_objectives, topic_id"
            )
            .eq("user_id", userId),
        ]);

      if (!materialsRes.error && Array.isArray(materialsRes.data)) {
        setMaterials(
          materialsRes.data.map((row) => ({
            id: String(row.id),
            title: String(row.title ?? "Untitled Material"),
            fileName: row.file_name ? String(row.file_name) : undefined,
            course: String(row.course ?? "General Study"),
            fileSize:
              typeof row.file_size === "number" ? row.file_size : undefined,
            pageCount:
              typeof row.page_count === "number" ? row.page_count : 0,
            chunkCount:
              typeof row.chunk_count === "number" ? row.chunk_count : 0,
            type: "PDF Notes",
            uploadedAt: row.created_at
              ? new Date(String(row.created_at)).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Recently",
            topicsCovered: Number(row.page_count ?? 0),
            status:
              row.status === "Reviewed" || row.status === "Needs Review"
                ? row.status
                : "Indexed",
          }))
        );
      }

      if (!topicsRes.error && Array.isArray(topicsRes.data)) {
        setTopics(
          topicsRes.data.map((row) => ({
            id: String(row.id),
            name: String(row.name),
            module: String(row.module ?? "General"),
            mastery: Number(row.mastery ?? 0),
            status:
              row.status === "weak" ||
              row.status === "medium" ||
              row.status === "strong"
                ? row.status
                : "weak",
            questionsAnswered: Number(row.questions_answered ?? 0),
            lastPracticed: String(row.last_practiced ?? "Never"),
            errorPattern: row.error_pattern
              ? String(row.error_pattern)
              : undefined,
            prerequisites: Array.isArray(row.prerequisites)
              ? row.prerequisites.map(String)
              : undefined,
            materialId: row.material_id ? String(row.material_id) : undefined,
            importance:
              row.importance === "High" ||
              row.importance === "Medium" ||
              row.importance === "Low"
                ? row.importance
                : "Medium",
            learningObjectives: Array.isArray(row.learning_objectives)
              ? row.learning_objectives.map(String)
              : undefined,
            keyConcepts: Array.isArray(row.key_concepts)
              ? row.key_concepts.map(String)
              : undefined,
            formulas: Array.isArray(row.formulas)
              ? row.formulas.map(String)
              : undefined,
            subtopics: Array.isArray(row.subtopics)
              ? row.subtopics.map(String)
              : undefined,
            sourcePageNumbers: Array.isArray(row.source_page_numbers)
              ? row.source_page_numbers.map(Number)
              : undefined,
            evidenceText: row.evidence_text
              ? String(row.evidence_text)
              : undefined,
          }))
        );
      }

      if (!attemptsRes.error && Array.isArray(attemptsRes.data)) {
        const sortedAttempts = [...attemptsRes.data].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateA - dateB;
        });

        const mappedAttempts: QuizAttempt[] = sortedAttempts.map((row) => {
          const rawDate = row.date || row.created_at;
          const dateObj = rawDate ? new Date(rawDate) : new Date();
          const dateFormatted = dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const shortDateFormatted = dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });

          return {
            id: String(row.id),
            topicId: row.topic_id ? String(row.topic_id) : undefined,
            title: String(row.title ?? "Diagnostic Quiz"),
            date: String(row.date || dateFormatted),
            shortDate: String(row.short_date || shortDateFormatted),
            score: Number(row.score ?? 0),
            improvement: Number(row.improvement ?? 0),
            questionsCount: Number(row.questions_count ?? 5),
            durationMinutes: Number(row.duration_minutes ?? 5),
            focusArea: String(row.focus_area ?? "General"),
          };
        });

        setAttempts(mappedAttempts);
      } else if (attemptsRes.error) {
        console.error("[DashboardShell] Failed to fetch quiz_attempts:", {
          message: attemptsRes.error.message,
          code: attemptsRes.error.code,
          details: attemptsRes.error.details,
          hint: attemptsRes.error.hint,
        });
      }

      if (!recsRes.error && Array.isArray(recsRes.data)) {
        setRecommendations(
          recsRes.data.map((row) => ({
            id: String(row.id),
            topicId: String(row.topic_id),
            topicName: String(row.topic_name),
            module: String(row.module ?? "General"),
            mastery: Number(row.mastery ?? 0),
            status:
              row.status === "weak" ||
              row.status === "medium" ||
              row.status === "strong"
                ? row.status
                : "weak",
            reason: String(row.reason ?? ""),
            impactLabel: String(row.impact_label ?? "Priority"),
            estimatedMinutes: Number(row.estimated_minutes ?? 15),
          }))
        );
      }

      if (!tasksRes.error && Array.isArray(tasksRes.data)) {
        setTasks(
          tasksRes.data.map((row) => ({
            id: String(row.id),
            timeSlot: String(row.time_slot ?? "09:00"),
            title: String(row.title),
            topicName: String(row.topic_name ?? "General"),
            type:
              row.type === "Concept Review" ||
              row.type === "Practice Set" ||
              row.type === "Error Log" ||
              row.type === "Quick Recall"
                ? row.type
                : "Concept Review",
            durationMinutes: Number(row.duration_minutes ?? 15),
            priority:
              row.priority === "High" ||
              row.priority === "Medium" ||
              row.priority === "Low"
                ? row.priority
                : "Medium",
            completed: Boolean(row.completed),
            scheduledDate: row.scheduled_date ? String(row.scheduled_date) : undefined,
            learningObjectives: Array.isArray(row.learning_objectives)
              ? row.learning_objectives.map(String)
              : undefined,
            topicId: row.topic_id ? String(row.topic_id) : undefined,
          }))
        );
      }
    } catch {
      // Keep clean empty state if tables are not yet populated.
    }
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;

    const initAuth = async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (error) {
          setAuthInitError(error.message);
          setAuthUser(null);
          setAuthStatus("unauthenticated");
        } else if (session?.user) {
          setAuthUser(session.user);
          setAuthStatus("authenticated");
          const profile = buildStudentProfile(session.user);
          setWeeklyGoalHours(profile.weeklyGoalHours);
          await loadStudentData(session.user.id);
        } else {
          setAuthUser(null);
          setAuthStatus("unauthenticated");
        }

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (!active) return;
          if (nextSession?.user) {
            setAuthUser(nextSession.user);
            setAuthStatus("authenticated");
            const profile = buildStudentProfile(nextSession.user);
            setWeeklyGoalHours(profile.weeklyGoalHours);
            void loadStudentData(nextSession.user.id);
          } else {
            setAuthUser(null);
            setAuthStatus("unauthenticated");
            setTopics([]);
            setAttempts([]);
            setRecommendations([]);
            setTasks([]);
            setMaterials([]);
          }
        });

        unsubscribe = () => subscription.unsubscribe();
      } catch (err) {
        if (!active) return;
        setAuthInitError(
          err instanceof Error
            ? err.message
            : "Supabase authentication is not configured."
        );
        setAuthStatus("unauthenticated");
      }
    };

    void initAuth();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [loadStudentData]);

  const handleSignOut = async () => {
    try {
      const { supabase } = await import("@/lib/supabase");
      await supabase.auth.signOut();
    } catch {
      // Fall through to local state reset.
    }
    setAuthUser(null);
    setAuthStatus("unauthenticated");
    setActiveNav("overview");
    setTopics([]);
    setAttempts([]);
    setRecommendations([]);
    setTasks([]);
    setMaterials([]);
  };

  if (authStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-4 text-xs font-medium text-slate-600">
          Checking authentication session...
        </div>
      </div>
    );
  }

  if (authStatus === "unauthenticated" || !authUser) {
    return <AuthScreen initialError={authInitError} />;
  }

  const currentStudent = buildStudentProfile(authUser);

  const activeNavItem =
    NAV_ITEMS.find((item) => item.id === activeNav) ?? NAV_ITEMS[0];

  const handleToggleTask = async (taskId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    const nextCompleted = !target.completed;

    // Optimistically update local state
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, completed: nextCompleted } : task
      )
    );

    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        await fetch("/api/planner/toggle", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ taskId, completed: nextCompleted }),
        });
      }
    } catch {
      // Revert if network error
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, completed: target.completed } : task
        )
      );
    }
  };

  const handleResetTasks = () => {
    setSearchQuery("");
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleUpdateProfile = async ({
    name,
    program,
    weeklyGoalHours: newGoal,
  }: {
    name: string;
    program: string;
    weeklyGoalHours: number;
  }) => {
    const { supabase } = await import("@/lib/supabase");
    const { data, error } = await supabase.auth.updateUser({
      data: {
        full_name: name.trim(),
        title: program.trim(),
        weekly_goal_hours: newGoal,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data?.user) {
      setAuthUser(data.user);
      setWeeklyGoalHours(newGoal);
    }
  };

  const handleRefreshData = async () => {
    if (!authUser) return;
    const { supabase } = await import("@/lib/supabase");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setAuthUser(user);
      const profile = buildStudentProfile(user);
      setWeeklyGoalHours(profile.weeklyGoalHours);
    }
    await loadStudentData(authUser.id);
  };

  const completedTasksMinutes = tasks
    .filter((t) => t.completed)
    .reduce((sum, t) => sum + t.durationMinutes, 0);
  const completedAttemptsMinutes = attempts.reduce(
    (sum, a) => sum + a.durationMinutes,
    0
  );
  const studyHoursThisWeek =
    (completedTasksMinutes + completedAttemptsMinutes) / 60;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        items={NAV_ITEMS}
        activeId={activeNav}
        onSelect={setActiveNav}
        student={currentStudent}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSignOut={() => void handleSignOut()}
      />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <Header
          title={activeNavItem.label}
          welcomeMessage={
            activeNav === "overview"
              ? `Welcome back, ${currentStudent.firstName} — ${activeNavItem.description}`
              : activeNavItem.description
          }
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
          student={currentStudent}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNavigate={setActiveNav}
          onSignOut={() => void handleSignOut()}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {activeNav === "overview" ? (
            <div className="space-y-6">
              {/* A. Welcome Section */}
              <section className="rounded-lg border border-slate-200/90 bg-white px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                      Good morning, {currentStudent.firstName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Let&apos;s discover what you know and what needs attention.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setQuizNotice(null);
                        setActiveNav("materials");
                      }}
                      className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-2xs transition-colors hover:bg-indigo-700"
                    >
                      Upload Materials
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (topics.length === 0) {
                          setQuizNotice(
                            "You must upload study materials and map topics first before starting a diagnostic quiz."
                          );
                        } else {
                          setQuizNotice(null);
                          setActiveNav("diagnostic-quiz");
                        }
                      }}
                      title={
                        topics.length === 0
                          ? "Upload study materials and map topics first"
                          : "Start Diagnostic Quiz"
                      }
                      className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
                        topics.length === 0
                          ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Start Diagnostic Quiz
                    </button>
                  </div>
                </div>

                {quizNotice ? (
                  <div
                    role="alert"
                    className="mt-4 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900"
                  >
                    <span>{quizNotice}</span>
                    <button
                      type="button"
                      onClick={() => setQuizNotice(null)}
                      className="ml-3 font-semibold text-amber-700 hover:text-amber-900"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}
              </section>

              {/* B. Statistics */}
              <StatCards
                topics={topics}
                attempts={attempts}
                studyHoursThisWeek={studyHoursThisWeek}
                weeklyGoalHours={weeklyGoalHours}
              />

              {/* C. Learning Progress + D. Topic Mastery */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <div className="xl:col-span-7">
                  <LearningProgressChart attempts={attempts} />
                </div>
                <div className="xl:col-span-5">
                  <TopicMasteryCard
                    topics={topics}
                    searchQuery={searchQuery}
                  />
                </div>
              </div>

              {/* E. Priority Recommendations */}
              <PriorityRecommendationsCard
                recommendations={recommendations}
                onNavigate={setActiveNav}
              />

              {/* F. Today's Revision Plan + G. Recent Diagnostic Attempts */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <div className="xl:col-span-6">
                  <RevisionPlanCard
                    tasks={tasks}
                    searchQuery={searchQuery}
                    onToggleTask={handleToggleTask}
                    onResetTasks={handleResetTasks}
                  />
                </div>
                <div className="xl:col-span-6">
                  <RecentAttemptsCard
                    attempts={attempts}
                    onNavigate={setActiveNav}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {activeNav === "materials" ? (
            <MaterialsView
              searchQuery={searchQuery}
              persistedMaterials={materials}
              onMaterialUploaded={() => void loadStudentData(authUser.id)}
              onNavigate={setActiveNav}
            />
          ) : null}

          {activeNav === "topic-map" ? (
            <TopicMapView
              topics={topics}
              materials={materials}
              searchQuery={searchQuery}
              onRefresh={() => void loadStudentData(authUser.id)}
              onNavigate={setActiveNav}
              onSelectTopicForQuiz={(tid) => setSelectedQuizTopicId(tid)}
            />
          ) : null}

          {activeNav === "diagnostic-quiz" ? (
            <DiagnosticQuizView
              topics={topics}
              preselectedTopicId={selectedQuizTopicId}
              onQuizCompleted={() => void loadStudentData(authUser.id)}
              onNavigate={setActiveNav}
            />
          ) : null}

          {activeNav === "gap-analysis" ? (
            <GapAnalysisView
              topics={topics}
              attempts={attempts}
              materials={materials}
              onNavigate={setActiveNav}
              onSelectTopicForQuiz={(tid) => setSelectedQuizTopicId(tid)}
            />
          ) : null}

          {activeNav === "revision-planner" ? (
            <RevisionPlannerView
              tasks={tasks}
              topics={topics}
              searchQuery={searchQuery}
              onToggleTask={handleToggleTask}
              onNavigate={setActiveNav}
              onSelectTopicForQuiz={(tid) => setSelectedQuizTopicId(tid)}
              onRefresh={() => void loadStudentData(authUser.id)}
            />
          ) : null}

          {activeNav === "progress" ? (
            <ProgressView
              topics={topics}
              attempts={attempts}
              tasks={tasks}
              onNavigate={setActiveNav}
              onRefresh={() => void loadStudentData(authUser.id)}
            />
          ) : null}

          {activeNav === "settings" ? (
            <SettingsView
              student={currentStudent}
              weeklyGoalHours={weeklyGoalHours}
              onUpdateGoalHours={setWeeklyGoalHours}
              onUpdateProfile={handleUpdateProfile}
              onRefreshData={handleRefreshData}
              onSignOut={() => void handleSignOut()}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
