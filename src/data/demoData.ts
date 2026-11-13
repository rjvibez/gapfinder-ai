import type {
  DiagnosticQuestion,
  NavItem,
  NotificationItem,
  PriorityRecommendation,
  QuizAttempt,
  RevisionTask,
  StudentProfile,
  StudyMaterial,
  TopicMasteryItem,
} from "@/types/dashboard";

export const DEMO_STUDENT: StudentProfile = {
  name: "Rajesh Mani",
  firstName: "Rajesh",
  initials: "RM",
  program: "AI Engineer",
  email: "rajesh.mani@gapfinder.ai",
  weeklyGoalHours: 15,
  targetAccuracy: 85,
};

export const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Your daily learning summary and priority gaps",
  },
  {
    id: "materials",
    label: "My Materials",
    description: "Uploaded notes, slides, and practice sets",
  },
  {
    id: "topic-map",
    label: "Topic Map",
    description: "Curriculum structure and prerequisite mastery",
  },
  {
    id: "diagnostic-quiz",
    label: "Diagnostic Quiz",
    description: "Short targeted checks to surface knowledge gaps",
  },
  {
    id: "gap-analysis",
    label: "Gap Analysis",
    description: "Detailed breakdown of weak areas and error patterns",
  },
  {
    id: "revision-planner",
    label: "Revision Planner",
    description: "Scheduled study blocks and spaced repetition tasks",
  },
  {
    id: "progress",
    label: "Progress",
    description: "Accuracy trends, study hours, and quiz history",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Study targets, notifications, and account preferences",
  },
];

export const INITIAL_TOPICS: TopicMasteryItem[] = [];

export const QUIZ_ATTEMPTS: QuizAttempt[] = [];

export const PRIORITY_RECOMMENDATIONS: PriorityRecommendation[] = [];

export const INITIAL_REVISION_TASKS: RevisionTask[] = [];

export const INITIAL_MATERIALS: StudyMaterial[] = [];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

export const SAMPLE_DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [];
