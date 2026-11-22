import type { CSSProperties } from "react";

import { cn } from "cn";

import type { FilaTicketPOS, LineaTicketPOS, TicketPOSPayload } from "@/lib/pos/impresion";

/**
 * Ticket térmico del POS (80 mm / 57 mm). Es presentacional: pinta el
 * `TicketPOSPayload` que arma la capa 2B con la plantilla de la terminal.
 * No consulta, no imprime y no navega; `ImpresionPos` monta el portal.
 *
 * Copia el orden del ticket de Alegra: logo y empresa → cliente →
 * comprobante → ítems → totales → total recibido y conteos → pie.
 * Papel térmico: negro sobre blanco, sin tokens.
 */

const FAMILIAS: Record<TicketPOSPayload["diseno"]["fuente"], string> = {
  clasica: 'ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif',
  moderna: '"Geist", "Inter", ui-sans-serif, system-ui, sans-serif',
  compacta: 'ui-sans-serif, system-ui, "Arial Narrow", sans-serif',
};

const TAMANOS: Record<TicketPOSPayload["diseno"]["tamano_letra"], Record<80 | 57, string>> = {
  pequena: { 80: "7.5pt", 57: "6.5pt" },
  mediana: { 80: "8pt", 57: "7pt" },
  grande: { 80: "9pt", 57: "7.5pt" },
};

const INTERLINEADO: Record<TicketPOSPayload["diseno"]["interlineado"], number> = {
  compacto: 1.3,
  normal: 1.55,
  amplio: 1.75,
};

/*
 * Alto fijo de 250 mm: Chrome ignora el alto «auto» en @page y cae a
 * Letter; con alto fijo el PDF sale 80 × 250 mm, una sola página
 * (verificado con pdfinfo contra el ticket real de Alegra: 227.04 × 708.96 pt).
 */
const CSS_IMPRESION = `
@media print {
  @page pos-ticket-80 { size: 80mm 250mm; margin: 0; }
  @page pos-ticket-57 { size: 57mm 250mm; margin: 0; }

  [data-print-root][data-print-pos="ticket-80"],
  .ticket-pos-80 { page: pos-ticket-80; }

  [data-print-root][data-print-pos="ticket-57"],
  .ticket-pos-57 { page: pos-ticket-57; }

  [data-print-root] .ticket-pos {
    width: 80mm;
    margin: 0;
    padding: 6mm 5mm;
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
  [data-print-root] .ticket-pos tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  [data-print-root] .no-imprimir,
  .no-imprimir { display: none !important; }
}
`;

function Separador() {
  return <hr className="my-1.5 border-0 border-t border-black" />;
}

function Logo({ url, nombre, estrecho }: { url: string | null; nombre: string; estrecho: boolean }) {
  if (!url) return null;
  return (
    // biome-ignore lint/performance/noImgElement: logo configurable de la empresa en el ticket
    <img
      src={url}
      alt={nombre}
      className={cn("mx-auto mb-1 w-auto object-contain grayscale", estrecho ? "max-h-[11mm]" : "max-h-[16mm]")}
      onError={(evento) => {
        evento.currentTarget.style.display = "none";
      }}
    />
  );
}

function FilaTotal({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-2", fuerte && "font-bold")}>
      <span className="min-w-0">{etiqueta}</span>
      <span className="shrink-0 text-right tabular-nums">{valor}</span>
    </div>
  );
}

/**
 * «Etiqueta: valor» con la etiqueta en negrita y el valor normal, como las
 * líneas del ticket de Alegra («Fecha: 21/11/2026 4:40 pm»). Si la línea no
 * lleva dos puntos (p. ej. «NCF B0200018349») se imprime toda en negrita.
 */
function LineaDato({ texto, className }: { texto: string; className?: string }) {
  const corte = texto.indexOf(": ");
  if (corte <= 0) {
    return <p className={cn("font-bold", className)}>{texto}</p>;
  }
  return (
    <p className={className}>
      <span className="font-bold">{texto.slice(0, corte + 1)}</span>
      {texto.slice(corte + 1)}
    </p>
  );
}

