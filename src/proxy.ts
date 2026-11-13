import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Puerta de autenticación. En Next.js 16 este archivo es el middleware
// (se llama proxy.ts). Todas las rutas pasan por aquí, salvo estáticos.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
