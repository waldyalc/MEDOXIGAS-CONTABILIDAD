"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";

import { ChevronDown, ChevronUp, CircleCheck, Clock, Download, Loader2 } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  construirUrlQrEcf,
  derivarEstadoEmisionFactura,
  type EnvioEcfFactura,
  esNcfElectronico,
  fechaEmisionIso,
  nombreArchivoXmlEcf,
} from "@/lib/facturacion/emision-ecf";
import { consultarEstadoFacturaEcfAction, emitirFacturaEcfAction } from "@/lib/facturacion/emision-ecf-acciones";
import type { ContactoResumen, FacturaDetalle } from "@/lib/facturacion/tipos";

const PASOS = ["Firmando XML e-CF", "Enviando comprobante a la DGII", "Verificando acuse de aceptación"] as const;

function estadoBadge(
  envio: EnvioEcfFactura | null,
  enviando: boolean,
  estado: ReturnType<typeof derivarEstadoEmisionFactura>,
) {
  if (envio?.estado === "aceptado") {
    return {
      texto: "Comprobante aceptado",
      clases: "border-emerald-700/15 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    };
  }
  if (envio?.estado === "aceptado_condicional") {
    return {
      texto: "Aceptado condicional",
      clases: "border-amber-700/15 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    };
  }
  if (estado === "en_proceso") {
    return {
      texto: enviando ? "Subiendo comprobante a la DGII" : "En proceso",
      clases: "border-primary/15 bg-primary/10 text-primary",
    };
  }
  if (estado === "rechazada") {
    return {
      texto: "Comprobante rechazado",
      clases: "border-rose-700/15 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
    };
  }
  return {
    texto: "Sin emisión",
    clases: "border-amber-700/15 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  };
}

function FilaDato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="border-border/60 grid gap-1 border-b py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
      <span className="text-foreground/80 text-sm">{etiqueta}</span>
      <span className="text-foreground min-w-0 text-sm">{children}</span>
    </div>
  );
}

function IconoPaso({ indice, paso }: { indice: number; paso: number }) {
  if (indice < paso) return <CircleCheck className="size-3.5 text-emerald-600" />;
  if (indice === paso) return <Loader2 className="text-primary size-3.5 animate-spin" />;
  return <Clock className="size-3.5 text-slate-400" />;
}

function ProgresoEmision() {
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    const intervalo = window.setInterval(() => setPaso((actual) => (actual + 1) % PASOS.length), 1100);
    return () => window.clearInterval(intervalo);
  }, []);

  return (
    <div className="border-primary/15 bg-primary/[0.04] mb-4 rounded-xl border px-4 py-3">
      <div className="text-primary flex items-center gap-2 text-sm font-medium">
        <Loader2 className="size-4 animate-spin" />
        Subiendo comprobante a la DGII...
      </div>
      <ol className="mt-3 space-y-2">
        {PASOS.map((texto, indice) => (
          <li key={texto} className="text-foreground/75 flex items-center gap-2 text-xs">
            <IconoPaso indice={indice} paso={paso} />
            {texto}
          </li>
        ))}
      </ol>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: La tarjeta concentra los cinco estados fiscales y sus acciones en una sola superficie para replicar el contrato visual de Alegra.
export function TarjetaEmisionEcf({
  factura,
  envio,
  contacto,
  puedeEscribir,
}: {
  factura: FacturaDetalle;
  envio: EnvioEcfFactura | null;
  contacto: ContactoResumen;
  puedeEscribir: boolean;
}) {
  const router = useRouter();
  const [expandido, setExpandido] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estado = derivarEstadoEmisionFactura(factura.ncf, envio);
  if (!esNcfElectronico(factura.ncf) && !envio) return null;

  const badge = estadoBadge(envio, enviando, estado);
  const enProceso = enviando || estado === "en_proceso";
  const ncf = factura.ncf ?? envio?.encf ?? "";
  const archivoXml = nombreArchivoXmlEcf(ncf);
  const urlDgii =
    envio?.url_qr ??
    (envio
      ? construirUrlQrEcf({
          envio,
          rncComprador: contacto.rnc_cedula,
          fechaEmision: factura.fecha,
          montoTotal: factura.total,
        })
      : null);
  const puedeEmitir = puedeEscribir && (estado === "sin_emision" || estado === "rechazada");
  const xmlDisponible = envio?.tiene_xml === true;

  async function emitir() {
    setError(null);
    setEnviando(true);
    try {
      const resultado = await emitirFacturaEcfAction(factura.id);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo emitir el comprobante a la DGII.");
    } finally {
      setEnviando(false);
    }
  }

  async function consultar() {
    setError(null);
    setConsultando(true);
    try {
      const resultado = await consultarEstadoFacturaEcfAction(factura.id);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo consultar el estado en la DGII.");
    } finally {
      setConsultando(false);
    }
  }

  return (
    <section className="border-border bg-card rounded-2xl border px-6 py-5" aria-labelledby="titulo-emision-ecf">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="titulo-emision-ecf" className="text-foreground text-[15px] leading-6 font-semibold">
            Información de emisión
          </h2>
          <Badge
            variant="outline"
            className={cn("h-5 rounded-[4px] border px-[5px] py-px text-xs font-medium", badge.clases)}
          >
            {enProceso ? <Loader2 className="size-3 animate-spin" /> : null}
            {badge.texto}
          </Badge>
        </div>
        <button
          type="button"
          className="text-primary flex w-fit items-center gap-1 text-sm font-medium hover:underline"
          aria-expanded={expandido}
          onClick={() => setExpandido((actual) => !actual)}
        >
          {expandido ? "Ocultar detalles" : "Mostrar detalles"}
          {expandido ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {expandido ? (
        <div className="mt-4">
          {enProceso ? <ProgresoEmision /> : null}
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {envio?.mensajes?.length ? (
            <div className="mb-4 rounded-lg border border-amber-700/15 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {envio.mensajes.join("; ")}
            </div>
          ) : null}

          <FilaDato etiqueta="Fecha de emisión">{fechaEmisionIso(envio?.fecha_hora_firma, factura.fecha)}</FilaDato>
          <FilaDato etiqueta="Código de seguridad">
            {envio?.codigo_seguridad ? (
              <span className="font-mono">{envio.codigo_seguridad}</span>
            ) : (
              "Pendiente de firma"
            )}
          </FilaDato>

          <div className="flex flex-wrap items-center gap-3 pt-4">
            {urlDgii ? (
              <a
                href={urlDgii}
                target="_blank"
                rel="noreferrer"
                className="bg-primary/10 text-primary hover:bg-primary/15 inline-flex h-9 items-center rounded-lg border-0 px-4 text-sm font-medium"
              >
                Ver comprobante en la DGII
              </a>
            ) : (
              <Button
                type="button"
                disabled
                title="Disponible cuando el comprobante sea firmado y aceptado"
                className="h-9"
              >
                Ver comprobante en la DGII
              </Button>
            )}

            {xmlDisponible ? (
              <a
                href={`/api/facturacion/${factura.id}/xml-ecf`}
                className="border-border bg-card hover:bg-muted inline-flex h-9 items-center gap-2 rounded-lg border px-4 text-sm font-normal"
              >
                <Download className="size-4" />
                {archivoXml}
              </a>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled
                className="border-border bg-card h-9 gap-2 rounded-lg text-sm font-normal"
              >
                <Download className="size-4" />
                {archivoXml}
              </Button>
            )}

            {envio?.track_id && estado === "en_proceso" ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg"
                disabled={consultando}
                onClick={() => void consultar()}
              >
                {consultando ? <Loader2 className="animate-spin" /> : null}
                Consultar estado en la DGII
              </Button>
            ) : null}

            {puedeEmitir ? (
              <Button type="button" className="h-9 rounded-lg" disabled={enviando} onClick={() => void emitir()}>
                {enviando ? <Loader2 className="animate-spin" /> : null}
                {envio?.estado === "rechazado" || envio?.estado === "error_red"
                  ? "Reintentar emisión"
                  : "Emitir a la DGII"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
