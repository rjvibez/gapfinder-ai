import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function extractAccessToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";");
    for (const cookie of cookies) {
      const [rawName, ...rest] = cookie.trim().split("=");
      if (rawName === "sb-access-token") {
        const value = decodeURIComponent(rest.join("=")).trim();
        if (value) return value;
      }
    }
  }

  return null;
}

function normalizeSupabaseBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

interface TopicRow {
  id: string;
  name: string;
  module: string;
  mastery: number;
  status: "weak" | "medium" | "strong";
  questions_answered?: number;
  last_practiced?: string;
  learning_objectives?: string[];
  key_concepts?: string[];
  error_pattern?: string;
}

export async function POST(request: Request) {
  const supabaseUrl = normalizeSupabaseBaseUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  );
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { success: false, error: "Supabase configuration missing on server." },
      { status: 503 }
    );
  }

  const accessToken = extractAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: "Invalid or expired session." },
      { status: 401 }
    );
  }

  let body: { replaceAll?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Empty body is acceptable
  }
  const replaceAll = Boolean(body?.replaceAll);

  // 1. Fetch user's actual topics with question count and last practiced metadata
  const { data: topics, error: topicsErr } = await supabase
    .from("topics")
    .select(
      "id, name, module, mastery, status, questions_answered, last_practiced, learning_objectives, key_concepts, error_pattern"
    )
    .eq("user_id", user.id);

  if (topicsErr || !topics || topics.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error:
          "No topics found. Please upload materials and extract topics first.",
      },
      { status: 422 }
    );
  }

  const typedTopics = topics as TopicRow[];

  // Pedagogical classification:
  // - An unassessed topic (questions_answered === 0 or last_practiced === "Never") is NOT weak!
  // - Assessed weak: questions_answered > 0 AND mastery < 50%
  // - Assessed medium: questions_answered > 0 AND 50% <= mastery < 80%
  // - Assessed strong: questions_answered > 0 AND mastery >= 80%
  const isAssessed = (t: TopicRow) =>
    Number(t.questions_answered ?? 0) > 0 &&
    t.last_practiced !== "Never" &&
    t.last_practiced !== "Not practiced yet";

  const assessedWeakTopics = typedTopics
    .filter((t) => isAssessed(t) && t.mastery < 50)
    .sort((a, b) => a.mastery - b.mastery);

  const assessedMediumTopics = typedTopics
    .filter((t) => isAssessed(t) && t.mastery >= 50 && t.mastery < 80)
    .sort((a, b) => a.mastery - b.mastery);

  const unassessedTopics = typedTopics.filter((t) => !isAssessed(t));

  const assessedStrongTopics = typedTopics
    .filter((t) => isAssessed(t) && t.mastery >= 80)
    .sort((a, b) => a.mastery - b.mastery);

  // Focus schedule priority:
  // 1. Assessed weak topics (highest urgency)
  // 2. Assessed medium topics (approaching threshold)
  // 3. Unassessed topics (baseline diagnostics)
  // 4. Assessed strong topics (spaced retention)
  const candidateTopics = [
    ...assessedWeakTopics,
    ...assessedMediumTopics,
    ...unassessedTopics,
    ...assessedStrongTopics,
  ];

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const timeSlots = ["09:00", "11:15", "14:00", "16:30", "18:00"];

  interface TaskToInsert {
    user_id: string;
    topic_id: string;
    topic_name: string;
    time_slot: string;
    title: string;
    type: "Concept Review" | "Practice Set" | "Error Log" | "Quick Recall";
    duration_minutes: number;
    priority: "High" | "Medium" | "Low";
    completed: boolean;
    scheduled_date: string;
    learning_objectives: string[];
  }

  const generatedTasks: TaskToInsert[] = [];

  // 2. Generate today's prioritized tasks
  let slotIdx = 0;
  for (const topic of candidateTopics.slice(0, 4)) {
    const topicAssessed = isAssessed(topic);
    const isWeak = topicAssessed && topic.mastery < 50;
    const isMedium = topicAssessed && topic.mastery >= 50 && topic.mastery < 80;
    const priority: "High" | "Medium" | "Low" = isWeak
      ? "High"
      : isMedium || !topicAssessed
      ? "Medium"
      : "Low";

    const objectives =
      Array.isArray(topic.learning_objectives) &&
      topic.learning_objectives.length > 0
        ? topic.learning_objectives
        : Array.isArray(topic.key_concepts) && topic.key_concepts.length > 0
        ? topic.key_concepts
        : ["Review core mechanisms and fundamental definitions"];

    if (!topicAssessed) {
      // Unassessed topic gets a diagnostic baseline check task
      generatedTasks.push({
        user_id: user.id,
        topic_id: topic.id,
        topic_name: topic.name,
        time_slot: timeSlots[slotIdx % timeSlots.length],
        title: `Diagnostic Check: ${topic.name}`,
        type: "Practice Set",
        duration_minutes: 15,
        priority: "Medium",
        completed: false,
        scheduled_date: todayStr,
        learning_objectives: [
          "Complete initial 5-question diagnostic to benchmark knowledge baseline",
        ],
      });
      slotIdx++;
    } else {
      // Concept Review or Error Log for assessed topic
      generatedTasks.push({
        user_id: user.id,
        topic_id: topic.id,
        topic_name: topic.name,
        time_slot: timeSlots[slotIdx % timeSlots.length],
        title: `Concept Review: ${topic.name}`,
        type: topic.error_pattern ? "Error Log" : "Concept Review",
        duration_minutes: isWeak ? 25 : 20,
        priority,
        completed: false,
        scheduled_date: todayStr,
        learning_objectives: objectives.slice(0, 3),
      });
      slotIdx++;

      // For weak topics, also schedule a practice diagnostic quiz
      if (isWeak && generatedTasks.length < 5) {
        generatedTasks.push({
          user_id: user.id,
          topic_id: topic.id,
          topic_name: topic.name,
          time_slot: timeSlots[slotIdx % timeSlots.length],
          title: `Practice Diagnostic: ${topic.name}`,
          type: "Practice Set",
          duration_minutes: 15,
          priority: "High",
          completed: false,
          scheduled_date: todayStr,
          learning_objectives: [
            "Validate retention and address error patterns with a 5-question MCQ drill",
          ],
        });
        slotIdx++;
      }
    }
  }

  // 3. Generate upcoming spaced repetition tasks (for tomorrow)
  if (candidateTopics.length > 1) {
    const nextTopic = candidateTopics[1] || candidateTopics[0];
    const nextAssessed = isAssessed(nextTopic);
    generatedTasks.push({
      user_id: user.id,
      topic_id: nextTopic.id,
      topic_name: nextTopic.name,
      time_slot: "10:00",
      title: `Spaced Recall Drill: ${nextTopic.name}`,
      type: "Quick Recall",
      duration_minutes: 20,
      priority:
        nextAssessed && nextTopic.mastery < 50
          ? "High"
          : "Medium",
      completed: false,
      scheduled_date: tomorrowStr,
      learning_objectives:
        Array.isArray(nextTopic.learning_objectives) &&
        nextTopic.learning_objectives.length > 0
          ? nextTopic.learning_objectives.slice(0, 2)
          : ["Spaced repetition review to reinforce long-term recall"],
    });
  }

  // 4. Preserve completed tasks unless replaceAll was explicitly requested
  if (replaceAll) {
    await supabase.from("revision_tasks").delete().eq("user_id", user.id);
  } else {
    // Only delete incomplete tasks to prevent duplicates, keeping completed tasks intact!
    await supabase
      .from("revision_tasks")
      .delete()
      .eq("user_id", user.id)
      .eq("completed", false);
  }

  const { data: insertedTasks, error: insertErr } = await supabase
    .from("revision_tasks")
    .insert(generatedTasks)
    .select();

  if (insertErr) {
    console.error("[/api/planner/generate] Failed to save revision tasks:", insertErr);
    return NextResponse.json(
      {
        success: false,
        error: insertErr.message || "Failed to save revision tasks to Supabase.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    tasksCount: insertedTasks?.length ?? generatedTasks.length,
    tasks: insertedTasks,
  });
}
