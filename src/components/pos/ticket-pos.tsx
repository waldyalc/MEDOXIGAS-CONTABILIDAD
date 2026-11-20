import type { CSSProperties } from "react";

import { cn } from "cn";

import type { TicketPOSPayload } from "@/lib/pos/impresion";

/**
 * Ticket térmico del POS (80 mm / 57 mm). Es presentacional: pinta el
 * `TicketPOSPayload` que arma la capa 2B con la plantilla de la terminal.
 * No consulta, no imprime y no navega; `ImpresionPos` monta el portal.
 */

const FAMILIAS: Record<TicketPOSPayload["diseno"]["fuente"], string> = {
  clasica: 'ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif',
  moderna: '"Geist", "Inter", ui-sans-serif, system-ui, sans-serif',
  compacta: 'ui-sans-serif, system-ui, "Arial Narrow", sans-serif',
};

const TAMANOS: Record<TicketPOSPayload["diseno"]["tamano_letra"], Record<80 | 57, string>> = {
  pequena: { 80: "9pt", 57: "7pt" },
  mediana: { 80: "9.5pt", 57: "7.5pt" },
  grande: { 80: "10pt", 57: "8pt" },
};

const INTERLINEADO: Record<TicketPOSPayload["diseno"]["interlineado"], number> = {
  compacto: 1.15,
  normal: 1.3,
  amplio: 1.45,
};

const CSS_IMPRESION = `
@media print {
  @page pos-ticket-80 { size: 80mm auto; margin: 0; }
  @page pos-ticket-57 { size: 57mm auto; margin: 0; }

  [data-print-root][data-print-pos="ticket-80"],
  .ticket-pos-80 { page: pos-ticket-80; }

  [data-print-root][data-print-pos="ticket-57"],
  .ticket-pos-57 { page: pos-ticket-57; }

  [data-print-root] .ticket-pos {
    width: 80mm;
    margin: 0;
    padding: 3mm;
    background: #fff !important;
    color: #000 !important;
    box-shadow: none !important;
  }

  [data-print-root] .ticket-pos-57 { width: 57mm; }

  [data-print-root] .ticket-pos,
  [data-print-root] .ticket-pos * {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  [data-print-root] .ticket-pos .linea,
  [data-print-root] .ticket-pos .bloque-totales,
  [data-print-root] .ticket-pos .bloque-pago,
  [data-print-root] .ticket-pos tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  [data-print-root] .no-imprimir,
  .no-imprimir { display: none !important; }
}
`;

function Separador({ estilo }: { estilo: TicketPOSPayload["diseno"]["estilo"] }) {
  if (estilo === "minimalista") return <div className="my-2 h-px bg-black" />;
  return <div className="my-2 border-t border-dashed border-black" />;
}

function Logo({ url, nombre }: { url: string | null; nombre: string }) {
  if (!url) return null;
  return (
    // biome-ignore lint/performance/noImgElement: logo configurable de la empresa en el ticket
    <img
      src={url}
      alt={nombre}
      className="mx-auto max-h-[18mm] w-auto object-contain"
      onError={(evento) => {
        evento.currentTarget.style.display = "none";
      }}
    />
  );
}

function FilaTotal({
  etiqueta,
  valor,
  negativo,
  fuerte,
}: {
  etiqueta: string;
  valor: string;
  negativo?: boolean;
  fuerte?: boolean;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-2", fuerte && "font-bold")}>
      <span className="min-w-0">{etiqueta}</span>
      <span className={cn("shrink-0 text-right tabular-nums", negativo && "text-black")}>{valor}</span>
    </div>
  );
}

