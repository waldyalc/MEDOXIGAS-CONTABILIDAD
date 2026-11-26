import {
  leerXmlMultipart,
  procesarAprobacionComercialRecibida,
  validarRncRuta,
  verificarTokenReceptor,
} from "@/lib/ecf/receptor";

export const runtime = "nodejs";

type ContextoRuta = { params: Promise<{ rnc: string }> };

export async function POST(request: Request, contexto: ContextoRuta) {
  const { rnc } = await contexto.params;
  const errorRnc = validarRncRuta(rnc);
  if (errorRnc) return Response.json({ error: errorRnc }, { status: 400 });
  if (!verificarTokenReceptor(request.headers.get("authorization"), rnc)) {
    return Response.json({ error: "Token Bearer del receptor e-CF inválido o expirado" }, { status: 401 });
  }

  let xml: string | null = null;
  try {
    xml = await leerXmlMultipart(await request.formData());
  } catch {
    xml = null;
  }
  if (!xml) return Response.json({ error: "Debe enviar el ACECF en multipart/form-data campo xml" }, { status: 400 });

  const resultado = procesarAprobacionComercialRecibida({ rncReceptor: rnc, xmlCrudo: xml });
  return Response.json(
    resultado.ok
      ? { ok: true, mensaje: resultado.mensaje, datos: resultado.datos }
      : { ok: false, error: resultado.mensaje },
    { status: resultado.status, headers: { "cache-control": "no-store" } },
  );
}
