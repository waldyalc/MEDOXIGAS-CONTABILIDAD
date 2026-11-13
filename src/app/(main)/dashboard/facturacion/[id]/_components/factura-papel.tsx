import { Enlace } from "@/components/enlace";
import { rutaContacto, rutaProducto } from "@/lib/enlaces";
import { tituloTipoComprobante } from "@/lib/facturacion/comprobantes";
import { formatoCantidad, saldoDeFactura } from "@/lib/facturacion/formato";
import { montoEnLetras } from "@/lib/facturacion/numero-a-letras";
import type { ContactoResumen, Empresa, FacturaDetalle, FacturaLinea } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";

const dineroRD = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const precioRD = new Intl.NumberFormat("es-DO", {
  maximumFractionDigits: 2,
});

function montoRD(valor: number): string {
  return `RD$${dineroRD.format(valor)}`;
}

function precio(valor: number): string {
  return `RD$${precioRD.format(valor)}`;
}

interface Props {
  empresa: Empresa | null;
  factura: FacturaDetalle;
  lineas: FacturaLinea[];
  contacto: ContactoResumen;
  ncfVence: string | null;
  enlaces?: boolean;
}

function DatosEmpresa({
  empresa,
  factura,
  nombreEmpresa,
  logo,
}: {
  empresa: Empresa | null;
  factura: FacturaDetalle;
  nombreEmpresa: string;
  logo: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {/* biome-ignore lint/performance/noImgElement: logo configurable de la empresa */}
      <img src={logo} alt={nombreEmpresa} className="mb-1 h-16 w-auto object-contain" />
      <p className="text-base font-semibold">{nombreEmpresa}</p>
      {empresa?.rnc?.trim() ? <p>RNC: {empresa.rnc}</p> : null}
      {empresa?.direccion?.trim() ? <p>{empresa.direccion}</p> : null}
      {empresa?.correo?.trim() ? <p>{empresa.correo}</p> : null}
      {empresa?.telefono?.trim() ? <p>Teléfono: {empresa.telefono}</p> : null}
      <p>Fecha de creación: {formatoDia(factura.fecha)}</p>
      <p>Vencimiento de la factura {formatoDia(factura.vencimiento)}</p>
    </div>
  );
}

