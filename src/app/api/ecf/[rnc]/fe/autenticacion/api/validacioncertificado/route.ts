import { leerXmlMultipart, validarRncRuta, validarSemillaFirmadaYCrearToken } from "@/lib/ecf/receptor";

export const runtime = "nodejs";

type ContextoRuta = { params: Promise<{ rnc: string }> };

export async function POST(request: Request, contexto: ContextoRuta) {
  const { rnc } = await contexto.params;
  const errorRnc = validarRncRuta(rnc);
  if (errorRnc) return Response.json({ error: errorRnc }, { status: 400 });

  let xml: string | null = null;
  try {
    xml = await leerXmlMultipart(await request.formData());
  } catch {
    xml = null;
  }
  if (!xml)
    return Response.json({ error: "Debe enviar la semilla firmada en multipart/form-data campo xml" }, { status: 400 });

  const resultado = validarSemillaFirmadaYCrearToken(xml, rnc);
  if (!resultado.ok) return Response.json({ error: resultado.error }, { status: resultado.status });
  return Response.json(
    { token: resultado.token, expira: resultado.expira, expedido: resultado.expedido },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
