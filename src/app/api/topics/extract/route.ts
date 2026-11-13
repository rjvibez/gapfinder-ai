import { groq } from "@ai-sdk/groq";
import { createClient } from "@supabase/supabase-js";
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const MODEL_ID = "openai/gpt-oss-120b";

const topicItemSchema = z.object({
  name: z.string().describe("Topic name"),
  module: z.string().describe("Curriculum module or course area"),
  importance: z.enum(["High", "Medium", "Low"]).describe("Importance level"),
  learningObjectives: z.array(z.string()).describe("Learning objectives explicitly covered"),
  keyConcepts: z.array(z.string()).describe("Key concepts and principles"),
  definitions: z.array(z.string()).describe("Important terms and definitions"),
  formulas: z.array(z.string()).describe("Formulas, equations, or laws if any"),
  subtopics: z.array(z.string()).describe("Subtopics covered under this main topic"),
  sourcePageNumbers: z.array(z.number()).describe("Source page numbers where this topic appears"),
  evidenceText: z.string().describe("Direct supporting sentence or context quote from document"),
  prerequisites: z.array(z.string()).describe("Prerequisites mentioned or required for this topic"),
});

const topicsOutputSchema = z.object({
  topics: z.array(topicItemSchema).describe("List of extracted topics strictly from the document"),
});

function safeParseJsonFromText(rawText: string): unknown {
  if (!rawText || typeof rawText !== "string") return null;

  // 1. Remove deepseek/reasoning thinking blocks if present: <think>...</think>
  let text = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Extract contents of markdown code block if present
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  }

  // 3. Try direct JSON.parse first
  try {
    return JSON.parse(text);
  } catch {
    // Continue to bounds extraction
  }

  // 4. Find the outermost JSON object bounds '{' ... '}'
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidateObj = text.slice(firstBrace, lastBrace + 1).trim();
    try {
      return JSON.parse(candidateObj);
    } catch {
      // Continue
    }
  }

  // 5. Find outermost array bounds '[' ... ']' in case AI returned just array
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const candidateArr = text.slice(firstBracket, lastBracket + 1).trim();
    try {
      return JSON.parse(candidateArr);
    } catch {
      // Continue
    }
  }

  return null;
}

function validateAndNormalizeTopics(
  rawList: unknown[],
  defaultModule: string
): ExtractedTopicPayload[] {
  if (!Array.isArray(rawList)) return [];

  const validated: ExtractedTopicPayload[] = [];

  for (const raw of rawList) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;

    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) continue;

    const moduleName =
      typeof item.module === "string" && item.module.trim()
        ? item.module.trim()
        : defaultModule || "General";

    const importanceStr = typeof item.importance === "string" ? item.importance.trim() : "";
    const importance: "High" | "Medium" | "Low" =
      importanceStr === "High" || importanceStr === "Low" ? importanceStr : "Medium";

    const toStringArray = (val: unknown): string[] => {
      if (!Array.isArray(val)) return [];
      return val.map((x) => String(x ?? "").trim()).filter((s) => s.length > 0);
    };

    const toNumberArray = (val: unknown): number[] => {
      if (!Array.isArray(val)) return [];
      return val
        .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
        .filter((n) => !isNaN(n) && Number.isFinite(n) && n > 0);
    };

    const evidenceText =
      typeof item.evidenceText === "string" && item.evidenceText.trim()
        ? item.evidenceText.trim()
        : undefined;

    validated.push({
      name,
      module: moduleName,
      importance,
      learningObjectives: toStringArray(item.learningObjectives),
      keyConcepts: toStringArray(item.keyConcepts),
      definitions: toStringArray(item.definitions),
      formulas: toStringArray(item.formulas),
      subtopics: toStringArray(item.subtopics),
      sourcePageNumbers: toNumberArray(item.sourcePageNumbers),
      evidenceText,
      prerequisites: toStringArray(item.prerequisites),
    });
  }

  return validated;
}

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

interface ExtractedTopicPayload {
  name: string;
  module: string;
  importance: "High" | "Medium" | "Low";
  learningObjectives?: string[];
  keyConcepts?: string[];
  definitions?: string[];
  formulas?: string[];
  subtopics?: string[];
  sourcePageNumbers?: number[];
  evidenceText?: string;
  prerequisites?: string[];
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

