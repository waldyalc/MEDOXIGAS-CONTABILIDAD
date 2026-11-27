import type { CSSProperties } from "react";

import { cn } from "cn";

import { BloqueFiscalEcf } from "@/components/documento-venta/bloque-fiscal-ecf";
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

const TIPOGRAFIA_TICKET = {
  fontFamily: 'Arial, "Liberation Sans", sans-serif',
  fontSize: "9pt",
  lineHeight: "13.5pt",
} as const;

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
    padding: 5.6mm 5mm;
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
  [data-print-root] .ticket-pos .bloque-ecf,
  [data-print-root] .ticket-pos tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  [data-print-root] .no-imprimir,
  .no-imprimir { display: none !important; }
}
`;

function Separador() {
  return <hr className="my-2 border-0 border-t border-black" />;
}

function Logo({ url, nombre, estrecho }: { url: string | null; nombre: string; estrecho: boolean }) {
  if (!url) return null;
  return (
    // biome-ignore lint/performance/noImgElement: logo configurable de la empresa en el ticket
    <img
      src={url}
      alt={nombre}
      className={cn(
        "mx-auto mb-1 object-contain grayscale",
        estrecho ? "h-[11mm] max-w-full" : "h-[20.9mm] w-[69.8mm]",
      )}
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
    return (
      <p className={cn((texto.startsWith("NCF ") || texto === "Sin valor fiscal") && "font-bold", className)}>
        {texto}
      </p>
    );
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
          className={cn("min-w-0 break-words text-[7.29pt]", minimalista && "font-bold tracking-[0.08em] uppercase")}
        >
          {linea.descripcion}
        </span>
        {apilada ? null : <span className="ml-auto shrink-0 text-[7.29pt] tabular-nums">{linea.total}</span>}
      </div>
      {linea.detalle ? (
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("min-w-0 text-[6.55pt]", minimalista && "tracking-[0.06em] uppercase")}>
            <strong>{linea.detalle.split(" ", 1)[0]}</strong>
            {linea.detalle.slice(linea.detalle.indexOf(" ") < 0 ? linea.detalle.length : linea.detalle.indexOf(" "))}
          </span>
          {apilada ? <span className="shrink-0 text-[7.29pt] tabular-nums">{linea.total}</span> : null}
        </div>
      ) : null}
      {apilada && !linea.detalle ? <div className="text-right text-[7.29pt] tabular-nums">{linea.total}</div> : null}
      {linea.referencia ? <span className="text-[6.55pt]">Ref. {linea.referencia}</span> : null}
      {detallado && linea.descuento ? (
        <div className="flex items-baseline justify-between gap-2 text-[6.55pt]">
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
    <section className={cn("flex flex-col", minimalista ? "items-start text-left" : "items-center text-center")}>
      {cliente.nombre ? <p className="text-[13.5pt] leading-[18pt] font-bold">Cliente: {cliente.nombre}</p> : null}
      {cliente.lineas.map((linea) => (
        <LineaDato key={linea} texto={linea} />
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
      <div className="flex items-baseline justify-between gap-2 text-[8.1pt] font-bold">
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
          <p className={cn("text-[9pt] font-bold", minimalista && "uppercase")}>{bloque.titulo}</p>
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
            <span className={cn("min-w-0 break-words text-right font-bold", fuerte && "text-[13.5pt]")}>
              {fila.etiqueta ? `${fila.etiqueta}:` : ""}
            </span>
            <span className={cn("text-right tabular-nums", fuerte && "text-[13.5pt] font-bold")}>{fila.valor}</span>
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
    <section className="mt-1.5 flex flex-col">
      {filas.map((fila) => (
        <LineaDato key={`${fila.etiqueta}-${fila.valor}`} texto={`${fila.etiqueta}: ${fila.valor}`} />
      ))}
    </section>
  );
}

function BloqueEcfTicket({ ecf, estrecho }: { ecf: TicketPOSPayload["ecf"]; estrecho: boolean }) {
  if (!ecf) return null;
  return (
    <BloqueFiscalEcf
      codigoSeguridad={ecf.codigoSeguridad}
      compacto
      fechaHoraFirma={ecf.fechaHoraFirma}
      tamanoQrMm={estrecho ? 36 : 46}
      urlQr={ecf.urlQr}
    />
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
    padding: "5.6mm 5mm",
    ...TIPOGRAFIA_TICKET,
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

      <header className={cn("flex flex-col", alineacion)}>
        {diseno.mostrar_logo ? <Logo url={diseno.logo_url} nombre={nombreEmpresa} estrecho={estrecho} /> : null}
        {encabezado.empresa.map((linea, indice) =>
          indice === 0 ? (
            <p key={linea} className="text-[13.5pt] leading-[18pt] font-bold">
              {linea}
            </p>
          ) : (
            <LineaDato key={linea} texto={linea} />
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

      <div className={cn("flex flex-col", alineacion)}>
        <p className={cn("font-bold", minimalista && "tracking-[0.08em] uppercase")}>{encabezado.titulo}</p>
        {encabezado.anulada ? <p className="text-[13.5pt] font-bold tracking-widest">ANULADA</p> : null}
        {encabezado.lineas.map((linea) => (
          <LineaDato key={linea} texto={linea} />
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

      <BloqueEcfTicket ecf={payload.ecf} estrecho={estrecho} />

      {payload.nota ? (
        <p className={cn("mt-1 text-[9pt]", minimalista ? "text-left" : "text-center")}>{payload.nota}</p>
      ) : null}

      {payload.pie ? (
        <p className={cn("mt-4 whitespace-pre-line", minimalista ? "text-left" : "text-center")}>{payload.pie}</p>
      ) : null}

      {estrecho ? <div className="mt-1 text-center text-[6.55pt]">***</div> : null}
    </div>
  );
}
