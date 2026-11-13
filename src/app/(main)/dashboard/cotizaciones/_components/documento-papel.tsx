import { Enlace } from "@/components/enlace";
import type { DocumentoDetalle, DocumentoLinea, DocumentoVista, TipoDocumento } from "@/lib/cotizaciones/tipos";
import { rutaContacto, rutaProducto } from "@/lib/enlaces";
import { formatoCantidad } from "@/lib/facturacion/formato";
import { montoEnLetras } from "@/lib/facturacion/numero-a-letras";
import type { ContactoResumen, Empresa } from "@/lib/facturacion/tipos";
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

function descuentoLinea(linea: DocumentoLinea): number {
  return (linea.cantidad * linea.precio * linea.descuento_pct) / 100;
}

function tasaItbis(lineas: DocumentoLinea[]): string {
  const tasas = [...new Set(lineas.map((linea) => linea.itbis_tasa))];
  const unica = tasas.length === 1 ? tasas[0] : null;
  return unica == null ? "ITBIS" : `ITBIS (${unica.toFixed(2)}%)`;
}

function EmpresaCotizacion({
  empresa,
  nombre,
  logo,
  mostrarLogo,
}: {
  empresa: Empresa | null;
  nombre: string;
  logo: string;
  mostrarLogo: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {mostrarLogo ? (
        // biome-ignore lint/performance/noImgElement: logo configurable de la empresa
        <img src={logo} alt={nombre} className="mb-1 h-16 w-auto object-contain" />
      ) : null}
      <p className="text-base font-semibold">{nombre}</p>
      {empresa?.rnc?.trim() ? <p>RNC: {empresa.rnc}</p> : null}
      {empresa?.direccion?.trim() ? <p>{empresa.direccion}</p> : null}
    </div>
  );
}

function ClienteDocumento({
  contacto,
  enlaces,
  conTelefono,
}: {
  contacto: ContactoResumen;
  enlaces: boolean;
  conTelefono: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p>
        <span className="font-semibold">Cliente:</span>{" "}
        {enlaces ? <Enlace href={rutaContacto(contacto.id)}>{contacto.nombre}</Enlace> : contacto.nombre}
      </p>
      <p>
        <span className="font-semibold">RNC:</span> {contacto.rnc_cedula ?? ""}
      </p>
      {conTelefono ? (
        <p>
          <span className="font-semibold">Teléfono:</span> {contacto.telefono ?? ""}
        </p>
      ) : null}
    </div>
  );
}

