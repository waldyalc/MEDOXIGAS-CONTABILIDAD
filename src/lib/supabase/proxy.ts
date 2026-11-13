import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "./types";

function conCookies(desde: NextResponse, hacia: NextResponse) {
  for (const cookie of desde.cookies.getAll()) {
    hacia.cookies.set(cookie);
  }
  return hacia;
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const ruta = request.nextUrl.pathname;
  const esLogin = ruta.startsWith("/login");
  const esCallback = ruta === "/auth/callback";
  const esIcono = /^\/(?:apple-)?icon(?:-[A-Za-z0-9]+|\/[^/]+)?$/.test(ruta);
  const esPublica = esLogin || esCallback || esIcono;

  if (esIcono) return NextResponse.next({ request });

  if (!url || !key) {
    if (esPublica) return NextResponse.next({ request });
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.searchParams.set("aviso", "config");
    return NextResponse.redirect(destino);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user && !esPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    return conCookies(supabaseResponse, NextResponse.redirect(destino));
  }

  if (user && esLogin) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/dashboard";
    destino.search = "";
    return conCookies(supabaseResponse, NextResponse.redirect(destino));
  }

  return supabaseResponse;
}
