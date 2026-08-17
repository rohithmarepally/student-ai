"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const BUCKET_NAME = "study-documents";

function readDocumentId(
  formData: FormData
): string {
  const value = formData.get("documentId");

  return typeof value === "string"
    ? value.trim()
    : "";
}

function redirectWithMessage(
  key: "message" | "error",
  text: string
): never {
  const query = new URLSearchParams({
    [key]: text,
  });

  redirect(`/documents?${query.toString()}`);
}

export async function deleteDocument(
  formData: FormData
): Promise<void> {
  const documentId = readDocumentId(formData);

  if (!documentId) {
    redirectWithMessage(
      "error",
      "The document ID is missing."
    );
  }

  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const {
    data: document,
    error: documentError,
  } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (documentError || !document) {
    redirectWithMessage(
      "error",
      "The document could not be found."
    );
  }

  const { error: storageError } =
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([document.storage_path]);

  if (storageError) {
    redirectWithMessage(
      "error",
      `Could not delete the stored PDF: ${storageError.message}`
    );
  }

  const { error: databaseError } =
    await supabase
      .from("documents")
      .delete()
      .eq("id", document.id)
      .eq("user_id", userId);

  if (databaseError) {
    redirectWithMessage(
      "error",
      `The metadata could not be deleted: ${databaseError.message}`
    );
  }

  revalidatePath("/documents");
  revalidatePath("/dashboard");

  redirectWithMessage(
    "message",
    "Document deleted successfully."
  );
}
