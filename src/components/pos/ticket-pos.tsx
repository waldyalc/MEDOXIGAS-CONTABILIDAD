import type { CSSProperties } from "react";

import { cn } from "cn";

import type { FilaTicketPOS, LineaTicketPOS, TicketPOSPayload } from "@/lib/pos/impresion";

/**
 * Ticket térmico del POS (80 mm / 57 mm). Es presentacional: pinta el
 * `TicketPOSPayload` que arma la capa 2B con la plantilla de la terminal.
 * No consulta, no imprime y no navega; `ImpresionPos` monta el portal.
 *
 * La jerarquía sigue el orden del ticket de Alegra (`docs/alegra/pos/`):
 * logo y empresa → comprobante y datos → cliente → ítems → totales →
 * cobro y resumen → pie. Papel térmico: negro sobre blanco, sin tokens.
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

function LineaItem({
  linea,
  indice,
  apilada,
  minimalista,
  detallado,
}: {
  linea: LineaTicketPOS;
  indice: number;
  apilada: boolean;
  minimalista: boolean;
  detallado: boolean;
}) {
  return (
    <div className="linea flex flex-col py-0.5">
      <div className="flex items-baseline gap-1.5">
        <span className="shrink-0">{indice + 1}.</span>
        <span
          className={cn(
            "min-w-0 break-words",
            minimalista ? "text-[0.85em] font-bold tracking-[0.08em] uppercase" : "font-semibold",
          )}
        >
          {linea.descripcion}
        </span>
        {apilada ? null : <span className="ml-auto shrink-0 tabular-nums">{linea.total}</span>}
      </div>
      {linea.detalle ? (
        <div className="flex items-baseline justify-between gap-2 pl-[1.6em]">
          <span className={cn("min-w-0 text-[0.88em]", minimalista && "tracking-[0.06em] uppercase")}>
            {linea.detalle}
          </span>
          {apilada ? <span className="shrink-0 tabular-nums">{linea.total}</span> : null}
        </div>
      ) : null}
      {apilada && !linea.detalle ? <div className="pl-[1.6em] text-right tabular-nums">{linea.total}</div> : null}
      {linea.referencia ? <span className="pl-[1.6em] text-[0.85em]">Ref. {linea.referencia}</span> : null}
      {detallado && linea.descuento ? (
        <div className="flex items-baseline justify-between gap-2 pl-[1.6em] text-[0.88em]">
          <span>Descuento</span>
          <span className="shrink-0 tabular-nums">{linea.descuento}</span>
        </div>
      ) : null}
    </div>
  );
}

function SeccionCliente({ cliente, alineacion }: { cliente: TicketPOSPayload["cliente"]; alineacion: string }) {
  if (!cliente.nombre && cliente.lineas.length === 0) return null;

  return (
    <>
      <Separador />
      <section className={cn("flex flex-col gap-0.5", alineacion)}>
        {cliente.nombre ? <p className="font-bold">{cliente.nombre}</p> : null}
        {cliente.lineas.map((linea) => (
          <p key={linea} className="text-[0.92em]">
            {linea}
          </p>
        ))}
      </section>
    </>
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
    <>
      <Separador />
      <section className="flex flex-col">
        <div className="flex items-baseline justify-between gap-2 text-[0.85em]">
          <span>Ítem</span>
          <span>Total</span>
        </div>
        <hr className="mt-0.5 mb-1 border-0 border-t border-black" />
        <div className="flex flex-col">
          {lineas.map((linea, indice) => (
            <LineaItem
              key={`${indice}-${linea.descripcion}`}
              linea={linea}
              indice={indice}
              apilada={apilada}
              minimalista={minimalista}
              detallado={detallado}
            />
          ))}
        </div>
      </section>
    </>
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

/** Totales como en Alegra: etiquetas a la derecha del bloque, montos al filo. */
function SeccionTotales({ totales }: { totales: FilaTicketPOS[] }) {
  return (
    <section className="bloque-totales grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
      {totales.map((fila) => {
        const fuerte = fila.etiqueta === "Total" || fila.etiqueta === "Total del recibo";
        return (
          <div key={fila.etiqueta} className="contents">
            <span className={cn("min-w-0 break-words", fuerte ? "font-bold" : "text-right")}>
              {fila.etiqueta ? `${fila.etiqueta}:` : ""}
            </span>
            <span className={cn("text-right tabular-nums", fuerte && "text-[1.15em] font-bold")}>{fila.valor}</span>
          </div>
        );
      })}
    </section>
  );
}

function SeccionPagos({
  pagos,
  resumen,
  minimalista,
}: {
  pagos: FilaTicketPOS[];
  resumen: FilaTicketPOS[];
  minimalista: boolean;
}) {
  if (pagos.length === 0 && resumen.length === 0) return null;

  return (
    <>
      <Separador />
      <section className="bloque-pago flex flex-col">
        {pagos.length > 0 ? (
          <>
            <p className={cn("text-[0.9em] font-bold", minimalista && "uppercase")}>Pagos</p>
            {pagos.map((pago) => (
              <FilaTotal key={`${pago.etiqueta}-${pago.valor}`} etiqueta={`${pago.etiqueta}:`} valor={pago.valor} />
            ))}
          </>
        ) : null}
        {resumen.map((fila) => (
          <FilaTotal key={fila.etiqueta} etiqueta={`${fila.etiqueta}:`} valor={fila.valor} />
        ))}
      </section>
    </>
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

      <header className={cn("flex flex-col gap-0.5", alineacion)}>
        {diseno.mostrar_logo ? <Logo url={diseno.logo_url} nombre={nombreEmpresa} estrecho={estrecho} /> : null}
        {encabezado.empresa.map((linea, indice) => (
          <p key={linea} className={indice === 0 ? "text-[1.15em] font-bold" : "text-[0.92em]"}>
            {linea}
          </p>
        ))}
      </header>

      <div className={cn("mt-2 flex flex-col gap-0.5", alineacion)}>
        <p className={cn("font-bold", minimalista && "tracking-[0.08em] uppercase")}>{encabezado.titulo}</p>
        {encabezado.anulada ? <p className="text-[1.2em] font-bold tracking-widest">ANULADA</p> : null}
        {encabezado.lineas.map((linea) => (
          <p key={linea} className="text-[0.92em]">
            {linea}
          </p>
        ))}
      </div>

      {tieneCliente ? <SeccionCliente cliente={cliente} alineacion={alineacion} /> : null}

      <SeccionItems
        lineas={payload.lineas}
        apilada={diseno.columnas === "apilada"}
        minimalista={minimalista}
        detallado={detallado}
      />

      <SeccionBloques bloques={payload.bloques} minimalista={minimalista} />

      <Separador />

      <SeccionTotales totales={payload.totales} />

      <SeccionPagos pagos={payload.pagos} resumen={payload.resumen} minimalista={minimalista} />

      {payload.nota ? (
        <p className={cn("mt-1 text-[0.82em]", minimalista ? "text-left" : "text-center")}>{payload.nota}</p>
      ) : null}

      {payload.pie ? (
        <>
          <Separador />
          <p className={cn("text-[0.85em] whitespace-pre-line", minimalista ? "text-left" : "text-center")}>
            {payload.pie}
          </p>
        </>
      ) : null}

      {estrecho ? <div className="mt-1 text-center text-[0.78em]">***</div> : null}
    </div>
  );
}
