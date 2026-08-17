"use client";

import {
  type FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const BUCKET_NAME = "study-documents";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

type UploadMessage = {
  type: "idle" | "success" | "error";
  text: string;
};

const initialMessage: UploadMessage = {
  type: "idle",
  text: "",
};

export function DocumentUploadForm() {
  const router = useRouter();

  const [isUploading, setIsUploading] =
    useState(false);

  const [message, setMessage] =
    useState<UploadMessage>(initialMessage);

  async function handleUpload(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const selectedFile = formData.get("document");

    setMessage(initialMessage);

    if (!(selectedFile instanceof File)) {
      setMessage({
        type: "error",
        text: "Select a PDF file.",
      });

      return;
    }

    if (selectedFile.size === 0) {
      setMessage({
        type: "error",
        text: "The selected file is empty.",
      });

      return;
    }

    if (
      selectedFile.type !== "application/pdf" ||
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setMessage({
        type: "error",
        text: "Only PDF files are accepted.",
      });

      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setMessage({
        type: "error",
        text: "The PDF must be smaller than 10 MB.",
      });

      return;
    }

    if (selectedFile.name.length > 255) {
      setMessage({
        type: "error",
        text: "The file name is too long.",
      });

      return;
    }

    setIsUploading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Your session has expired. Log in again."
        );
      }

      const storagePath =
        `${user.id}/${crypto.randomUUID()}.pdf`;

      const { error: uploadError } =
        await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, selectedFile, {
            cacheControl: "3600",
            contentType: "application/pdf",
            upsert: false,
          });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { error: databaseError } =
        await supabase
          .from("documents")
          .insert({
            user_id: user.id,
            original_name: selectedFile.name,
            storage_path: storagePath,
            mime_type: "application/pdf",
            size_bytes: selectedFile.size,
            status: "uploaded",
          });

      if (databaseError) {
        /*
         * The file uploaded successfully, but inserting its
         * metadata failed. Remove the file so that it does not
         * become an unused storage object.
         */
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([storagePath]);

        throw new Error(databaseError.message);
      }

      form.reset();

      setMessage({
        type: "success",
        text: "PDF uploaded successfully.",
      });

      router.refresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "The upload failed.";

      setMessage({
        type: "error",
        text: errorMessage,
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Upload a study document
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Select a PDF containing notes, lecture material
          or textbook content.
        </p>
      </div>

      <form
        onSubmit={handleUpload}
        className="mt-6 space-y-5"
      >
        <div>
          <label
            htmlFor="document"
            className="text-sm font-medium text-slate-200"
          >
            PDF document
          </label>

          <input
            id="document"
            name="document"
            type="file"
            required
            accept="application/pdf,.pdf"
            disabled={isUploading}
            className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-500/15 file:px-4 file:py-2 file:font-semibold file:text-blue-300"
          />

          <p className="mt-2 text-xs text-slate-500">
            Maximum size: 10 MB. PDF files only.
          </p>
        </div>

        <button
          type="submit"
          disabled={isUploading}
          className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {isUploading
            ? "Uploading..."
            : "Upload PDF"}
        </button>
      </form>

      {message.type !== "idle" ? (
        <div
          aria-live="polite"
          className={[
            "mt-5 rounded-xl border p-4 text-sm",
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300",
          ].join(" ")}
        >
          {message.text}
        </div>
      ) : null}
    </section>
  );
}
