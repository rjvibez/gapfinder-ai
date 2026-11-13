import { groq } from "@ai-sdk/groq";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import {
  RawGeneratedQuestion,
  resolveQuestionCitation,
  selectContextChunks,
} from "@/lib/quizCitations";

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

  if (!topic.material_id) {
    return NextResponse.json(
      { success: false, error: "Topic is not linked to any study material." },
      { status: 422 }
    );
  }

  // 2. Fetch associated material chunks strictly isolated by user_id and material_id
  const { data: chunks, error: chunksErr } = await supabase
    .from("material_chunks")
    .select("chunk_index, page_number, content")
    .eq("user_id", user.id)
    .eq("material_id", topic.material_id)
    .order("chunk_index", { ascending: true });

  if (chunksErr || !chunks || chunks.length === 0) {
    return NextResponse.json(
      { success: false, error: "No document text chunks available for this topic." },
      { status: 422 }
    );
  }

  // 3. Prepare document context using bounded selection
  const chunksToUse = selectContextChunks(chunks, topic);
  const documentContext = chunksToUse
    .map((c) => `[PAGE ${c.page_number} | CHUNK ${c.chunk_index}]:\n${c.content}`)
    .join("\n\n---\n\n");

  const prompt = `You are an expert diagnostic educational assessment creator.
Generate a high-quality 5-question multiple choice diagnostic quiz for the topic: "${topic.name}" in "${topic.module}".

TOPIC DETAILS:
- Key Concepts: ${JSON.stringify(topic.key_concepts || [])}
- Definitions: ${JSON.stringify(topic.definitions || [])}
- Subtopics: ${JSON.stringify(topic.subtopics || [])}

DOCUMENT TEXT CHUNKS (ONLY use content and facts from this document):
${documentContext}

EVIDENCE-FIRST GENERATION PROCEDURE:
For every question you create, follow this exact sequence:
1. Select a specific factual statement or passage in the provided [PAGE X | CHUNK Y] chunks that directly proves a fact.
2. Formulate the question ("prompt") and 4 options based strictly on that identified statement.
3. Mark "correctIndex" (0, 1, 2, or 3) for the single correct answer verified by that document chunk.
4. Set "sourcePages" as an array of numbers citing the genuine page from the [PAGE X] chunk containing that statement (e.g. [2]). Do not default to page 1.
5. In "supportingText", provide the exact quote or key sentence from that chunk that directly proves the correct answer is true.
6. Provide a thorough "explanation" of why that answer is correct based on the document.

CRITICAL GROUNDING RULES:
- The "supportingText" MUST directly contain the factual proof for why the correct option is true.
- NEVER pair a question about one concept (e.g. xylem water transport) with a quotation from an unrelated section or experiment (e.g. pondweed oxygen bubbles).
- For questions on equations, formulas, or chemical reactions, cite the specific chunk containing that equation or formula, not a general concept definition.
- Strictly avoid general knowledge outside the provided document.

REQUIREMENTS:
1. Generate EXACTLY 5 multiple-choice questions (MCQs).
2. Each question MUST test a distinct concept or problem related to "${topic.name}".
3. Provide EXACTLY 4 distinct plausible options (indices 0, 1, 2, 3) per question.
4. Mark the correct answer with "correctIndex" (0, 1, 2, or 3).
5. Include a thorough "explanation" of why that answer is correct.

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this schema with NO markdown code fences and NO conversational text:
{
  "questions": [
    {
      "prompt": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Clear explanation of the correct choice...",
      "sourcePages": [2],
      "supportingText": "Direct supporting quote from page 2"
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

    const parsed = JSON.parse(cleaned) as { questions?: RawGeneratedQuestion[] };
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error("AI returned empty questions array.");
    }

    const formattedQuestions = parsed.questions.slice(0, 5).map((q, idx) => {
      const citation = resolveQuestionCitation(q, chunksToUse);
      return {
        id: `q-${topic.id}-${idx + 1}-${Date.now()}`,
        topic: topic.name,
        prompt: String(q.prompt || `Question ${idx + 1}`),
        options:
          Array.isArray(q.options) && q.options.length === 4
            ? q.options.map(String)
            : ["Option A", "Option B", "Option C", "Option D"],
        correctIndex:
          typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < 4
            ? q.correctIndex
            : 0,
        explanation: String(q.explanation || "See study material for details."),
        sourcePages: citation.sourcePages,
        supportingText: citation.supportingText,
      };
    });

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
