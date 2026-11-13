import { groq } from "@ai-sdk/groq";
import { APICallError, generateText } from "ai";
import { NextResponse } from "next/server";

const MODEL_ID = "openai/gpt-oss-120b";
const MAX_PROMPT_LENGTH = 2000;

export async function GET() {
  const configured = Boolean(process.env.GROQ_API_KEY?.trim());

  return NextResponse.json(
    {
      ok: true,
      configured,
      model: MODEL_ID,
    },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY?.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "Server AI configuration is missing.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON request body.",
      },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || !("prompt" in body)) {
    return NextResponse.json(
      {
        success: false,
        error: "Request body must include a 'prompt' field.",
      },
      { status: 400 }
    );
  }

  const rawPrompt = (body as { prompt: unknown }).prompt;

  if (typeof rawPrompt !== "string") {
    return NextResponse.json(
      {
        success: false,
        error: "The 'prompt' field must be a string.",
      },
      { status: 400 }
    );
  }

  const trimmedPrompt = rawPrompt.trim();

  if (trimmedPrompt.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "The 'prompt' field must be a non-empty string.",
      },
      { status: 400 }
    );
  }

  if (rawPrompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      {
        success: false,
        error: `Prompt exceeds the maximum length of ${MAX_PROMPT_LENGTH} characters.`,
      },
      { status: 400 }
    );
  }

  try {
    const { text } = await generateText({
      model: groq(MODEL_ID),
      prompt: trimmedPrompt,
    });

    return NextResponse.json(
      {
        success: true,
        text,
        model: MODEL_ID,
      },
      { status: 200 }
    );
  } catch (error) {
    if (APICallError.isInstance(error)) {
      console.error("[/api/ai-test] Groq provider error:", {
        name: error.name,
        statusCode: error.statusCode,
        message: error.message,
      });

      if (error.statusCode === 429) {
        return NextResponse.json(
          {
            success: false,
            error: "AI provider rate limit reached. Please try again shortly.",
          },
          { status: 429 }
        );
      }

      if (error.statusCode === 401 || error.statusCode === 403) {
        return NextResponse.json(
          {
            success: false,
            error: "AI provider authentication failed.",
          },
          { status: 502 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "AI provider request failed. Please try again.",
        },
        { status: 502 }
      );
    }

    console.error("[/api/ai-test] Unexpected error:", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unexpected error",
    });

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred while generating the response.",
      },
      { status: 500 }
    );
  }
}

