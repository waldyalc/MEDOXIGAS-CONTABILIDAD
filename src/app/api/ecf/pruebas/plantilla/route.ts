import { getRol } from "@/lib/auth/rol";
import { generarPlantillaExcelPruebasPiloto } from "@/lib/ecf/excel-pruebas";

export const runtime = "nodejs";

function jsonError(mensaje: string, status: number) {
  return Response.json({ ok: false, error: mensaje }, { status });
}

export async function GET(request: Request) {
  const rol = await getRol();
  if (!rol) return jsonError("Debes iniciar sesión para descargar la plantilla de pruebas DGII.", 401);
  if (rol !== "admin" && rol !== "contador") {
    return jsonError("Solo administradores y contadores pueden descargar la plantilla de pruebas DGII.", 403);
  }

  const url = new URL(request.url);
  const rnc = url.searchParams.get("rnc")?.replace(/\D/g, "") ?? "";
  const razonSocial = url.searchParams.get("razonSocial")?.trim() || "OXYMAT SRL";
  if (!/^\d{9}(\d{2})?$/.test(rnc)) return jsonError("El parámetro rnc debe tener 9 u 11 dígitos.", 400);

  try {
    const buffer = await generarPlantillaExcelPruebasPiloto(rnc, razonSocial);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="set-pruebas-dgii-${rnc}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo generar la plantilla Excel de pruebas.", 500);
  }
}