function LineaItem({
  linea,
  apilada,
  minimalista,
  detallado,
}: {
  linea: LineaTicketPOS;
  apilada: boolean;
  minimalista: boolean;
  detallado: boolean;
}) {
  return (
    <div className="linea flex flex-col py-0.5">
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn("min-w-0 break-words text-[0.9em]", minimalista && "font-bold tracking-[0.08em] uppercase")}
        >
          {linea.descripcion}
        </span>
        {apilada ? null : <span className="ml-auto shrink-0 text-[0.9em] tabular-nums">{linea.total}</span>}
      </div>
      {linea.detalle ? (
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("min-w-0 text-[0.78em]", minimalista && "tracking-[0.06em] uppercase")}>
            {linea.detalle}
          </span>
          {apilada ? <span className="shrink-0 text-[0.9em] tabular-nums">{linea.total}</span> : null}
        </div>
      ) : null}
      {apilada && !linea.detalle ? <div className="text-right text-[0.9em] tabular-nums">{linea.total}</div> : null}
      {linea.referencia ? <span className="text-[0.78em]">Ref. {linea.referencia}</span> : null}
      {detallado && linea.descuento ? (
        <div className="flex items-baseline justify-between gap-2 text-[0.78em]">
          <span>Descuento</span>
          <span className="shrink-0 tabular-nums">{linea.descuento}</span>
        </div>
      ) : null}
    </div>
  );
}

/** «Cliente: <nombre>» en negrita y sus líneas debajo, antes del comprobante. */
function SeccionCliente({ cliente, minimalista }: { cliente: TicketPOSPayload["cliente"]; minimalista: boolean }) {
  if (!cliente.nombre && cliente.lineas.length === 0) return null;

  return (
    <section
      className={cn("flex flex-col gap-0.5", minimalista ? "items-start text-left" : "items-center text-center")}
    >
      {cliente.nombre ? <p className="font-bold">Cliente: {cliente.nombre}</p> : null}
      {cliente.lineas.map((linea) => (
        <p key={linea} className="text-[0.92em]">
          {linea}
        </p>
      ))}
    </section>
  );
}

function SeccionItems({
  lineas,
  apilada,
  minimalista,
  detallado,
}: {
  lineas: LineaTicketPOS[];
  apilada: boolean;
  minimalista: boolean;
  detallado: boolean;
}) {
  if (lineas.length === 0) return null;

  return (
    <section className="mt-2 flex flex-col">
      <div className="flex items-baseline justify-between gap-2 text-[0.85em]">
        <span>Item</span>
        <span>Total</span>
      </div>
      <div className="mt-1 flex flex-col">
        {lineas.map((linea, indice) => (
          <LineaItem
            key={`${indice}-${linea.descripcion}`}
            linea={linea}
            apilada={apilada}
            minimalista={minimalista}
            detallado={detallado}
          />
        ))}
      </div>
    </section>
  );
}

function SeccionBloques({ bloques, minimalista }: { bloques: TicketPOSPayload["bloques"]; minimalista: boolean }) {
  if (bloques.length === 0) return null;

  return (
    <>
      <Separador />
      {bloques.map((bloque) => (
        <section key={bloque.titulo} className="mt-1 flex flex-col">
          <p className={cn("text-[0.9em] font-bold", minimalista && "uppercase")}>{bloque.titulo}</p>
          {bloque.filas.map((fila) => (
            <FilaTotal
              key={`${bloque.titulo}-${fila.etiqueta || fila.valor}`}
              etiqueta={fila.etiqueta}
              valor={fila.valor}
            />
          ))}
        </section>
      ))}
    </>
  );
}

