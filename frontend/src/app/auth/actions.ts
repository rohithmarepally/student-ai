"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function readFormValue(
  formData: FormData,
  key: string
): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function redirectWithMessage(
  pathname: string,
  key: "error" | "message",
  message: string
): never {
  const query = new URLSearchParams({
    [key]: message,
  });

  redirect(`${pathname}?${query.toString()}`);
}

export async function signUp(formData: FormData) {
  const fullName = readFormValue(formData, "fullName");
  const email = readFormValue(formData, "email").toLowerCase();
  const password = readFormValue(formData, "password");
  const confirmPassword = readFormValue(
    formData,
    "confirmPassword"
  );

  if (!fullName || !email || !password || !confirmPassword) {
    redirectWithMessage(
      "/sign-up",
      "error",
      "Complete every field."
    );
  }

  if (password.length < 8) {
    redirectWithMessage(
      "/sign-up",
      "error",
      "Password must contain at least 8 characters."
    );
  }

  if (password !== confirmPassword) {
    redirectWithMessage(
      "/sign-up",
      "error",
      "Passwords do not match."
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!siteUrl) {
    redirectWithMessage(
      "/sign-up",
      "error",
      "The application site URL is not configured."
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    redirectWithMessage(
      "/sign-up",
      "error",
      error.message
    );
  }

  redirectWithMessage(
    "/login",
    "message",
    "Account created. Check your email and confirm your address before logging in."
  );
}

export async function login(formData: FormData) {
  const email = readFormValue(formData, "email").toLowerCase();
  const password = readFormValue(formData, "password");

  if (!email || !password) {
    redirectWithMessage(
      "/login",
      "error",
      "Enter your email and password."
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectWithMessage(
      "/login",
      "error",
      error.message
    );
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath("/", "layout");

  redirectWithMessage(
    "/login",
    "message",
    "You have been logged out."
  );
}
