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

  let body: { taskId?: string; completed?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const { taskId, completed } = body;
  if (!taskId || typeof completed !== "boolean") {
    return NextResponse.json(
      { success: false, error: "taskId and completed boolean are required." },
      { status: 400 }
    );
  }

  const { data: updatedTask, error: updateErr } = await supabase
    .from("revision_tasks")
    .update({ completed })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (updateErr) {
    console.error("[/api/planner/toggle] Failed:", updateErr);
    return NextResponse.json(
      { success: false, error: updateErr.message || "Failed to update task." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    task: updatedTask,
  });
}