function LineaPapel({ linea, enlaces }: { linea: FacturaLinea; enlaces: boolean }) {
  const descuento = (linea.cantidad * linea.precio * linea.descuento_pct) / 100;

  return (
    <tr className="border-b border-[#e2e5ea] align-top">
      <td className="px-2 py-1.5 tabular-nums">{formatoCantidad(linea.cantidad)}</td>
      <td className="px-2 py-1.5 font-medium">
        {enlaces && linea.producto_id ? (
          <Enlace href={rutaProducto(linea.producto_id)}>{linea.descripcion}</Enlace>
        ) : (
          linea.descripcion
        )}
      </td>
      <td className="px-2 py-1.5">Unidad</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{precio(linea.precio)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{linea.descuento_pct > 0 ? montoRD(descuento) : ""}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{montoRD(linea.itbis)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{montoRD(linea.subtotal)}</td>
    </tr>
  );
}

function ResumenTotales({
  factura,
  montoGravado,
  totalItems,
  etiquetaItbis,
}: {
  factura: FacturaDetalle;
  montoGravado: number;
  totalItems: number;
  etiquetaItbis: string;
}) {
  return (
    <div className="mt-6 flex justify-end">
      <div className="w-full sm:w-[48%]">
        <div className="flex justify-between">
          <span>SUBTOTAL</span>
          <span className="tabular-nums">{montoRD(factura.subtotal)}</span>
        </div>
        {factura.descuento > 0 ? (
          <div className="flex justify-between">
            <span>DESCUENTO</span>
            <span className="tabular-nums">{montoRD(factura.descuento)}</span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span>MONTO GRAVADO</span>
          <span className="tabular-nums">{montoRD(montoGravado)}</span>
        </div>
        <div className="flex justify-between">
          <span>{etiquetaItbis}</span>
          <span className="tabular-nums">{montoRD(factura.itbis)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-[#c9d0da] pt-1 font-bold">
          <span>Total</span>
          <span className="tabular-nums">{montoRD(factura.total)}</span>
        </div>
        <p className="mt-1 text-right font-semibold">Total de items: {formatoCantidad(totalItems)}</p>
      </div>
    </div>
  );
}

function NotasFactura({ factura }: { factura: FacturaDetalle }) {
  if (!factura.notas?.trim() && !factura.terminos?.trim() && !factura.pie?.trim()) return null;

  return (
    <div className="mt-6 flex flex-col gap-2">
      {factura.notas?.trim() ? (
        <div>
          <p className="font-semibold">Notas</p>
          <p className="whitespace-pre-line">{factura.notas}</p>
        </div>
      ) : null}
      {factura.terminos?.trim() ? (
        <div>
          <p className="font-semibold">Términos</p>
          <p className="whitespace-pre-line">{factura.terminos}</p>
        </div>
      ) : null}
      {factura.pie?.trim() ? <p className="whitespace-pre-line">{factura.pie}</p> : null}
    </div>
  );
}

export function FacturaPapel({ empresa, factura, lineas, contacto, ncfVence, enlaces = false }: Props) {
  const esCredito = factura.tipo_comprobante === "01";
  const titulo = tituloTipoComprobante(factura.tipo_comprobante);
  const saldo = saldoDeFactura(factura.total, factura.pagado, factura.credito, factura.retenido);
  const nombreEmpresa = empresa?.nombre?.trim() || "MEDOXIGAS ALC, SRL";
  const logo = empresa?.logo_url?.trim() || "/marca/logo-medoxigas.png";
  const montoGravado = lineas.reduce((suma, linea) => (linea.itbis_tasa > 0 ? suma + linea.subtotal : suma), 0);
  const totalItems = lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  const tasas = [...new Set(lineas.map((linea) => linea.itbis_tasa))];
  const tasaUnica = tasas.length === 1 ? tasas[0] : null;
  const etiquetaItbis = tasaUnica == null ? "ITBIS" : `ITBIS (${tasaUnica.toFixed(2)}%)`;

  return (
    <article className="flex min-h-[11in] w-full flex-col bg-white p-[12mm] text-[13px] leading-snug text-[#0a2352] print:min-h-0 print:p-0">
      <header className="flex flex-col items-start gap-6 sm:flex-row sm:justify-between sm:gap-8">
        <DatosEmpresa empresa={empresa} factura={factura} nombreEmpresa={nombreEmpresa} logo={logo} />

        <div className="shrink-0 sm:text-right">
          <p className="font-medium">{titulo}</p>
          <p className="mt-1 text-lg font-bold">NCF {factura.ncf ?? "—"}</p>
          <p>Vencimiento NCF: {ncfVence ? formatoDia(ncfVence) : ""}</p>
          {factura.estado === "anulada" ? <p className="mt-1 font-bold text-red-600">ANULADA</p> : null}
        </div>
      </header>

      <section className="mt-4 grid grid-cols-1 gap-2 border border-[#d7dce3] bg-[#f4f5f7] px-3 py-2 sm:grid-cols-2 sm:gap-4">
        <div className="flex flex-col gap-0.5">
          <p>
            <span className="font-semibold">Cliente:</span>{" "}
            {enlaces ? <Enlace href={rutaContacto(contacto.id)}>{contacto.nombre}</Enlace> : contacto.nombre}
          </p>
          <p>
            <span className="font-semibold">RNC:</span> {contacto.rnc_cedula ?? ""}
          </p>
          <p>
            <span className="font-semibold">Teléfono:</span> {contacto.telefono ?? ""}
          </p>
        </div>
        {esCredito ? (
          <div className="flex flex-col gap-0.5 sm:items-end sm:text-right">
            <p>Moneda: DOP</p>
            <p>Valor restante por pagar: {montoRD(saldo)}</p>
          </div>
        ) : null}
      </section>

      <table className="mt-3 w-full table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[10%]" />
          <col />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
        </colgroup>
        <thead>
          <tr className="bg-[#f4f5f7]">
            <th className="px-2 py-1.5 font-semibold">Cantidad</th>
            <th className="px-2 py-1.5 font-semibold">Descripción</th>
            <th className="px-2 py-1.5 font-semibold">Unidad</th>
            <th className="px-2 py-1.5 text-right font-semibold">Precio</th>
            <th className="px-2 py-1.5 text-right font-semibold">Descuento</th>
            <th className="px-2 py-1.5 text-right font-semibold">Impuesto</th>
            <th className="px-2 py-1.5 text-right font-semibold">Valor</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((linea) => (
            <LineaPapel key={linea.id} linea={linea} enlaces={enlaces} />
          ))}
        </tbody>
      </table>

      <p className="mt-1 font-semibold">Total de líneas: {lineas.length}</p>
      <p className="mt-1 bg-[#f4f5f7] px-2 py-1 font-semibold">{montoEnLetras(factura.total)}</p>

      <div className="flex-1" />

      <ResumenTotales
        factura={factura}
        montoGravado={montoGravado}
        totalItems={totalItems}
        etiquetaItbis={etiquetaItbis}
      />

      <NotasFactura factura={factura} />

      <footer className="mt-4 flex items-center justify-between border-t border-[#e2e5ea] pt-2">
        <p>Original: Cliente</p>
        <p>Página 1 de 1</p>
      </footer>
    </article>
  );
}
