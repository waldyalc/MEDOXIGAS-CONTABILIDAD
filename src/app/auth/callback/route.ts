import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const errorGoogle = searchParams.has("error") || searchParams.has("error_description");

  if (!code || errorGoogle) {
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }

  return NextResponse.redirect(new URL("/dashboard", origin));
}
