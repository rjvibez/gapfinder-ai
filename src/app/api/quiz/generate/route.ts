import { groq } from "@ai-sdk/groq";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { NextResponse } from "next/server";

const MODEL_ID = "openai/gpt-oss-120b";

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

interface GeneratedQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
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

  if (!process.env.GROQ_API_KEY?.trim()) {
    return NextResponse.json(
      { success: false, error: "Groq AI configuration is missing." },
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

  let body: { topicId?: unknown };
  try {
    body = (await request.json()) as { topicId?: unknown };
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const topicId = typeof body.topicId === "string" ? body.topicId.trim() : null;
  if (!topicId) {
    return NextResponse.json(
      { success: false, error: "topicId is required." },
      { status: 400 }
    );
  }

  // 1. Fetch topic owned by this user
  const { data: topic, error: topicErr } = await supabase
    .from("topics")
    .select("id, name, module, material_id, key_concepts, definitions, formulas, subtopics, source_page_numbers, evidence_text")
    .eq("id", topicId)
    .eq("user_id", user.id)
    .single();

  if (topicErr || !topic) {
    return NextResponse.json(
      { success: false, error: "Topic not found or access denied." },
      { status: 404 }
    );
  }

  // 2. Fetch associated material chunks
  let chunksQuery = supabase
    .from("material_chunks")
    .select("chunk_index, page_number, content")
    .eq("user_id", user.id);

  if (topic.material_id) {
    chunksQuery = chunksQuery.eq("material_id", topic.material_id);
  }

  const { data: chunks, error: chunksErr } = await chunksQuery.order("chunk_index", { ascending: true });

  if (chunksErr || !chunks || chunks.length === 0) {
    return NextResponse.json(
      { success: false, error: "No document text chunks available for this topic." },
      { status: 422 }
    );
  }

  // Prepare document context emphasizing topic's cited pages or key concepts
  const relevantChunks =
    Array.isArray(topic.source_page_numbers) && topic.source_page_numbers.length > 0
      ? chunks.filter((c) => topic.source_page_numbers.includes(c.page_number))
      : chunks;

  const chunksToUse = relevantChunks.length > 0 ? relevantChunks : chunks;
  const documentContext = chunksToUse
    .map((c) => `[PAGE ${c.page_number} | CHUNK ${c.chunk_index}]:\n${c.content}`)
    .join("\n\n---\n\n");

  const prompt = `You are an expert diagnostic educational assessment creator.
Generate a high-quality 5-question multiple choice diagnostic quiz for the topic: "${topic.name}" in "${topic.module}".

TOPIC DETAILS:
- Key Concepts: ${JSON.stringify(topic.key_concepts || [])}
- Definitions: ${JSON.stringify(topic.definitions || [])}
- Subtopics: ${JSON.stringify(topic.subtopics || [])}
- Source Pages: ${JSON.stringify(topic.source_page_numbers || [])}

DOCUMENT TEXT CHUNKS (ONLY use content and facts from this document):
${documentContext}

REQUIREMENTS:
1. Generate EXACTLY 5 multiple-choice questions (MCQs).
2. Each question MUST test a distinct concept or problem related to "${topic.name}".
3. Provide EXACTLY 4 distinct plausible options (indices 0, 1, 2, 3) per question.
4. Mark the correct answer with "correctIndex" (0, 1, 2, or 3).
5. Include a thorough "explanation" of why that answer is correct.
6. Include "sourcePages" (an array of numbers, e.g. [1]) indicating which page of the text supports the answer.
7. Include "supportingText" (a direct quote or phrase from the document).
8. Strictly avoid general knowledge outside the provided document.

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this schema with NO markdown code fences and NO conversational text:
{
  "questions": [
    {
      "prompt": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Clear explanation of the correct choice...",
      "sourcePages": [1],
      "supportingText": "Exact supporting quote from the text"
    }
  ]
}`;

  try {
    const { text } = await generateText({
      model: groq(MODEL_ID),
      prompt,
    });

    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as { questions?: GeneratedQuestion[] };
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error("AI returned empty questions array.");
    }

    const formattedQuestions = parsed.questions.slice(0, 5).map((q, idx) => ({
      id: `q-${topic.id}-${idx + 1}-${Date.now()}`,
      topic: topic.name,
      prompt: String(q.prompt || `Question ${idx + 1}`),
      options: Array.isArray(q.options) && q.options.length === 4
        ? q.options.map(String)
        : ["Option A", "Option B", "Option C", "Option D"],
      correctIndex: typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < 4
        ? q.correctIndex
        : 0,
      explanation: String(q.explanation || "See study material for details."),
      sourcePages: Array.isArray(q.sourcePages) ? q.sourcePages.map(Number) : (topic.source_page_numbers || []),
      supportingText: q.supportingText ? String(q.supportingText) : topic.evidence_text || undefined,
    }));

    return NextResponse.json({
      success: true,
      topicId: topic.id,
      topicName: topic.name,
      module: topic.module,
      questions: formattedQuestions,
    });
  } catch (error) {
    console.error("[/api/quiz/generate] Failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate diagnostic quiz from the material." },
      { status: 502 }
    );
  }
}