function TotalesDocumento({ documento, lineas }: { documento: DocumentoDetalle; lineas: DocumentoLinea[] }) {
  return (
    <div className="mt-4 flex justify-end">
      <div className="w-full sm:w-[45%]">
        <div className="flex justify-between">
          <span>SUBTOTAL</span>
          <span className="tabular-nums">{montoRD(documento.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>{tasaItbis(lineas)}</span>
          <span className="tabular-nums">{montoRD(documento.itbis)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-[#c9d0da] pt-1 font-bold">
          <span>Total</span>
          <span className="tabular-nums">{montoRD(documento.total)}</span>
        </div>
      </div>
    </div>
  );
}

function NotasDocumento({ documento }: { documento: DocumentoDetalle }) {
  if (!documento.notas?.trim()) return null;
  return (
    <div className="mt-4">
      <p className="font-semibold">Notas</p>
      <p className="whitespace-pre-line">{documento.notas}</p>
    </div>
  );
}

function CeldaDescripcion({ linea, enlaces }: { linea: DocumentoLinea; enlaces: boolean }) {
  if (enlaces && linea.producto_id) {
    return <Enlace href={rutaProducto(linea.producto_id)}>{linea.descripcion}</Enlace>;
  }
  return <>{linea.descripcion}</>;
}

function PapelCotizacion({
  vista,
  enlaces,
  nombreEmpresa,
  logo,
  mostrarLogo,
}: {
  vista: DocumentoVista;
  enlaces: boolean;
  nombreEmpresa: string;
  logo: string;
  mostrarLogo: boolean;
}) {
  const { documento, lineas, contacto, empresa } = vista;

  return (
    <article className="flex min-h-[11in] w-full flex-col bg-white p-[12mm] text-[13px] leading-snug text-[#0a2352] print:min-h-0 print:p-0">
      <header className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:gap-8">
        <EmpresaCotizacion empresa={empresa} nombre={nombreEmpresa} logo={logo} mostrarLogo={mostrarLogo} />
        <div className="shrink-0 text-left sm:text-right">
          {empresa?.correo?.trim() ? <p>{empresa.correo}</p> : null}
          {empresa?.telefono?.trim() ? <p>{empresa.telefono}</p> : null}
        </div>
      </header>

      <section className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <ClienteDocumento contacto={contacto} enlaces={enlaces} conTelefono />
        <div className="shrink-0 sm:text-right">
          <p className="text-base font-bold">Cotización No. {documento.numero}</p>
          <p>Fecha de creación: {formatoDia(documento.fecha)}</p>
          <p>Fecha de vencimiento: {formatoDia(documento.vencimiento)}</p>
          {documento.estado === "anulada" ? <p className="mt-1 font-bold text-red-600">ANULADA</p> : null}
        </div>
      </section>

      <table className="mt-5 w-full table-fixed border-collapse text-left">
        <colgroup>
          <col />
          <col className="w-[13%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[13%]" />
        </colgroup>
        <thead>
          <tr className="bg-[#f4f5f7]">
            <th className="px-2 py-1.5 font-semibold">Concepto</th>
            <th className="px-2 py-1.5 text-right font-semibold">Precio</th>
            <th className="px-2 py-1.5 font-semibold">Unidad</th>
            <th className="px-2 py-1.5 text-right font-semibold">Cantidad</th>
            <th className="px-2 py-1.5 text-right font-semibold">Descuento</th>
            <th className="px-2 py-1.5 text-right font-semibold">Impuesto</th>
            <th className="px-2 py-1.5 text-right font-semibold">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((linea) => (
            <tr key={linea.id} className="border-b border-[#e2e5ea] align-top">
              <td className="px-2 py-1.5 font-medium">
                <CeldaDescripcion linea={linea} enlaces={enlaces} />
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{precio(linea.precio)}</td>
              <td className="px-2 py-1.5">Unidad</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatoCantidad(linea.cantidad)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {linea.descuento_pct > 0 ? montoRD(descuentoLinea(linea)) : ""}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{montoRD(linea.itbis)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{montoRD(linea.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-2 bg-[#f4f5f7] px-2 py-1 font-semibold">{montoEnLetras(documento.total)}</p>

      <div className="flex-1" />

      <TotalesDocumento documento={documento} lineas={lineas} />
      <NotasDocumento documento={documento} />

      <footer className="mt-4 flex items-center justify-between border-t border-[#e2e5ea] pt-2">
        <p>Original: Cliente</p>
        <p>Página 1 de 1</p>
      </footer>
    </article>
  );
}

function PapelConduce({
  vista,
  enlaces,
  nombreEmpresa,
  logo,
  mostrarLogo,
}: {
  vista: DocumentoVista;
  enlaces: boolean;
  nombreEmpresa: string;
  logo: string;
  mostrarLogo: boolean;
}) {
  const { documento, lineas, contacto, empresa } = vista;

  return (
    <article className="flex min-h-[11in] w-full flex-col bg-white p-[12mm] text-[13px] leading-snug text-[#0a2352] print:min-h-0 print:p-0">
      <header className="grid grid-cols-[auto_1fr_auto] items-start gap-6">
        {mostrarLogo ? (
          // biome-ignore lint/performance/noImgElement: logo configurable de la empresa
          <img src={logo} alt={nombreEmpresa} className="h-16 w-auto object-contain" />
        ) : null}
        <div className="text-center">
          <p className="text-base font-semibold">{nombreEmpresa}</p>
          {empresa?.rnc?.trim() ? <p>RNC: {empresa.rnc}</p> : null}
          {empresa?.direccion?.trim() ? <p>{empresa.direccion}</p> : null}
          {empresa?.telefono?.trim() ? <p>Tel.: {empresa.telefono}</p> : null}
          {empresa?.correo?.trim() ? <p>{empresa.correo}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-base font-bold">Conduce No. {documento.numero}</p>
          {documento.estado === "anulada" ? <p className="mt-1 font-bold text-red-600">ANULADO</p> : null}
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 border border-[#d7dce3] bg-[#f4f5f7] px-3 py-2 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <p>
            <span className="font-semibold">Señor(es):</span>{" "}
            {enlaces ? <Enlace href={rutaContacto(contacto.id)}>{contacto.nombre}</Enlace> : contacto.nombre}
          </p>
          <p>
            <span className="font-semibold">RNC:</span> {contacto.rnc_cedula ?? ""}
          </p>
          <p>
            <span className="font-semibold">Dirección:</span> {contacto.direccion ?? ""}
          </p>
          <p>
            <span className="font-semibold">Teléfono:</span> {contacto.telefono ?? ""}
          </p>
        </div>
        <div className="flex flex-col gap-0.5 sm:items-end sm:text-right">
          <p>Fecha de creación: {formatoDia(documento.fecha)}</p>
          <p>Fecha de vencimiento: {formatoDia(documento.vencimiento)}</p>
        </div>
      </section>

      <table className="mt-3 w-full table-fixed border-collapse text-left">
        <colgroup>
          <col />
          <col className="w-[13%]" />
          <col className="w-[11%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead>
          <tr className="bg-[#f4f5f7]">
            <th className="px-2 py-1.5 font-semibold">Ítem</th>
            <th className="px-2 py-1.5 text-right font-semibold">Precio</th>
            <th className="px-2 py-1.5 text-right font-semibold">Cantidad</th>
            <th className="px-2 py-1.5 text-right font-semibold">Descuento</th>
            <th className="px-2 py-1.5 text-right font-semibold">Impuesto</th>
            <th className="px-2 py-1.5 text-right font-semibold">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((linea) => (
            <tr key={linea.id} className="border-b border-[#e2e5ea] align-top">
              <td className="px-2 py-1.5 font-medium">
                <CeldaDescripcion linea={linea} enlaces={enlaces} />
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{precio(linea.precio)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatoCantidad(linea.cantidad)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {linea.descuento_pct > 0 ? montoRD(descuentoLinea(linea)) : ""}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{montoRD(linea.itbis)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{montoRD(linea.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex-1" />

      <TotalesDocumento documento={documento} lineas={lineas} />
      <NotasDocumento documento={documento} />

      <footer className="mt-12 grid grid-cols-2 gap-10 text-center text-xs">
        <div className="border-t border-[#0a2352] pt-2">ELABORADO POR</div>
        <div className="border-t border-[#0a2352] pt-2">RECIBIDO CONFORME (FIRMA Y FECHA)</div>
      </footer>
    </article>
  );
}

interface Props {
  tipo: TipoDocumento;
  vista: DocumentoVista;
  enlaces?: boolean;
  mostrarLogo?: boolean;
}

export function DocumentoPapel({ tipo, vista, enlaces = false, mostrarLogo = true }: Props) {
  const nombreEmpresa = vista.empresa?.nombre?.trim() || "MEDOXIGAS ALC, SRL";
  const logo = vista.empresa?.logo_url?.trim() || "/marca/logo-medoxigas.png";

  if (tipo === "remision")
    return (
      <PapelConduce
        vista={vista}
        enlaces={enlaces}
        nombreEmpresa={nombreEmpresa}
        logo={logo}
        mostrarLogo={mostrarLogo}
      />
    );
  return (
    <PapelCotizacion
      vista={vista}
      enlaces={enlaces}
      nombreEmpresa={nombreEmpresa}
      logo={logo}
      mostrarLogo={mostrarLogo}
    />
  );
}