export function TicketPos({
  payload,
  vistaPrevia = false,
  className,
}: {
  payload: TicketPOSPayload;
  vistaPrevia?: boolean;
  className?: string;
}) {
  const { diseno, encabezado } = payload;
  const ancho = diseno.ancho_mm;
  const estrecho = ancho === 57;
  const minimalista = diseno.estilo === "minimalista";
  const detallado = diseno.estilo === "detallado";
  const nombreEmpresa = encabezado.empresa[0] ?? "";

  const estilo: CSSProperties = {
    width: `${ancho}mm`,
    padding: "3mm",
    fontFamily: FAMILIAS[diseno.fuente],
    fontSize: TAMANOS[diseno.tamano_letra][ancho],
    lineHeight: INTERLINEADO[diseno.interlineado],
    letterSpacing: diseno.fuente === "compacta" ? "-0.01em" : undefined,
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div
      className={cn(
        "ticket-pos mx-auto flex flex-col bg-white text-black",
        ancho === 57 ? "ticket-pos-57" : "ticket-pos-80",
        vistaPrevia ? "shadow-sm ring-1 ring-black/10" : "shadow-none",
        className,
      )}
      style={estilo}
    >
      <style>{CSS_IMPRESION}</style>

      <header
        className={cn("flex flex-col gap-0.5", minimalista ? "items-start text-left" : "items-center text-center")}
      >
        {diseno.mostrar_logo ? <Logo url={diseno.logo_url} nombre={nombreEmpresa} /> : null}
        {encabezado.empresa.map((linea, indice) => (
          <p key={linea} className={indice === 0 ? "text-[1.15em] font-bold" : "text-[0.92em]"}>
            {linea}
          </p>
        ))}
        <p className={cn("mt-1 font-bold", minimalista ? "uppercase" : "")}>{encabezado.titulo}</p>
        {encabezado.lineas.map((linea) => (
          <p key={linea} className="text-[0.92em]">
            {linea}
          </p>
        ))}
        {encabezado.anulada ? <p className="mt-1 text-[1.2em] font-bold tracking-widest">ANULADA</p> : null}
      </header>

      <Separador estilo={diseno.estilo} />

      {payload.lineas.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {payload.lineas.map((linea, indice) => (
            <div key={`${linea.descripcion}-${indice}`} className="linea flex flex-col">
              {minimalista ? (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 text-[0.8em] font-bold tracking-[0.08em] uppercase">
                    {linea.descripcion}
                  </span>
                  <span className="shrink-0 tabular-nums">{linea.total}</span>
                </div>
              ) : (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 font-semibold">{linea.descripcion}</span>
                  <span className="shrink-0 tabular-nums">{linea.total}</span>
                </div>
              )}
              {linea.referencia ? <span className="text-[0.82em]">Ref. {linea.referencia}</span> : null}
              {linea.detalle ? <span className="text-[0.82em]">{linea.detalle}</span> : null}
              {detallado && linea.descuento ? <span className="text-[0.82em]">Descuento {linea.descuento}</span> : null}
            </div>
          ))}
        </div>
      ) : null}

      {payload.bloques.map((bloque) => (
        <div key={bloque.titulo} className="mt-1 flex flex-col">
          <p className={cn("text-[0.9em] font-bold", minimalista ? "uppercase" : "")}>{bloque.titulo}</p>
          {bloque.filas.map((fila, indice) => (
            <FilaTotal
              key={`${bloque.titulo}-${fila.etiqueta}-${indice}`}
              etiqueta={fila.etiqueta}
              valor={fila.valor}
              negativo={fila.negativo}
            />
          ))}
        </div>
      ))}

      <Separador estilo={diseno.estilo} />

      <div
        className={cn(
          "bloque-totales flex flex-col",
          diseno.estilo === "minimalista" ? "border-t border-black pt-1" : "rounded-sm border border-black px-1.5 py-1",
        )}
      >
        {payload.totales.map((fila, indice) => {
          const esTotal = fila.etiqueta === "Total" || fila.etiqueta === "Total del recibo";
          return (
            <FilaTotal
              key={`${fila.etiqueta}-${indice}`}
              etiqueta={fila.etiqueta}
              valor={fila.valor}
              negativo={fila.negativo}
              fuerte={esTotal}
            />
          );
        })}
      </div>

      {payload.pagos.length > 0 ? (
        <>
          <Separador estilo={diseno.estilo} />
          <div className="bloque-pago flex flex-col">
            <p className={cn("text-[0.9em] font-bold", minimalista ? "uppercase" : "")}>Pagos</p>
            {payload.pagos.map((pago, indice) => (
              <FilaTotal key={`${pago.etiqueta}-${indice}`} etiqueta={pago.etiqueta} valor={pago.valor} />
            ))}
          </div>
        </>
      ) : null}

      {payload.nota ? <p className="mt-1 text-center text-[0.82em]">{payload.nota}</p> : null}

      {payload.pie ? (
        <>
          <Separador estilo={diseno.estilo} />
          <p className={cn("text-[0.85em] whitespace-pre-line", minimalista ? "text-left" : "text-center")}>
            {payload.pie}
          </p>
        </>
      ) : null}

      {estrecho ? <div className="mt-1 text-center text-[0.78em]">***</div> : null}
    </div>
  );
}