  let body: { materialId?: unknown };
  try {
    body = (await request.json()) as { materialId?: unknown };
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const materialId =
    typeof body.materialId === "string" ? body.materialId.trim() : null;

  if (!materialId) {
    return NextResponse.json(
      { success: false, error: "materialId is required." },
      { status: 400 }
    );
  }

  // 1. Verify material ownership
  const { data: material, error: matErr } = await supabase
    .from("materials")
    .select("id, title, course, user_id")
    .eq("id", materialId)
    .eq("user_id", user.id)
    .single();

  if (matErr || !material) {
    return NextResponse.json(
      { success: false, error: "Material not found or access denied." },
      { status: 404 }
    );
  }

  // 2. Fetch text chunks for this material
  const { data: chunks, error: chunksErr } = await supabase
    .from("material_chunks")
    .select("chunk_index, page_number, content")
    .eq("material_id", materialId)
    .eq("user_id", user.id)
    .order("chunk_index", { ascending: true });

  if (chunksErr || !chunks || chunks.length === 0) {
    return NextResponse.json(
      { success: false, error: "No text chunks found for this material." },
      { status: 422 }
    );
  }

  // Format chunks with page numbers for citation
  const documentContext = chunks
    .map(
      (c) =>
        `[PAGE ${c.page_number} | CHUNK ${c.chunk_index}]:\n${c.content}`
    )
    .join("\n\n---\n\n");

  const prompt = `You are a precise educational topic extraction and syllabus mapping system.
Analyze the following document text that was extracted page-by-page from an uploaded study material.

DOCUMENT METADATA:
Title: "${material.title}"
Course/Module: "${material.course}"

DOCUMENT CONTENT:
${documentContext}

INSTRUCTIONS:
1. Extract ALL genuine topics and subtopics present strictly in the text above. Do NOT invent topics or use external knowledge.
2. Group related topics under coherent curriculum modules (use "${material.course}" as the default module if none is stated).
3. Identify key concepts, definitions, formulas, and learning objectives explicitly mentioned.
4. Assign an importance level: "High", "Medium", or "Low" based solely on emphasis in the text (e.g. core definitions, exam objectives, recurring sections = High; secondary remarks = Low).
5. For every topic, cite the exact source page numbers where it appears, and a concise quote or supporting summary (evidenceText).
6. Note any prerequisites that are explicitly mentioned or logical dependencies within this material.

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this schema, with no markdown code fences, comments, or intro/outro text:
{
  "topics": [
    {
      "name": "Topic Name",
      "module": "Module or Course Area",
      "importance": "High",
      "learningObjectives": ["objective 1", "objective 2"],
      "keyConcepts": ["concept 1", "concept 2"],
      "definitions": ["definition 1"],
      "formulas": ["formula 1"],
      "subtopics": ["subtopic A", "subtopic B"],
      "sourcePageNumbers": [1, 2],
      "evidenceText": "Direct supporting sentence or context from the document",
      "prerequisites": ["prerequisite topic if mentioned"]
    }
  ]
}`;

  let extractedTopics: ExtractedTopicPayload[] = [];

  // Attempt 1: Structured JSON output using Output.object
  try {
    const result = await generateText({
      model: groq(MODEL_ID),
      output: Output.object({ schema: topicsOutputSchema }),
      prompt,
    });

    if (result.output?.topics && Array.isArray(result.output.topics) && result.output.topics.length > 0) {
      extractedTopics = validateAndNormalizeTopics(
        result.output.topics,
        material.course || "General"
      );
    } else {
      console.warn("[/api/topics/extract] Attempt 1 returned empty structured topics.");
    }
  } catch (attempt1Error: unknown) {
    const msg = attempt1Error instanceof Error ? attempt1Error.message : String(attempt1Error);
    console.warn("[/api/topics/extract] Attempt 1 (structured output) failed:", msg);
  }

  // Attempt 2: Corrective retry if Attempt 1 failed or returned 0 valid topics
  if (extractedTopics.length === 0) {
    console.log("[/api/topics/extract] Attempt 2: Retrying with corrective prompt and safe parser...");
    try {
      const correctivePrompt = `${prompt}

CRITICAL INSTRUCTION FOR RETRY:
Your previous response could not be parsed as valid JSON.
You MUST output ONLY a single, valid JSON object starting with "{" and ending with "}".
Do NOT wrap the output in markdown code fences or backticks.
Do NOT include preamble, thinking blocks, notes, or commentary.
Ensure all keys and string values are enclosed in valid double quotes.`;

      const { text } = await generateText({
        model: groq(MODEL_ID),
        prompt: correctivePrompt,
      });

      const parsedJson = safeParseJsonFromText(text);
      if (parsedJson && typeof parsedJson === "object") {
        const candidateList =
          "topics" in parsedJson && Array.isArray((parsedJson as { topics?: unknown }).topics)
            ? (parsedJson as { topics: unknown[] }).topics
            : Array.isArray(parsedJson)
            ? (parsedJson as unknown[])
            : [];

        extractedTopics = validateAndNormalizeTopics(
          candidateList,
          material.course || "General"
        );
      }

      if (extractedTopics.length === 0) {
        console.warn(
          "[/api/topics/extract] Attempt 2 produced 0 valid topics. Response preview:",
          text.slice(0, 200).replace(/\s+/g, " ")
        );
      }
    } catch (attempt2Error: unknown) {
      const msg = attempt2Error instanceof Error ? attempt2Error.message : String(attempt2Error);
      console.error("[/api/topics/extract] Attempt 2 (corrective retry) failed:", msg);
    }
  }

  if (extractedTopics.length === 0) {
    console.error("[/api/topics/extract] AI topic extraction failed after all attempts.");
    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to extract topics from this document. The AI model did not return a valid list of topics. Please try again or verify that the document contains sufficient educational text.",
      },
      { status: 502 }
    );
  }

  // 3. Prevent duplicate topic creation: remove any pre-existing topics for this material and user
  await supabase
    .from("topics")
    .delete()
    .eq("material_id", materialId)
    .eq("user_id", user.id);

  // 4. Save extracted topics to Supabase
  const topicRows = extractedTopics.map((t) => {
    const importance =
      t.importance === "High" || t.importance === "Medium" || t.importance === "Low"
        ? t.importance
        : "Medium";

    return {
      material_id: materialId,
      user_id: user.id,
      name: String(t.name || "Untitled Topic").trim().slice(0, 160),
      module: String(t.module || material.course || "General").trim().slice(0, 120),
      mastery: 0,
      status: "weak" as const,
      questions_answered: 0,
      last_practiced: "Not practiced yet",
      importance,
      learning_objectives: Array.isArray(t.learningObjectives)
        ? t.learningObjectives.map(String)
        : [],
      key_concepts: Array.isArray(t.keyConcepts)
        ? t.keyConcepts.map(String)
        : [],
      definitions: Array.isArray(t.definitions)
        ? t.definitions.map(String)
        : [],
      formulas: Array.isArray(t.formulas)
        ? t.formulas.map(String)
        : [],
      subtopics: Array.isArray(t.subtopics)
        ? t.subtopics.map(String)
        : [],
      source_page_numbers: Array.isArray(t.sourcePageNumbers)
        ? t.sourcePageNumbers.map(Number).filter((n) => !isNaN(n))
        : [],
      evidence_text: t.evidenceText ? String(t.evidenceText).slice(0, 1000) : null,
      prerequisites: Array.isArray(t.prerequisites)
        ? t.prerequisites.map(String)
        : [],
    };
  });

  const { data: insertedTopics, error: insertErr } = await supabase
    .from("topics")
    .insert(topicRows)
    .select();

  if (insertErr) {
    console.error("[/api/topics/extract] Failed to insert topics into Supabase:", insertErr);
    return NextResponse.json(
      {
        success: false,
        error: insertErr.message || "Failed to save extracted topics to Supabase.",
      },
      { status: 500 }
    );
  }

  // Update material status to Reviewed
  await supabase
    .from("materials")
    .update({ status: "Reviewed" })
    .eq("id", materialId)
    .eq("user_id", user.id);

  return NextResponse.json(
    {
      success: true,
      materialId,
      topicsCount: insertedTopics?.length ?? topicRows.length,
      topics: insertedTopics,
    },
    { status: 201 }
  );
}

