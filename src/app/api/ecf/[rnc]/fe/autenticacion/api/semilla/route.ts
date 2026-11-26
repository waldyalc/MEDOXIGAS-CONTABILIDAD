import { emitirSemillaReceptor, validarRncRuta } from "@/lib/ecf/receptor";

export const runtime = "nodejs";

type ContextoRuta = { params: Promise<{ rnc: string }> };

export async function GET(_request: Request, contexto: ContextoRuta) {
  const { rnc } = await contexto.params;
  const errorRnc = validarRncRuta(rnc);
  if (errorRnc) return Response.json({ error: errorRnc }, { status: 400 });
  try {
    const semilla = emitirSemillaReceptor(rnc);
    return new Response(semilla.xml, {
      status: 200,
      headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ error: "No se pudo emitir la semilla del receptor e-CF" }, { status: 500 });
  }
}
