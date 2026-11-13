"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { origenDesdeHeaders } from "@/lib/auth/origen";
import { createClient } from "@/lib/supabase/server";

export async function entrar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) redirect("/login?error=1");
  redirect("/dashboard");
}

export async function entrarConGoogle() {
  const origen = origenDesdeHeaders(await headers());
  if (!origen) redirect("/login?error=google");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origen}/auth/callback` },
  });

  if (error) redirect("/login?error=google");
  redirect(data.url);
}

export async function salir() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
