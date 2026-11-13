export type NavSectionId =
  | "overview"
  | "materials"
  | "topic-map"
  | "diagnostic-quiz"
  | "gap-analysis"
  | "revision-planner"
  | "progress"
  | "settings";

export interface NavItem {
  id: NavSectionId;
  label: string;
  description: string;
  badge?: string;
}

export type TopicStatus = "weak" | "medium" | "strong";

export interface TopicMasteryItem {
  id: string;
  name: string;
  module: string;
  mastery: number;
  status: TopicStatus;
  questionsAnswered: number;
  lastPracticed: string;
  errorPattern?: string;
  prerequisites?: string[];
  materialId?: string;
  importance?: "High" | "Medium" | "Low";
  learningObjectives?: string[];
  keyConcepts?: string[];
  formulas?: string[];
  subtopics?: string[];
  sourcePageNumbers?: number[];
  evidenceText?: string;
}

export interface QuizAttempt {
  id: string;
  title: string;
  date: string;
  shortDate: string;
  score: number;
  improvement: number;
  questionsCount: number;
  durationMinutes: number;
  focusArea: string;
}

export interface PriorityRecommendation {
  id: string;
  topicId: string;
  topicName: string;
  module: string;
  mastery: number;
  status: TopicStatus;
  reason: string;
  impactLabel: string;
  estimatedMinutes: number;
}

export interface RevisionTask {
  id: string;
  timeSlot: string;
  title: string;
  topicName: string;
  topicId?: string;
  type: "Concept Review" | "Practice Set" | "Error Log" | "Quick Recall";
  durationMinutes: number;
  priority: "High" | "Medium" | "Low";
  completed: boolean;
  scheduledDate?: string;
  learningObjectives?: string[];
}

export interface StudyMaterial {
  id: string;
  title: string;
  course: string;
  type: "PDF Notes" | "Lecture Slides" | "Problem Set" | "Summary Sheet";
  uploadedAt: string;
  topicsCovered: number;
  status: "Indexed" | "Reviewed" | "Needs Review";
  fileName?: string;
  fileSize?: number;
  pageCount?: number;
  chunkCount?: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  timeAgo: string;
  unread: boolean;
}

export interface DiagnosticQuestion {
  id: string;
  topic: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourcePages?: number[];
  supportingText?: string;
}

export interface StudentProfile {
  name: string;
  firstName: string;
  initials: string;
  program: string;
  email: string;
  weeklyGoalHours: number;
  targetAccuracy: number;
}