/** Totales como en Alegra: etiquetas en negrita a la derecha del bloque, montos al filo. */
function SeccionTotales({ totales }: { totales: FilaTicketPOS[] }) {
  if (totales.length === 0) return null;

  return (
    <section className="bloque-totales mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
      {totales.map((fila) => {
        const fuerte = fila.etiqueta === "Total" || fila.etiqueta === "Total del recibo";
        return (
          <div key={fila.etiqueta} className="contents">
            <span className="min-w-0 break-words text-right font-bold">{fila.etiqueta ? `${fila.etiqueta}:` : ""}</span>
            <span className={cn("text-right tabular-nums", fuerte && "text-[1.4em] font-bold")}>{fila.valor}</span>
          </div>
        );
      })}
    </section>
  );
}

/**
 * «Total recibido», «Cambio» y los conteos del pie, a la izquierda con la
 * etiqueta en negrita: debajo del Total, sin bloque «Pagos» aparte (Alegra).
 */
function LineasIzquierda({ filas }: { filas: FilaTicketPOS[] }) {
  if (filas.length === 0) return null;

  return (
    <section className="mt-1.5 flex flex-col gap-0.5">
      {filas.map((fila) => (
        <LineaDato key={`${fila.etiqueta}-${fila.valor}`} texto={`${fila.etiqueta}: ${fila.valor}`} />
      ))}
    </section>
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
  const { diseno, encabezado, cliente } = payload;
  const ancho = diseno.ancho_mm;
  const estrecho = ancho === 57;
  const minimalista = diseno.estilo === "minimalista";
  const detallado = diseno.estilo === "detallado";
  const nombreEmpresa = encabezado.empresa[0] ?? "";
  const alineacion = minimalista ? "items-start text-left" : "items-center text-center";
  const tieneCliente = Boolean(cliente.nombre) || cliente.lineas.length > 0;

  const estilo: CSSProperties = {
    width: `${ancho}mm`,
    padding: "6mm 5mm",
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

      <header className={cn("flex flex-col gap-0.5", alineacion)}>
        {diseno.mostrar_logo ? <Logo url={diseno.logo_url} nombre={nombreEmpresa} estrecho={estrecho} /> : null}
        {encabezado.empresa.map((linea, indice) =>
          indice === 0 ? (
            <p key={linea} className="text-[1.35em] font-bold">
              {linea}
            </p>
          ) : (
            <LineaDato key={linea} texto={linea} className="text-[0.95em]" />
          ),
        )}
      </header>

      {tieneCliente ? (
        <>
          <Separador />
          <SeccionCliente cliente={cliente} minimalista={minimalista} />
        </>
      ) : null}

      <Separador />

      <div className={cn("flex flex-col gap-0.5", alineacion)}>
        <p className={cn("font-bold", minimalista && "tracking-[0.08em] uppercase")}>{encabezado.titulo}</p>
        {encabezado.anulada ? <p className="text-[1.2em] font-bold tracking-widest">ANULADA</p> : null}
        {encabezado.lineas.map((linea) => (
          <LineaDato key={linea} texto={linea} className="text-[0.95em]" />
        ))}
      </div>

      <SeccionItems
        lineas={payload.lineas}
        apilada={diseno.columnas === "apilada"}
        minimalista={minimalista}
        detallado={detallado}
      />

      <SeccionBloques bloques={payload.bloques} minimalista={minimalista} />

      <SeccionTotales totales={payload.totales} />

      <LineasIzquierda filas={payload.pagos} />

      <LineasIzquierda filas={payload.resumen} />

      {payload.nota ? (
        <p className={cn("mt-1 text-[0.82em]", minimalista ? "text-left" : "text-center")}>{payload.nota}</p>
      ) : null}

      {payload.pie ? (
        <p className={cn("mt-4 text-[0.92em] whitespace-pre-line", minimalista ? "text-left" : "text-center")}>
          {payload.pie}
        </p>
      ) : null}

      {estrecho ? <div className="mt-1 text-center text-[0.78em]">***</div> : null}
    </div>
  );
}
