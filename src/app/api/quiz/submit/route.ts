import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { identifyConceptualGaps } from "@/lib/gapAnalysis";

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

interface SubmittedAnswer {
  questionId: string;
  topic: string;
  prompt: string;
  selectedOption: number;
  selectedAnswerText?: string;
  correctOption: number;
  correctAnswerText?: string;
  isCorrect: boolean;
  explanation?: string;
  sourcePages?: number[];
  supportingText?: string;
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

  let body: {
    topicId?: string;
    topicName?: string;
    answers?: SubmittedAnswer[];
    durationMinutes?: number;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const { topicId, topicName, answers, durationMinutes } = body;
  if (!topicId || !Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json(
      { success: false, error: "topicId and non-empty answers array are required." },
      { status: 400 }
    );
  }

  const totalQuestions = answers.length;
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const scorePercentage = Math.round((correctCount / totalQuestions) * 100);

  // 1. Fetch previous attempts to calculate improvement
  const { data: previousAttempts } = await supabase
    .from("quiz_attempts")
    .select("score")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const previousScore = previousAttempts?.[0]?.score ?? null;
  const improvement = previousScore !== null ? scorePercentage - previousScore : 0;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const shortDateFormatted = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  // 2. Save quiz attempt in quiz_attempts table
  // Build a primary payload with all fields, plus a fallback payload if 'date' or 'short_date' are missing from schema
  const attemptRow = {
    user_id: user.id,
    topic_id: topicId,
    title: `Diagnostic: ${topicName || "Topic Assessment"}`,
    date: dateFormatted,
    short_date: shortDateFormatted,
    score: scorePercentage,
    improvement,
    questions_count: totalQuestions,
    duration_minutes: typeof durationMinutes === "number" && durationMinutes > 0 ? durationMinutes : 5,
    focus_area: topicName || "General",
  };

  let insertedAttempt: unknown = null;
  const { data: firstTry, error: attemptErr } = await supabase
    .from("quiz_attempts")
    .insert(attemptRow)
    .select()
    .single();

  if (attemptErr) {
    // If the schema cache is missing 'date' or 'short_date', attempt fallback without them using created_at
    if (attemptErr.message?.includes("date") || attemptErr.message?.includes("column")) {
      console.warn("[/api/quiz/submit] Attempting fallback insert without date/short_date columns:", attemptErr.message);
      const fallbackRow = {
        user_id: user.id,
        topic_id: topicId,
        title: `Diagnostic: ${topicName || "Topic Assessment"}`,
        score: scorePercentage,
        improvement,
        questions_count: totalQuestions,
        duration_minutes: typeof durationMinutes === "number" && durationMinutes > 0 ? durationMinutes : 5,
        focus_area: topicName || "General",
      };

      const { data: secondTry, error: fallbackErr } = await supabase
        .from("quiz_attempts")
        .insert(fallbackRow)
        .select()
        .single();

      if (fallbackErr) {
        console.error("[/api/quiz/submit] Fallback insert also failed:", fallbackErr);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to record quiz attempt in database: ${fallbackErr.message}`,
          },
          { status: 500 }
        );
      }
      insertedAttempt = secondTry;
    } else {
      console.error("[/api/quiz/submit] Failed to save quiz attempt:", {
        code: attemptErr.code,
        message: attemptErr.message,
        details: attemptErr.details,
        hint: attemptErr.hint,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Failed to record quiz attempt in database: ${attemptErr.message}`,
        },
        { status: 500 }
      );
    }
  } else {
    insertedAttempt = firstTry;
  }

  // 3. Update topic mastery and questions_answered in topics table
  const { data: currentTopic } = await supabase
    .from("topics")
    .select(
      "mastery, questions_answered, name, key_concepts, subtopics, definitions, evidence_text, source_page_numbers"
    )
    .eq("id", topicId)
    .eq("user_id", user.id)
    .single();

  const prevQuestions = currentTopic?.questions_answered ?? 0;
  const prevMastery = currentTopic?.mastery ?? scorePercentage;
  // Weighted blend: 60% new score, 40% prev if exists
  const updatedMastery =
    prevQuestions > 0 ? Math.round(prevMastery * 0.4 + scorePercentage * 0.6) : scorePercentage;

  // Categorize based on strict requirements:
  // Weak: below 50%
  // Medium: 50–79%
  // Strong: 80–100%
  const finalStatus: "weak" | "medium" | "strong" =
    updatedMastery >= 80 ? "strong" : updatedMastery >= 50 ? "medium" : "weak";

  // Identify recurring error patterns if there are incorrect questions
  const missedAnswers = answers.filter((a) => !a.isCorrect);
  let detectedErrorPattern: string | null = null;
  if (missedAnswers.length > 0) {
    const conceptualGaps = identifyConceptualGaps(
      missedAnswers.map((m) => ({
        questionId: m.questionId,
        prompt: m.prompt,
        selectedOption: m.selectedOption,
        selectedAnswerText: m.selectedAnswerText,
        correctOption: m.correctOption,
        correctAnswerText: m.correctAnswerText,
        isCorrect: m.isCorrect,
        explanation: m.explanation,
        sourcePages: m.sourcePages,
        supportingText: m.supportingText,
      })),
      {
        name: currentTopic?.name || topicName || "Assessment Topic",
        keyConcepts: currentTopic?.key_concepts,
        subtopics: currentTopic?.subtopics,
        definitions: currentTopic?.definitions,
        evidenceText: currentTopic?.evidence_text,
        sourcePageNumbers: currentTopic?.source_page_numbers,
      }
    );

    const summary =
      conceptualGaps.length === 1
        ? `Identified 1 knowledge gap (${conceptualGaps[0].concept}) across ${missedAnswers.length} missed question${missedAnswers.length > 1 ? "s" : ""}.`
        : `Identified ${conceptualGaps.length} knowledge gaps across ${missedAnswers.length} missed questions.`;

    detectedErrorPattern = JSON.stringify({
      version: 2,
      summary,
      gaps: conceptualGaps,
    });
  }

  await supabase
    .from("topics")
    .update({
      mastery: updatedMastery,
      status: finalStatus,
      questions_answered: prevQuestions + totalQuestions,
      last_practiced: "Just now",
      error_pattern: detectedErrorPattern,
    })
    .eq("id", topicId)
    .eq("user_id", user.id);

  // 4. Update or insert recommendation if mastery < 80
  if (updatedMastery < 80) {
    const reason =
      scorePercentage < 60
        ? `Low diagnostic score (${scorePercentage}%); missed ${totalQuestions - correctCount} out of ${totalQuestions} questions.`
        : `Score is ${scorePercentage}%; review key definitions to reach 80% mastery threshold.`;

    await supabase.from("priority_recommendations").upsert({
      user_id: user.id,
      topic_id: topicId,
      topic_name: topicName || "Diagnostic Topic",
      module: "Syllabus",
      mastery: updatedMastery,
      status: finalStatus,
      reason,
      impact_label: scorePercentage < 60 ? "High Impact" : "Quick Win",
      estimated_minutes: 20,
    });
  } else {
    // If mastered, clean up previous priority recommendation for this topic
    await supabase
      .from("priority_recommendations")
      .delete()
      .eq("topic_id", topicId)
      .eq("user_id", user.id);
  }

  return NextResponse.json({
    success: true,
    score: scorePercentage,
    correctCount,
    totalQuestions,
    improvement,
    updatedMastery,
    status: finalStatus,
    attempt: insertedAttempt,
  });
}
