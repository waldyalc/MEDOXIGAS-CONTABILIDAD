import { cn } from "cn";

import type { TicketPOSPayload } from "@/lib/pos/impresion";
import type { AnchoTicket, FuenteTicket, InterlineadoTicket, TamanoLetraTicket } from "@/lib/pos/tipos";

/**
 * Ticket térmico presentacional para la vista previa de Configuración → Punto
 * de venta. Pinta el `TicketPOSPayload` que arma `@/lib/pos/impresion` con la
 * `plantilla_ticket` elegida; no consulta, no guarda y no navega.
 *
 * El mismo payload se usa en el portal de impresión de prueba, así que lo que
 * se ve aquí es exactamente lo que se imprimiría con esa plantilla. El ticket
 * impreso es siempre blanco y negro: no usa tokens del tema.
 */

const FAMILIAS: Record<FuenteTicket, string> = {
  clasica: 'ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif',
  moderna: '"Geist", "Inter", ui-sans-serif, system-ui, sans-serif',
  compacta: 'ui-sans-serif, system-ui, "Arial Narrow", sans-serif',
};

const TAMANOS: Record<AnchoTicket, Record<TamanoLetraTicket, number>> = {
  80: { pequena: 9, mediana: 9.5, grande: 10 },
  57: { pequena: 7, mediana: 7.5, grande: 8 },
};

const INTERLINEADOS: Record<InterlineadoTicket, number> = {
  compacto: 1.15,
  normal: 1.3,
  amplio: 1.45,
};

export function TicketPosVista({
  payload,
  className,
}: {
  readonly payload: TicketPOSPayload;
  readonly className?: string;
}) {
  const { diseno, encabezado, lineas, bloques, totales, pagos, nota, pie } = payload;
  const minimalista = diseno.estilo === "minimalista";
  const detallado = diseno.estilo === "detallado";
  const angosto = diseno.ancho_mm === 57;

  return (
    <article
      className={cn("ticket-pos bg-white text-black", angosto ? "ticket-pos-57" : "ticket-pos-80", className)}
      style={{
        width: `${diseno.ancho_mm}mm`,
        padding: "3mm",
        fontFamily: FAMILIAS[diseno.fuente],
        fontSize: `${TAMANOS[diseno.ancho_mm][diseno.tamano_letra]}pt`,
        lineHeight: INTERLINEADOS[diseno.interlineado],
        ...(diseno.fuente === "compacta" ? { letterSpacing: "-0.01em" } : {}),
      }}
    >
      <header
        className={cn("flex flex-col gap-0.5", minimalista ? "items-start text-left" : "items-center text-center")}
      >
        {diseno.mostrar_logo && diseno.logo_url ? (
          <img
            src={diseno.logo_url}
            alt=""
            className={cn("mb-1 w-auto object-contain grayscale", angosto ? "max-h-[14mm]" : "max-h-[18mm]")}
          />
        ) : null}

        {encabezado.empresa.map((linea, indice) => (
          <p key={linea} className={cn(indice === 0 && "font-semibold")}>
            {linea}
          </p>
        ))}

        <p className={cn("mt-1 font-semibold", minimalista && "uppercase tracking-[0.08em]")}>{encabezado.titulo}</p>

        {encabezado.anulada ? <p className="font-bold tracking-[0.2em] uppercase">Anulada</p> : null}

        {encabezado.lineas.map((linea) => (
          <p key={linea}>{linea}</p>
        ))}
      </header>

      {lineas.length > 0 ? (
        <>
          <Separador minimalista={minimalista} />
          <section className="flex flex-col">
            {lineas.map((linea, indice) => (
              <div key={`${indice}-${linea.descripcion}`} className="linea flex flex-col gap-0.5 py-0.5">
                <p className={cn("break-words", detallado && "font-medium")}>{linea.descripcion}</p>
                {linea.referencia ? <p className="text-[0.85em]">Ref. {linea.referencia}</p> : null}
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn("min-w-0 break-words", minimalista && "tracking-[0.06em] uppercase")}>
                    {linea.detalle}
                  </p>
                  <p className="shrink-0 tabular-nums">{linea.total}</p>
                </div>
                {linea.descuento ? (
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn(minimalista && "tracking-[0.06em] uppercase")}>Descuento</p>
                    <p className="shrink-0 tabular-nums">{linea.descuento}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </section>
        </>
      ) : null}

      {bloques.map((bloque) => (
        <section key={bloque.titulo} className="mt-2 flex flex-col gap-0.5">
          <p className={cn("font-semibold", minimalista && "tracking-[0.08em] uppercase")}>{bloque.titulo}</p>
          {bloque.filas.map((fila) => (
            <div key={`${bloque.titulo}-${fila.etiqueta}`} className="flex items-baseline justify-between gap-2">
              <p className={cn("min-w-0 break-words", minimalista && "tracking-[0.06em] uppercase")}>{fila.etiqueta}</p>
              <p className="shrink-0 tabular-nums">{fila.valor}</p>
            </div>
          ))}
        </section>
      ))}

      {pagos.length > 0 ? (
        <>
          <Separador minimalista={minimalista} />
          <section className="bloque-pago flex flex-col gap-0.5">
            <p className={cn("font-semibold", minimalista && "tracking-[0.08em] uppercase")}>Pagos</p>
            {pagos.map((fila) => (
              <div key={`pago-${fila.etiqueta}`} className="flex items-baseline justify-between gap-2">
                <p className={cn(minimalista && "tracking-[0.06em] uppercase")}>{fila.etiqueta}</p>
                <p className="shrink-0 tabular-nums">{fila.valor}</p>
              </div>
            ))}
          </section>
        </>
      ) : null}

      <Separador minimalista={minimalista} solido />

      <section
        className={cn("bloque-totales flex flex-col gap-0.5", !minimalista && "border border-black/60 px-1.5 py-1")}
      >
        {totales.map((fila) => {
          const esTotal = fila.etiqueta.startsWith("Total");
          return (
            <div key={`total-${fila.etiqueta}`} className="flex items-baseline justify-between gap-2">
              <p
                className={cn(
                  "min-w-0 break-words",
                  esTotal ? "font-semibold" : minimalista && "tracking-[0.06em] uppercase",
                )}
              >
                {fila.etiqueta}
              </p>
              <p className={cn("shrink-0 tabular-nums", esTotal ? "text-[1.15em] font-semibold" : "")}>{fila.valor}</p>
            </div>
          );
        })}
      </section>

      {nota ? <p className="mt-1 text-[0.9em]">{nota}</p> : null}

      {pie ? (
        <p className={cn("mt-2 whitespace-pre-line break-words", minimalista ? "text-left" : "text-center")}>{pie}</p>
      ) : null}
    </article>
  );
}

function Separador({ minimalista, solido = false }: { readonly minimalista: boolean; readonly solido?: boolean }) {
  return (
    <hr className={cn("my-2 border-t border-black/50", solido || minimalista ? "border-solid" : "border-dashed")} />
  );
}
