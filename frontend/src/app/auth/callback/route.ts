import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/dashboard";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  const nextPath = getSafeNextPath(
    request.nextUrl.searchParams.get("next")
  );

  if (code) {
    const supabase = await createClient();

    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const destination = request.nextUrl.clone();

      destination.pathname = nextPath;
      destination.search = "";

      return NextResponse.redirect(destination);
    }
  }

  const loginUrl = request.nextUrl.clone();

  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "error",
    "Email confirmation failed or the confirmation link expired."
  );

  return NextResponse.redirect(loginUrl);
}
