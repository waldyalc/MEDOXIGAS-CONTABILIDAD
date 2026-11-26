import { z } from "zod";

import { getRol } from "@/lib/auth/rol";
import { nombreArchivoXmlEcf } from "@/lib/facturacion/emision-ecf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function nombreContentDisposition(nombre: string): string {
  const ascii = nombre.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rol = await getRol();
  if (!rol) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Factura inválida" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ecf_envios")
    .select("encf, xml_firmado")
    .eq("documento_tipo", "factura")
    .eq("documento_id", id)
    .not("xml_firmado", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ encf: string; xml_firmado: string | null }>();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data?.xml_firmado) {
    return Response.json({ error: "La factura aún no tiene un XML e-CF firmado." }, { status: 404 });
  }

  return new Response(data.xml_firmado, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": nombreContentDisposition(nombreArchivoXmlEcf(data.encf)),
      "Cache-Control": "private, no-store",
    },
  });
}
