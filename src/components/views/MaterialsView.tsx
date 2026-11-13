"use client";

import { useId, useRef, useState } from "react";
import type { NavSectionId, StudyMaterial } from "@/types/dashboard";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

interface MaterialsViewProps {
  searchQuery: string;
  persistedMaterials?: StudyMaterial[];
  onMaterialUploaded?: () => void;
  onNavigate?: (section: NavSectionId) => void;
}

type UploadStage =
  | "idle"
  | "uploading"
  | "processing"
  | "success"
  | "error";

interface UploadApiResponse {
  success?: boolean;
  error?: string;
  material?: {
    id: string;
    title: string;
    file_name?: string;
    course: string;
    file_size?: number;
    page_count?: number;
    chunk_count?: number;
    status?: string;
    created_at?: string;
  };
  stats?: {
    pageCount: number;
    chunkCount: number;
    fileSizeBytes: number;
  };
}

function formatBytes(bytes?: number): string {
  if (typeof bytes !== "number" || isNaN(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function sanitizeBaseTitle(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "").trim();
}

export function MaterialsView({
  searchQuery,
  persistedMaterials = [],
  onMaterialUploaded,
  onNavigate,
}: MaterialsViewProps) {
  const [uploadedMaterials, setUploadedMaterials] = useState<StudyMaterial[]>(
    []
  );
  const [statusFilter, setStatusFilter] = useState<
    "all" | StudyMaterial["status"]
  >("all");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputId = useId();
  const courseInputId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [courseInput, setCourseInput] = useState("");
  const [hasManuallyEditedTitle, setHasManuallyEditedTitle] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Card view & delete states
  const [selectedMaterialForDetails, setSelectedMaterialForDetails] =
    useState<StudyMaterial | null>(null);
  const [materialToDelete, setMaterialToDelete] =
    useState<StudyMaterial | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const seenIds = new Set(uploadedMaterials.map((m) => m.id));
  const combinedMaterials = [
    ...uploadedMaterials,
    ...persistedMaterials.filter((m) => !seenIds.has(m.id)),
  ];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = combinedMaterials.filter((item) => {
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    const matchesQuery =
      !normalizedQuery ||
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.course.toLowerCase().includes(normalizedQuery) ||
      (item.fileName && item.fileName.toLowerCase().includes(normalizedQuery));
    return matchesStatus && matchesQuery;
  });

  const filters: Array<"all" | StudyMaterial["status"]> = [
    "all",
    "Indexed",
    "Reviewed",
    "Needs Review",
  ];

  // Duplicate detection
  const duplicateMaterial = selectedFile
    ? combinedMaterials.find(
        (m) =>
          (m.fileName &&
            m.fileName.toLowerCase() === selectedFile.name.toLowerCase()) ||
          m.title.toLowerCase() === sanitizeBaseTitle(selectedFile.name).toLowerCase() ||
          (titleInput.trim() &&
            m.title.toLowerCase() === titleInput.trim().toLowerCase())
      )
    : null;

  const handleFileSelection = (file: File | null) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setUploadStage("idle");
    setUploadProgress(0);

    if (!file) {
      setSelectedFile(null);
      if (!hasManuallyEditedTitle) {
        setTitleInput("");
      }
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setSelectedFile(null);
      setErrorMessage(
        "Only PDF documents (.pdf) are supported. Please select a valid PDF file."
      );
      setUploadStage("error");
      return;
    }

    if (file.size <= 0) {
      setSelectedFile(null);
      setErrorMessage(
        "The selected file is empty (0 bytes). Please upload a valid document."
      );
      setUploadStage("error");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setErrorMessage(
        `PDF file size (${formatBytes(file.size)}) exceeds the 10 MB maximum limit. Please select a smaller document or compress it before uploading.`
      );
      setUploadStage("error");
      return;
    }

    setSelectedFile(file);

    // Auto-populate document title from filename if title hasn't been manually edited or is empty
    if (!hasManuallyEditedTitle || !titleInput.trim()) {
      setTitleInput(sanitizeBaseTitle(file.name));
      setHasManuallyEditedTitle(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    handleFileSelection(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select a PDF file to upload.");
      setUploadStage("error");
      return;
    }

    setErrorMessage(null);
    setStatusMessage("Verifying student authentication session...");
    setUploadStage("uploading");
    setUploadProgress(0);

    let accessToken: string | null = null;
    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      accessToken = session?.access_token ?? null;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to initialize Supabase authentication.";
      setUploadStage("error");
      setErrorMessage(message);
      setStatusMessage(null);
      return;
    }

    if (!accessToken) {
      setUploadStage("error");
      setErrorMessage(
        "Authentication required. Please sign in to your student account before uploading materials."
      );
      setStatusMessage(null);
      return;
    }

    const finalTitle = titleInput.trim() || sanitizeBaseTitle(selectedFile.name);
    const finalCourse = courseInput.trim() || "General Study";

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", finalTitle);
    formData.append("course", finalCourse);

    try {
      const result = await new Promise<{
        status: number;
        body: UploadApiResponse;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/materials/upload");
        xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.min(100, Math.round((e.loaded / e.total) * 100));
            setUploadProgress(pct);
            if (pct >= 100) {
              setUploadStage("processing");
              setStatusMessage(
                "Extracting text, analyzing structure, and indexing study sections..."
              );
            } else {
              setStatusMessage(`Uploading document (${pct}%)...`);
            }
          }
        };

        xhr.onload = () => {
          let parsed: UploadApiResponse = {};
          try {
            parsed = JSON.parse(xhr.responseText) as UploadApiResponse;
          } catch {
            parsed = {
              success: false,
              error: "The server returned an unparseable response.",
            };
          }
          resolve({ status: xhr.status, body: parsed });
        };

        xhr.onerror = () => {
          reject(new Error("Network connection error while uploading the PDF."));
        };

        xhr.send(formData);
      });

      if (
        result.status < 200 ||
        result.status >= 300 ||
        !result.body.success ||
        !result.body.material
      ) {
        setUploadStage("error");
        setErrorMessage(
          result.body.error ||
            `Upload failed with status code ${result.status}.`
        );
        setStatusMessage(null);
        return;
      }

      const saved = result.body.material;
      const stats = result.body.stats;
      const pageCount = stats?.pageCount ?? saved.page_count ?? 1;
      const chunkCount = stats?.chunkCount ?? saved.chunk_count ?? 1;

      const newMaterial: StudyMaterial = {
        id: saved.id,
        title: saved.title,
        fileName: saved.file_name || selectedFile.name,
        course: saved.course || finalCourse,
        fileSize: stats?.fileSizeBytes || selectedFile.size,
        pageCount,
        chunkCount,
        type: "PDF Notes",
        uploadedAt: "Just now",
        topicsCovered: pageCount,
        status: "Indexed",
      };

      setUploadedMaterials((prev) => [newMaterial, ...prev]);
      onMaterialUploaded?.();
      setUploadStage("success");
      setUploadProgress(100);
      setStatusMessage(
        `Successfully indexed "${saved.title}" (${pageCount} page${
          pageCount === 1 ? "" : "s"
        }, ${chunkCount} study section${
          chunkCount === 1 ? "" : "s"
        }). Ready for topic mapping!`
      );
      setSelectedFile(null);
      setTitleInput("");
      setCourseInput("");
      setHasManuallyEditedTitle(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setUploadStage("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during document processing."
      );
      setStatusMessage(null);
    }
  };

  const handleDeleteMaterial = async (material: StudyMaterial) => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        throw new Error("You must be logged in to delete study materials.");
      }

      // 1. Delete associated material chunks
      await supabase
        .from("material_chunks")
        .delete()
        .eq("material_id", material.id)
        .eq("user_id", session.user.id);

      // 2. Delete parent material row
      const { error } = await supabase
        .from("materials")
        .delete()
        .eq("id", material.id)
        .eq("user_id", session.user.id);

      if (error) {
        throw new Error(error.message);
      }

      // Remove from uploadedMaterials state
      setUploadedMaterials((prev) => prev.filter((m) => m.id !== material.id));
      setMaterialToDelete(null);
      if (selectedMaterialForDetails?.id === material.id) {
        setSelectedMaterialForDetails(null);
      }
      onMaterialUploaded?.();
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete study material. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const isBusy = uploadStage === "uploading" || uploadStage === "processing";

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            My Study Materials
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Upload course lecture slides, textbooks, and problem sets to extract
            verified knowledge sections and map syllabus topics.
          </p>
        </div>

        <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                statusFilter === f
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* PDF Upload Section */}
      <section className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Upload PDF Study Material
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              PDF format only · Up to 10 MB · Automatically indexed into
              page-cited study sections
            </p>
          </div>
          {selectedFile ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Document selected
            </span>
          ) : null}
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-7 text-center transition-colors ${
            dragActive
              ? "border-indigo-500 bg-indigo-50/50"
              : "border-slate-300 bg-slate-50/60 hover:border-slate-400"
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-2">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <p className="text-xs font-semibold text-slate-800">
            Drag and drop your PDF here, or browse files
          </p>
          <p className="mt-1 max-w-md text-[11px] text-slate-500">
            We read your document page-by-page and organize it into verified
            study sections for diagnostic quizzes and topic mastery mapping.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            disabled={isBusy}
            onChange={(e) => handleFileSelection(e.target.files?.[0] ?? null)}
            className="hidden"
            id="pdf-upload-input"
          />
          <label
            htmlFor="pdf-upload-input"
            className={`mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 ${
              isBusy ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <span>Choose PDF file</span>
          </label>
        </div>

        {/* Selected File Inspection & Validation Box */}
        {selectedFile ? (
          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 font-semibold text-xs">
                  PDF
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 break-all">
                    {selectedFile.name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">
                      {formatBytes(selectedFile.size)}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                      <svg
                        className="h-3 w-3 text-emerald-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Valid PDF document (ready to process)
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleFileSelection(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
              >
                Change file
              </button>
            </div>

            {/* Duplicate File Warning */}
            {duplicateMaterial ? (
              <div
                role="status"
                className="mt-3 flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900"
              >
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <span className="font-semibold">Notice:</span> A study
                  material with this title or filename is already in your
                  library (
                  <span className="italic">{duplicateMaterial.title}</span>).
                  Uploading again will create an additional copy.
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Document Metadata Form */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor={titleInputId}
              className="block text-xs font-medium text-slate-700"
            >
              Document Title
            </label>
            <input
              id={titleInputId}
              type="text"
              value={titleInput}
              disabled={isBusy}
              onChange={(e) => {
                setTitleInput(e.target.value);
                setHasManuallyEditedTitle(true);
              }}
              placeholder="e.g. Week 8: Dynamic Programming & Graphs"
              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Auto-populated from filename · Editable
            </p>
          </div>

          <div>
            <label
              htmlFor={courseInputId}
              className="block text-xs font-medium text-slate-700"
            >
              Course / Module (optional)
            </label>
            <input
              id={courseInputId}
              type="text"
              value={courseInput}
              disabled={isBusy}
              onChange={(e) => setCourseInput(e.target.value)}
              placeholder="Optional (e.g. CS204 · Algorithms II)"
              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Defaults to &quot;General Study&quot; if left empty
            </p>
          </div>
        </div>

        {/* Secondary Technical Processing Details (Collapsible) */}
        <details className="mt-4 rounded-md border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-600 transition-colors">
          <summary className="cursor-pointer font-medium text-slate-700 hover:text-indigo-600 select-none">
            Secondary technical processing information
          </summary>
          <div className="mt-2.5 space-y-1.5 pl-3 border-l-2 border-indigo-200 text-[11px] text-slate-500">
            <p>
              • <strong>Text Extraction:</strong> Extracted page-by-page using
              the Mozilla PDF.js engine with page boundaries preserved.
            </p>
            <p>
              • <strong>Study Sections:</strong> Segmented into ~800-character
              knowledge units with a 100-character context overlap.
            </p>
            <p>
              • <strong>Privacy & Security:</strong> Strictly isolated to your
              student account through Supabase Row-Level Security (RLS).
            </p>
            <p>
              • <strong>Diagnostics:</strong> Page numbers are retained for
              direct citations during quiz generation and gap analysis.
            </p>
          </div>
        </details>

        {/* Meaningful Upload / Processing States */}
        {uploadStage === "uploading" || uploadStage === "processing" ? (
          <div className="mt-4 space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-indigo-900 flex items-center gap-2">
                <svg
                  className="animate-spin h-3.5 w-3.5 text-indigo-600"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                {statusMessage || "Processing document..."}
              </span>
              <span className="font-semibold text-indigo-700 tabular-nums">
                {uploadProgress}%
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>

            <div className="flex justify-between text-[10.5px] text-slate-500 pt-0.5">
              <span
                className={
                  uploadProgress > 0 ? "font-medium text-indigo-700" : ""
                }
              >
                1. Upload PDF
              </span>
              <span
                className={
                  uploadStage === "processing"
                    ? "font-medium text-indigo-700"
                    : ""
                }
              >
                2. Extract text & pages
              </span>
              <span
                className={
                  uploadProgress >= 100 && uploadStage === "processing"
                    ? "font-medium text-indigo-700"
                    : ""
                }
              >
                3. Index study sections
              </span>
            </div>
          </div>
        ) : null}

        {/* Success Alert */}
        {uploadStage === "success" && statusMessage ? (
          <div
            role="status"
            className="mt-4 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-emerald-600 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>{statusMessage}</span>
            </div>
            {onNavigate ? (
              <button
                type="button"
                onClick={() => onNavigate("topic-map")}
                className="ml-3 font-semibold text-emerald-700 underline hover:text-emerald-900"
              >
                Go to Topic Map →
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Error Alert */}
        {uploadStage === "error" && errorMessage ? (
          <div
            role="alert"
            className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
          >
            <div className="flex items-start gap-2">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="font-semibold">Upload failed</p>
                <p className="mt-0.5 text-rose-700">{errorMessage}</p>
                {errorMessage.toLowerCase().includes("scanned") ? (
                  <p className="mt-1 text-[11px] text-rose-600">
                    💡 Tip: Please ensure your PDF contains machine-readable text
                    rather than flattened photo scans.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="mt-4 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3.5">
          {selectedFile && !isBusy ? (
            <button
              type="button"
              onClick={() => handleFileSelection(null)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            disabled={!selectedFile || isBusy}
            onClick={handleUpload}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-2xs"
          >
            {isBusy ? (
              <>
                <svg
                  className="animate-spin h-3.5 w-3.5 text-white"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>Processing PDF...</span>
              </>
            ) : (
              <span>Upload & Index PDF</span>
            )}
          </button>
        </div>
      </section>

      {/* Materials List / Cards Section */}
      {combinedMaterials.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-2xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-800">
            No study materials uploaded yet
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Upload your lecture notes, course syllabus, or problem sets above to
            extract verified topics and identify knowledge gaps.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-2xs">
          <p className="text-sm font-medium text-slate-800">
            No study materials match your filter
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Try clearing the search query or switching your status filter.
          </p>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Show all materials
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((mat) => {
            const badgeClass =
              mat.status === "Needs Review"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : mat.status === "Reviewed"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-indigo-200 bg-indigo-50 text-indigo-700";

            const displayPageCount = mat.pageCount ?? mat.topicsCovered ?? 1;
            const displaySectionsCount = mat.chunkCount ?? "—";
            const displayFileName = mat.fileName || `${mat.title}.pdf`;

            return (
              <div
                key={mat.id}
                className="flex flex-col justify-between rounded-lg border border-slate-200/90 bg-white p-5 shadow-2xs transition-colors hover:border-slate-300"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-medium text-slate-600">
                      {mat.course || "General Study"}
                    </span>
                    <span
                      className={`rounded border px-2 py-0.5 text-[10.5px] font-medium ${badgeClass}`}
                    >
                      {mat.status}
                    </span>
                  </div>

                  <h3 className="mt-2.5 text-sm font-semibold text-slate-900 line-clamp-1">
                    {mat.title}
                  </h3>

                  <p className="mt-0.5 text-xs text-slate-500 truncate" title={displayFileName}>
                    File: <span className="font-mono text-[11px] text-slate-600">{displayFileName}</span>
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <svg
                        className="h-3.5 w-3.5 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      {displayPageCount} page{displayPageCount === 1 ? "" : "s"}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <svg
                        className="h-3.5 w-3.5 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 10h16M4 14h16M4 18h16"
                        />
                      </svg>
                      {displaySectionsCount} study section{displaySectionsCount === 1 ? "" : "s"}
                    </span>
                    {mat.fileSize ? (
                      <>
                        <span>•</span>
                        <span>{formatBytes(mat.fileSize)}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span>Uploaded {mat.uploadedAt}</span>
                  </div>

                  {/* Actions: View Details, Map Topics, Delete */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedMaterialForDetails(mat)}
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        onClick={() => setMaterialToDelete(mat)}
                        className="rounded border border-rose-200 bg-rose-50/50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100/70"
                        title="Delete material"
                      >
                        Delete
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate?.("topic-map")}
                      className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                    >
                      <span>Map Topics</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details Modal / Drawer */}
      {selectedMaterialForDetails ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10.5px] font-medium text-indigo-700">
                  {selectedMaterialForDetails.course || "General Study"}
                </span>
                <h3 className="mt-2 text-base font-semibold text-slate-900">
                  {selectedMaterialForDetails.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMaterialForDetails(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-2.5 rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">File Name:</span>
                <span className="font-mono text-slate-800">
                  {selectedMaterialForDetails.fileName ||
                    `${selectedMaterialForDetails.title}.pdf`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Pages:</span>
                <span className="font-medium text-slate-800">
                  {selectedMaterialForDetails.pageCount ??
                    selectedMaterialForDetails.topicsCovered}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Study Sections Indexed:</span>
                <span className="font-medium text-slate-800">
                  {selectedMaterialForDetails.chunkCount ?? "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">File Size:</span>
                <span className="font-medium text-slate-800">
                  {formatBytes(selectedMaterialForDetails.fileSize)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-medium text-emerald-700">
                  {selectedMaterialForDetails.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Upload Date:</span>
                <span className="font-medium text-slate-800">
                  {selectedMaterialForDetails.uploadedAt}
                </span>
              </div>
            </div>

            {/* Technical Processing Details inside modal */}
            <div className="mt-4 rounded-md border border-slate-200/80 bg-white p-3 text-[11px] text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">
                Indexing Architecture
              </p>
              <p>
                • Stored with Supabase Row-Level Security bound to your user
                identifier.
              </p>
              <p>
                • Study sections preserve raw page numbers used to cite proof in
                diagnostic quiz answers.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedMaterialForDetails(null)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              {onNavigate ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMaterialForDetails(null);
                    onNavigate("topic-map");
                  }}
                  className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Map Topics from Material
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete Confirmation Modal */}
      {materialToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Delete Study Material
              </h3>
            </div>

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete{" "}
              <strong className="text-slate-900">{materialToDelete.title}</strong>?
              This will remove the document and its indexed study sections from
              your Supabase database.
            </p>

            {deleteError ? (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                {deleteError}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setMaterialToDelete(null);
                  setDeleteError(null);
                }}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteMaterial(materialToDelete)}
                className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
