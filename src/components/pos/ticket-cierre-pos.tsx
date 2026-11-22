import type { PresentacionCierre } from "@/lib/pos/impresion-cierre";

export function TicketCierrePos({ datos }: { datos: PresentacionCierre }) {
  function fila(etiqueta: string, monto: string, fuerte = false) {
    return (
      <div className={`cierre-fila${fuerte ? " cierre-fuerte" : ""}`}>
        <span>{etiqueta}</span>
        <span>{monto}</span>
      </div>
    );
  }

  return (
    <article className="cierre-papel">
      <style>{`
        @page { size: 57mm 250mm; margin: 0; }
        .cierre-papel { box-sizing: border-box; width: 57mm; padding: 26.25pt 15.75pt 0; color: #000; background: #fff; font-family: Arial, "Liberation Sans", sans-serif; font-size: 7.5pt; line-height: 11.25pt; }
        .cierre-titulo { margin: 0 0 21pt; font-size: 17.25pt; font-weight: 700; line-height: 22.5pt; white-space: nowrap; }
        .cierre-fecha { display: flex; align-items: center; margin-bottom: 9.75pt; }
        .cierre-fila { display: flex; align-items: center; justify-content: space-between; gap: 2pt; min-height: 22.5pt; }
        .cierre-fila > span:last-child { flex-shrink: 0; white-space: nowrap; }
        .cierre-fuerte { font-weight: 700; }
        .cierre-papel > .cierre-fila:not(.cierre-fuerte):not(.cierre-contado):not(.cierre-observaciones) { box-shadow: inset 0 -.5pt #999; }
        .cierre-ventas { border-bottom: .5pt solid #ddd; padding-bottom: 4.5pt; margin-bottom: 4.5pt; }
        .cierre-contado { font-size: 9pt; line-height: 13.5pt; min-height: 48pt; }
        .cierre-observaciones { align-items: flex-start; padding-top: 5.25pt; }
        .cierre-observaciones > span:last-child { flex-shrink: 1; white-space: pre-wrap; overflow-wrap: anywhere; text-align: right; max-width: 65pt; }
        @media print {
          html:has(.cierre-papel), body:has(.cierre-papel) { margin: 0 !important; padding: 0 !important; }
          [data-print-root]:has(.cierre-papel) { width: 57mm !important; }
          .cierre-papel { break-inside: avoid; }
        }
      `}</style>
      <h1 className="cierre-titulo">Cierre No {datos.numero}</h1>
      <div className="cierre-fecha">
        <span>Fecha</span>
        <span>
          {datos.inicio} -<br />
          {datos.fin}
        </span>
      </div>
      <div className="cierre-ventas">{fila("Total de ventas", datos.ventas, true)}</div>
      {fila("Base inicial", datos.base)}
      {fila("Ventas en efectivo", datos.efectivo)}
      {datos.tarjetas ? (
        <>
          {fila("Ventas por tarjeta de débito", datos.tarjetas.debito)}
          {fila("Ventas por tarjeta de crédito", datos.tarjetas.credito)}
        </>
      ) : (
        fila("Ventas con tarjeta", datos.tarjeta)
      )}
      {fila("Ventas por transferencias", datos.transferencias)}
      {fila("Devolución de dinero", datos.devoluciones)}
      {fila("Retiros en efectivo", datos.retiros)}
      {fila("Total de movimientos", datos.movimientos, true)}
      <div className="cierre-fila cierre-contado">
        <span>
          Dinero en efectivo
          <br />
          del cierre
        </span>
        <span>{datos.contado}</span>
      </div>
      <div className="cierre-fila cierre-observaciones">
        <span>Observaciones:</span>
        <span>{datos.observaciones}</span>
      </div>
    </article>
  );
}
