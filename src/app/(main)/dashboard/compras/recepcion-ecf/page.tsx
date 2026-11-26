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
  rnc_emisor: string;
  razon_social_emisor: string | null;
  rnc_comprador: string | null;
  tipo_ecf: string;
  encf: string;
  fecha_emision: string | null;
  monto_total: number | string | null;
  total_itbis: number | string | null;
  estado_aprobacion: "pendiente" | "aceptado" | "rechazado" | null;
  detalle_motivo_rechazo: string | null;
  factura_proveedor_id: string | null;
  factura_compra_id?: string | null;
  estado_registro: string | null;
  xml_recibido: string | null;
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

function textoXmlDesdeBytea(valor: string | null): string | null {
  if (valor == null || valor === "") return null;
  if (!valor.startsWith("\\x")) return valor;
  const hexadecimal = valor.slice(2);
  if (!/^([0-9a-f]{2})+$/i.test(hexadecimal)) return null;
  return Buffer.from(hexadecimal, "hex").toString("utf8");
}

function eventoDgiiDesde(estadoAprobacion: EcfRecibidoDb["estado_aprobacion"]): EcfRecibidoBandeja["eventoDgii"] {
  if (estadoAprobacion === "aceptado") return "aprobado";
  if (estadoAprobacion === "rechazado") return "rechazado";
  return "acusado";
}

function facturaCompraIdDesde(fila: EcfRecibidoDb): string | null {
  return fila.factura_proveedor_id ?? fila.factura_compra_id ?? null;
}

function estadoRegistroDesde(fila: EcfRecibidoDb): EcfRecibidoBandeja["estadoRegistro"] {
  if (facturaCompraIdDesde(fila) || fila.estado_registro === "registrado") return "registrada";
  return "pendiente";
}

function convertirFilaRecibida(fila: EcfRecibidoDb): EcfRecibidoBandeja {
  const xml = textoXmlDesdeBytea(fila.xml_recibido);
  const parseado = xml ? parsearXmlEcfRecibido(xml) : null;
  const ecf = parseado?.ok ? parseado.ecf : null;

  return {
    id: fila.id,
    rncEmisor: fila.rnc_emisor,
    razonSocialEmisor: fila.razon_social_emisor ?? ecf?.razonSocialEmisor ?? "",
    correoEmisor: ecf?.correoEmisor ?? null,
    rncComprador: fila.rnc_comprador ?? ecf?.rncComprador ?? null,
    tipoEcf: fila.tipo_ecf,
    encf: fila.encf,
    fechaEmision: fila.fecha_emision ?? ecf?.fechaEmision ?? null,
    montoGravado: ecf?.montoGravado ?? null,
    montoExento: ecf?.montoExento ?? null,
    totalItbis: numeroDb(fila.total_itbis) ?? ecf?.totalItbis ?? null,
    montoTotal: numeroDb(fila.monto_total) ?? ecf?.montoTotal ?? null,
    codigoSeguridad: ecf?.codigoSeguridad ?? null,
    eventoDgii: eventoDgiiDesde(fila.estado_aprobacion),
    estadoRegistro: estadoRegistroDesde(fila),
    facturaCompraId: facturaCompraIdDesde(fila),
    motivoRechazo: fila.detalle_motivo_rechazo,
    xml,
    items: ecf?.items ?? [],
  };
}

async function leerRecibidosTolerante(supabase: ClienteSupabase): Promise<LecturaRecibidos> {
  try {
    const resultado = await supabase
      // @ts-expect-error — ecf_recibidos aún no existe en los tipos generados porque su migración no se aplicó; la pantalla debe tolerarlo.
      .from("ecf_recibidos")
      .select(
        "id, rnc_emisor, razon_social_emisor, rnc_comprador, tipo_ecf, encf, fecha_emision, monto_total, total_itbis, estado_aprobacion, detalle_motivo_rechazo, factura_proveedor_id, estado_registro, xml_recibido",
      )
      .order("recibido_en", { ascending: false })
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
