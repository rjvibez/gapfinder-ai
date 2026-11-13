import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  PdfProcessingError,
  processPdfFile,
  validatePdfFileMetadata,
} from "@/lib/pdf";

const CHUNK_BATCH_SIZE = 100;

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

function deriveTitleFromFileName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").trim() || "Untitled Material";
}

export async function POST(request: Request) {
  const supabaseUrl = normalizeSupabaseBaseUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  );
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        success: false,
        error: "Supabase is not configured on the server.",
      },
      { status: 503 }
    );
  }

  const accessToken = extractAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        error: "Authentication required. Please sign in to upload materials.",
      },
      { status: 401 }
    );
  }

  // Request-scoped client using the user's JWT so RLS policies are enforced.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid or expired session. Please sign in again.",
      },
      { status: 401 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Expected multipart/form-data request.",
      },
      { status: 400 }
    );
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: "Please attach a PDF file in the 'file' field.",
      },
      { status: 400 }
    );
  }

  const rawCourse = formData.get("course");
  const course =
    typeof rawCourse === "string" && rawCourse.trim().length > 0
      ? rawCourse.trim().slice(0, 120)
      : "General Study";

  const rawTitle = formData.get("title");
  const title =
    typeof rawTitle === "string" && rawTitle.trim().length > 0
      ? rawTitle.trim().slice(0, 160)
      : deriveTitleFromFileName(fileEntry.name);

  try {
    validatePdfFileMetadata({
      name: fileEntry.name,
      type: fileEntry.type,
      size: fileEntry.size,
    });

    const arrayBuffer = await fileEntry.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const processed = await processPdfFile(
      fileEntry.name,
      fileEntry.size,
      bytes
    );

    const { data: insertedMaterial, error: materialError } = await supabase
      .from("materials")
      .insert({
        user_id: user.id,
        title,
        file_name: fileEntry.name,
        course,
        file_size: fileEntry.size,
        page_count: processed.pageCount,
        chunk_count: processed.chunks.length,
        status: "Indexed",
      })
      .select("id, title, file_name, course, file_size, page_count, chunk_count, status, created_at")
      .single();

    if (materialError || !insertedMaterial) {
      console.error("[/api/materials/upload] Failed to insert material:", {
        code: materialError?.code,
        message: materialError?.message,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            materialError?.message ||
            "Failed to save material metadata to Supabase.",
        },
        { status: 500 }
      );
    }

    const chunkRows = processed.chunks.map((chunk) => ({
      material_id: insertedMaterial.id,
      user_id: user.id,
      document_name: chunk.documentName,
      page_number: chunk.pageNumber,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      metadata: chunk.metadata,
    }));

    for (let i = 0; i < chunkRows.length; i += CHUNK_BATCH_SIZE) {
      const batch = chunkRows.slice(i, i + CHUNK_BATCH_SIZE);
      const { error: chunkError } = await supabase
        .from("material_chunks")
        .insert(batch);

      if (chunkError) {
        console.error("[/api/materials/upload] Failed to insert chunks:", {
          code: chunkError.code,
          message: chunkError.message,
        });

        // Clean up the parent material record so partial data is not left behind.
        await supabase
          .from("materials")
          .delete()
          .eq("id", insertedMaterial.id)
          .eq("user_id", user.id);

        return NextResponse.json(
          {
            success: false,
            error:
              chunkError.message ||
              "Failed to save extracted PDF chunks to Supabase.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        material: insertedMaterial,
        stats: {
          pageCount: processed.pageCount,
          chunkCount: processed.chunks.length,
          fileSizeBytes: fileEntry.size,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PdfProcessingError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: error.statusCode }
      );
    }

    console.error("[/api/materials/upload] Unexpected upload error:", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unexpected error",
    });

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred while processing the PDF.",
      },
      { status: 500 }
    );
  }
}

