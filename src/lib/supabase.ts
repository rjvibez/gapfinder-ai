import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!rawSupabaseUrl) {
  throw new Error(
    "Missing environment variable: NEXT_PUBLIC_SUPABASE_URL is required."
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY is required."
  );
}

let supabaseUrl: string;
try {
  const parsed = new URL(rawSupabaseUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid protocol");
  }
  supabaseUrl = parsed.origin;
} catch {
  throw new Error(
    "Invalid NEXT_PUBLIC_SUPABASE_URL: Must be a valid base HTTP or HTTPS URL (e.g. https://<project>.supabase.co)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
