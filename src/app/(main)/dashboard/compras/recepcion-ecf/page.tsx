import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { getRol } from "@/lib/auth/rol";
import { createClient } from "@/lib/supabase/server";

import { parsearXmlEcfRecibido } from "./_components/parser-xml-recibido";
import { type EcfRecibidoBandeja, RecepcionEcfCliente } from "./_components/recepcion-ecf-cliente";

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

interface EmpresaRecepcion {
  nombre: string | null;
  rnc: string | null;
}

interface EcfRecibidoDb {
  id: string;
  rnc_receptor: string;
  rnc_emisor: string;
  razon_social_emisor: string;
  correo_emisor: string | null;
  tipo_ecf: string;
  encf: string;
  fecha_emision: string | null;
  monto_gravado: number | string | null;
  monto_exento: number | string | null;
  total_itbis: number | string | null;
  monto_total: number | string | null;
  codigo_seguridad: string | null;
  estado_acecf: "pendiente" | "aprobado" | "rechazado";
  motivo_rechazo: string | null;
  factura_compra_id: string | null;
  xml_original: string;
}

interface LecturaRecibidos {
  tablaDisponible: boolean;
  recibidos: EcfRecibidoBandeja[];
}

function numeroDb(valor: number | string | null): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string") {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  }
  return null;
}

function eventoDgiiDesde(estadoAcecf: EcfRecibidoDb["estado_acecf"]): EcfRecibidoBandeja["eventoDgii"] {
  if (estadoAcecf === "aprobado") return "aprobado";
  if (estadoAcecf === "rechazado") return "rechazado";
  return "acusado";
}

function convertirFilaRecibida(fila: EcfRecibidoDb): EcfRecibidoBandeja {
  const parseado = fila.xml_original ? parsearXmlEcfRecibido(fila.xml_original) : null;
  const ecf = parseado?.ok ? parseado.ecf : null;

  return {
    id: fila.id,
    rncEmisor: fila.rnc_emisor,
    razonSocialEmisor: fila.razon_social_emisor !== "" ? fila.razon_social_emisor : (ecf?.razonSocialEmisor ?? ""),
    correoEmisor: fila.correo_emisor ?? ecf?.correoEmisor ?? null,
    rncComprador: fila.rnc_receptor !== "" ? fila.rnc_receptor : (ecf?.rncComprador ?? null),
    tipoEcf: fila.tipo_ecf,
    encf: fila.encf,
    fechaEmision: fila.fecha_emision ?? ecf?.fechaEmision ?? null,
    montoGravado: numeroDb(fila.monto_gravado) ?? ecf?.montoGravado ?? null,
    montoExento: numeroDb(fila.monto_exento) ?? ecf?.montoExento ?? null,
    totalItbis: numeroDb(fila.total_itbis) ?? ecf?.totalItbis ?? null,
    montoTotal: numeroDb(fila.monto_total) ?? ecf?.montoTotal ?? null,
    codigoSeguridad: fila.codigo_seguridad ?? ecf?.codigoSeguridad ?? null,
    eventoDgii: eventoDgiiDesde(fila.estado_acecf),
    estadoRegistro: fila.factura_compra_id ? "registrada" : "pendiente",
    facturaCompraId: fila.factura_compra_id,
    motivoRechazo: fila.motivo_rechazo,
    xml: fila.xml_original,
    items: ecf?.items ?? [],
  };
}

async function leerRecibidosTolerante(supabase: ClienteSupabase): Promise<LecturaRecibidos> {
  try {
    const resultado = await supabase
      .from("ecf_recibidos")
      .select(
        "id, rnc_receptor, rnc_emisor, razon_social_emisor, correo_emisor, tipo_ecf, encf, fecha_emision, monto_gravado, monto_exento, total_itbis, monto_total, codigo_seguridad, estado_acecf, motivo_rechazo, factura_compra_id, xml_original",
      )
      .order("recibido_at", { ascending: false })
      .limit(100)
      .returns<EcfRecibidoDb[]>();

    if (resultado.error) return { tablaDisponible: false, recibidos: [] };
    return { tablaDisponible: true, recibidos: (resultado.data ?? []).map(convertirFilaRecibida) };
  } catch {
    return { tablaDisponible: false, recibidos: [] };
  }
}

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");
  if (rol === "lector") redirect("/dashboard/compras");

  const supabase = await createClient();
  const [empresaRes, lectura] = await Promise.all([
    supabase.from("empresa").select("nombre, rnc").eq("id", 1).maybeSingle().returns<EmpresaRecepcion | null>(),
    leerRecibidosTolerante(supabase),
  ]);

  if (empresaRes.error) throw new Error(empresaRes.error.message);

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Recepción de comprobantes electrónicos"
        subtitulo="Recibe automáticamente los e-CF emitidos por tus proveedores. Acéptalos o recházalos."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Compras", href: "/dashboard/compras" },
          { etiqueta: "Recepción de comprobantes" },
        ]}
      />
      <RecepcionEcfCliente
        recibidos={lectura.recibidos}
        tablaDisponible={lectura.tablaDisponible}
        empresa={empresaRes.data}
      />
    </ContenedorLista>
  );
}
