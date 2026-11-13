import { formatoCantidad, formatoMoneda, saldoDeFactura } from "@/lib/facturacion/formato";
import type { ContactoResumen, Empresa, FacturaDetalle, FacturaLinea } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";

interface Props {
  empresa: Empresa | null;
  factura: FacturaDetalle;
  lineas: FacturaLinea[];
  contacto: ContactoResumen;
}

export function FacturaPapel({ empresa, factura, lineas, contacto }: Props) {
  const titulo = factura.tipo_comprobante === "01" ? "FACTURA DE CRÉDITO FISCAL" : "FACTURA DE CONSUMO";
  const saldo = saldoDeFactura(factura.total, factura.pagado);

  return (
    <div className="flex flex-col gap-6 bg-white p-6 text-zinc-900 sm:p-10">
      <div className="flex flex-col justify-between gap-6 sm:flex-row">
        <div className="flex flex-col gap-1">
          {empresa?.logo_url ? (
            // biome-ignore lint/performance/noImgElement: logo configurable de la empresa
            <img src={empresa.logo_url} alt={empresa.nombre} className="mb-2 h-12 w-auto object-contain" />
          ) : (
            <p className="text-xl font-semibold tracking-tight">{empresa?.nombre ?? "MEDOXIGAS ALC, SRL"}</p>
          )}
          {empresa?.rnc?.trim() ? <p className="text-zinc-600 text-sm">RNC {empresa.rnc}</p> : null}
          {empresa?.direccion?.trim() ? <p className="text-zinc-600 text-sm">{empresa.direccion}</p> : null}
          {empresa?.telefono?.trim() ? <p className="text-zinc-600 text-sm">Tel. {empresa.telefono}</p> : null}
          {empresa?.correo?.trim() ? <p className="text-zinc-600 text-sm">{empresa.correo}</p> : null}
        </div>

        <div className="flex flex-col gap-1 sm:items-end sm:text-right">
          <p className="font-semibold text-sm tracking-wide">{titulo}</p>
          <p className="font-mono text-lg font-semibold">{factura.ncf ?? "NCF pendiente"}</p>
          <p className="text-zinc-600 text-sm">Factura #{factura.numero}</p>
          <p className="text-zinc-600 text-sm">Fecha: {formatoDia(factura.fecha)}</p>
          <p className="text-zinc-600 text-sm">Vence: {formatoDia(factura.vencimiento)}</p>
          {factura.estado === "anulada" ? <p className="mt-1 font-semibold text-red-600 text-sm">ANULADA</p> : null}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4">
        <p className="text-zinc-500 text-xs uppercase">Cliente</p>
        <p className="font-medium">{contacto.nombre}</p>
        {contacto.rnc_cedula?.trim() ? (
          <p className="text-zinc-600 text-sm">RNC/Cédula: {contacto.rnc_cedula}</p>
        ) : null}
        {contacto.direccion?.trim() ? <p className="text-zinc-600 text-sm">{contacto.direccion}</p> : null}
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-zinc-300 border-b">
              <th className="py-2 pr-2 font-medium">Descripción</th>
              <th className="px-2 py-2 text-right font-medium">Cantidad</th>
              <th className="px-2 py-2 text-right font-medium">Precio</th>
              <th className="px-2 py-2 text-right font-medium">Desc. %</th>
              <th className="px-2 py-2 text-right font-medium">ITBIS %</th>
              <th className="py-2 pl-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((linea) => (
              <tr key={linea.id} className="border-zinc-200 border-b align-top">
                <td className="py-2 pr-2">{linea.descripcion}</td>
                <td className="px-2 py-2 text-right">{formatoCantidad(linea.cantidad)}</td>
                <td className="px-2 py-2 text-right">{formatoMoneda(linea.precio)}</td>
                <td className="px-2 py-2 text-right">{formatoCantidad(linea.descuento_pct)} %</td>
                <td className="px-2 py-2 text-right">{formatoCantidad(linea.itbis_tasa)} %</td>
                <td className="py-2 pl-2 text-right">{formatoMoneda(linea.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="flex w-full max-w-xs flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-600">Subtotal</span>
            <span>{formatoMoneda(factura.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Descuento</span>
            <span>{formatoMoneda(factura.descuento)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">ITBIS</span>
            <span>{formatoMoneda(factura.itbis)}</span>
          </div>
          <div className="flex justify-between border-zinc-300 border-t pt-1 font-semibold text-base">
            <span>Total</span>
            <span>{formatoMoneda(factura.total)}</span>
          </div>
          {factura.pagado > 0 ? (
            <>
              <div className="flex justify-between text-zinc-600">
                <span>Pagado</span>
                <span>{formatoMoneda(factura.pagado)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Saldo</span>
                <span>{formatoMoneda(saldo)}</span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {factura.notas ? (
        <div>
          <p className="text-zinc-500 text-xs uppercase">Notas</p>
          <p className="whitespace-pre-line text-sm">{factura.notas}</p>
        </div>
      ) : null}
      {factura.terminos ? (
        <div>
          <p className="text-zinc-500 text-xs uppercase">Términos</p>
          <p className="whitespace-pre-line text-sm">{factura.terminos}</p>
        </div>
      ) : null}
      {factura.pie ? (
        <div className="border-zinc-200 border-t pt-3">
          <p className="whitespace-pre-line text-zinc-600 text-xs">{factura.pie}</p>
        </div>
      ) : null}
    </div>
  );
}
