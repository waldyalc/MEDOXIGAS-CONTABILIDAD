import {
  leerXmlMultipart,
  procesarRecepcionEcf,
  resolverCredencialesFirmaRnc,
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
  if (!xml) return Response.json({ error: "Debe enviar el e-CF en multipart/form-data campo xml" }, { status: 400 });

  const credenciales = resolverCredencialesFirmaRnc(rnc);
  if (!credenciales) {
    return Response.json({ error: "No hay certificado de firma configurado para este RNC receptor" }, { status: 500 });
  }
  const resultado = procesarRecepcionEcf({
    rncReceptor: rnc,
    xmlCrudo: xml,
    clavePrivadaPem: credenciales.clavePrivadaPem,
    certificadoPem: credenciales.certificadoPem,
  });
  if (resultado.arecfXml === "") {
    return Response.json({ error: "No se pudo construir el acuse de recibo ARECF" }, { status: resultado.status });
  }
  return new Response(resultado.arecfXml, {
    status: resultado.status,
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "no-store" },
  });
}
