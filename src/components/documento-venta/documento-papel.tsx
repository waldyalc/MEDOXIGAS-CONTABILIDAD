import { cn } from "cn";

import type { DocumentoVista } from "@/lib/cotizaciones/tipos";
import { TIPOS_ECF } from "@/lib/ecf/tipos";
import { subtotalBruto } from "@/lib/facturacion/calculo";
import { tituloTipoComprobante } from "@/lib/facturacion/comprobantes";
import { esNcfElectronico, tipoEcfDesdeNcf } from "@/lib/facturacion/emision-ecf";
import { formatoCantidad, saldoDeFactura } from "@/lib/facturacion/formato";
import { montoEnLetras } from "@/lib/facturacion/numero-a-letras";
import type { ContactoResumen, Empresa, FacturaDetalle, FacturaLinea } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";
import type { Impuesto } from "@/lib/impuestos/tipos";
import { resumenImpuestos } from "@/lib/impuestos/tipos";

import { BloqueFiscalEcf } from "./bloque-fiscal-ecf";
import { formatearMontoPapel, formatearPrecioPapel, totalItemsPapel } from "./papel";
import { descuentoDeLinea, montoGravadoDeLineas } from "./vista";

interface LineaPapel {
  id: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  descuento_pct: number;
  itbis_tasa: number;
  impuesto_id: string | null;
  subtotal: number;
  itbis: number;
}

interface EmisionEcfPapel {
  codigoSeguridad: string;
  fechaHoraFirma: string | null;
  urlQr: string;
}

/**
 * Retenciones fiscales del comprobante electrónico (TotalITBISRetenido y
 * TotalISRRetencion del XML e-CF). Solo se renderizan cuando el documento
 * las trae; una factura sin este dato imprime exactamente lo mismo de siempre.
 */
export interface RetencionesFiscalesPapel {
  itbisRetenido?: number | null;
  isrRetenido?: number | null;
}

/**
 * Subtotales y totales de impuestos EXACTOS del XML e-CF. La representación
 * impresa es fiel al XML: estos montos se PASAN, nunca se recomputan con la
 * lógica de facturas normales. IndicadorFacturacion: 1 = gravado 18 %,
 * 2 = gravado 16 %, 3 = gravado 0 %, 4 = exento.
 */
export interface MontosFiscalesEcf {
  gravadoTotal?: number | null;
  gravadoI1?: number | null;
  gravadoI2?: number | null;
  gravadoI3?: number | null;
  exento?: number | null;
  itbisTotal?: number | null;
  itbis1?: number | null;
  itbis2?: number | null;
  itbis3?: number | null;
}

interface DatosPapel {
  tipo: "factura" | "cotizacion" | "conduce";
  empresa: Empresa | null;
  contacto: ContactoResumen;
  fecha: string;
  vencimiento: string;
  lineas: LineaPapel[];
  /** Subtotal neto (bruto − descuento), como se guarda en la base. */
  subtotal: number;
  descuento: number;
  itbis: number;
  otrosImpuestos: number;
  propina: number;
  impuestos: Impuesto[];
  total: number;
  notas: string | null;
  terminos: string | null;
  pie: string | null;
  estado: string;
  titulo: string;
  numero: string;
  ncf: string | null;
  ncfVence: string | null;
  saldo: number | null;
  mostrarLogo: boolean;
  emisionEcf: EmisionEcfPapel | null;
  retencionesFiscales: RetencionesFiscalesPapel | null;
  margenFiscalMm: number | null;
  montosFiscalesEcf: MontosFiscalesEcf | null;
  identificadorExtranjeroCliente: string | null;
}

type Props =
  | {
      tipo: "factura";
      empresa: Empresa | null;
      factura: FacturaDetalle;
      lineas: FacturaLinea[];
      contacto: ContactoResumen;
      ncfVence: string | null;
      impuestos: Impuesto[];
      mostrarLogo?: boolean;
      emisionEcf?: EmisionEcfPapel | null;
      retencionesFiscales?: RetencionesFiscalesPapel | null;
      /**
       * Margen izquierdo extra del bloque fiscal e-CF en milímetros. La DGII
       * exige el QR a ≥ 2 cm del borde del papel en la representación impresa;
       * sin el prop el bloque queda exactamente donde siempre (producción).
       */
      margenFiscalMm?: number;
      /** Totales fiscales exactos del XML e-CF; cuando vienen, sustituyen el monto gravado recomputado. */
      montosFiscalesEcf?: MontosFiscalesEcf | null;
      /** Identificador extranjero del comprador (E47 sin RNC); se imprime con su etiqueta fiscal correcta. */
      identificadorExtranjeroCliente?: string | null;
    }
  | { tipo: "cotizacion" | "conduce"; vista: DocumentoVista; mostrarLogo?: boolean };

const CELDA = "px-[5pt] py-[2.5pt] align-top";
const CELDA_TEXTO = `${CELDA} text-[10pt] leading-[12.1pt] font-semibold`;
const CELDA_MONTO = "px-[3pt] py-[2.5pt] align-top whitespace-nowrap tabular-nums";
const CELDA_NUMERO = "px-[3pt] py-[2.5pt] align-top text-right whitespace-nowrap tabular-nums";
const CELDA_ETIQUETA = "border-r border-b border-[#c9d0da] bg-[#eef0f3] px-[4pt] py-[2pt] font-bold";

function nombreEmpresa(empresa: Empresa | null): string {
  return empresa?.nombre?.trim() || "MEDOXIGAS ALC, SRL";
}

function datosDeFactura(
  empresa: Empresa | null,
  factura: FacturaDetalle,
  lineas: FacturaLinea[],
  contacto: ContactoResumen,
  ncfVence: string | null,
  mostrarLogo: boolean,
  impuestos: Impuesto[],
  emisionEcf: EmisionEcfPapel | null,
  retencionesFiscales: RetencionesFiscalesPapel | null = null,
  margenFiscalMm: number | null = null,
  montosFiscalesEcf: MontosFiscalesEcf | null = null,
  identificadorExtranjeroCliente: string | null = null,
): DatosPapel {
  const tipoEcf = tipoEcfDesdeNcf(factura.ncf);
  return {
    tipo: "factura",
    empresa,
    contacto,
    fecha: factura.fecha,
    vencimiento: factura.vencimiento,
    lineas,
    subtotal: factura.subtotal,
    descuento: factura.descuento,
    itbis: factura.itbis,
    otrosImpuestos: factura.otros_impuestos,
    propina: factura.propina,
    impuestos,
    total: factura.total,
    notas: factura.notas,
    terminos: factura.terminos,
    pie: factura.pie,
    estado: factura.estado,
    titulo: tipoEcf ? TIPOS_ECF[tipoEcf].nombre : tituloTipoComprobante(factura.tipo_comprobante),
    numero: String(factura.numero),
    ncf: factura.ncf,
    ncfVence,
    saldo:
      factura.tipo_comprobante === "01"
        ? saldoDeFactura(factura.total, factura.pagado, factura.credito, factura.retenido)
        : null,
    mostrarLogo,
    emisionEcf: esNcfElectronico(factura.ncf) ? emisionEcf : null,
    retencionesFiscales,
    margenFiscalMm,
    montosFiscalesEcf,
    identificadorExtranjeroCliente,
  };
}

function datosDeDocumento(tipo: "cotizacion" | "conduce", vista: DocumentoVista, mostrarLogo: boolean): DatosPapel {
  const { documento } = vista;

  return {
    tipo,
    empresa: vista.empresa,
    contacto: vista.contacto,
    fecha: documento.fecha,
    vencimiento: documento.vencimiento,
    lineas: vista.lineas,
    subtotal: documento.subtotal,
    descuento: documento.descuento,
    itbis: documento.itbis,
    otrosImpuestos: documento.otros_impuestos,
    propina: documento.propina,
    impuestos: vista.impuestos,
    total: documento.total,
    notas: documento.notas,
    terminos: documento.terminos,
    pie: null,
    estado: documento.estado,
    titulo: tipo === "conduce" ? "Conduce" : "Cotización",
    numero: String(documento.numero),
    ncf: null,
    ncfVence: null,
    saldo: null,
    mostrarLogo,
    emisionEcf: null,
    retencionesFiscales: null,
    margenFiscalMm: null,
    montosFiscalesEcf: null,
    identificadorExtranjeroCliente: null,
  };
}

function Logo({ empresa, nombre, mostrar }: { empresa: Empresa | null; nombre: string; mostrar: boolean }) {
  if (!mostrar) return null;
  const logo = empresa?.logo_url?.trim() || "/marca/logo-medoxigas.png";

  return (
    // biome-ignore lint/performance/noImgElement: logo configurable de la empresa
    <img src={logo} alt={nombre} className="h-[50pt] w-auto max-w-[170pt] object-contain" />
  );
}

function DatosEmpresa({ empresa }: { empresa: Empresa | null }) {
  return (
    <>
      {empresa?.rnc?.trim() ? (
        <p>
          <span className="font-semibold">RNC:</span> {empresa.rnc}
        </p>
      ) : null}
      {empresa?.direccion?.trim() ? <p>{empresa.direccion}</p> : null}
      {empresa?.sucursal?.trim() ? (
        <p>
          <span className="font-semibold">Sucursal:</span> {empresa.sucursal}
        </p>
      ) : null}
      {empresa?.correo?.trim() ? <p>{empresa.correo}</p> : null}
      {empresa?.telefono?.trim() ? (
        <p>
          <span className="font-semibold">Teléfono:</span> {empresa.telefono}
        </p>
      ) : null}
    </>
  );
}

function EncabezadoFactura({ datos }: { datos: DatosPapel }) {
  const nombre = nombreEmpresa(datos.empresa);
  const electronico = esNcfElectronico(datos.ncf);

  return (
    <header className="flex items-start justify-between gap-[24pt]">
      <div className="flex min-w-0 flex-col">
        <Logo empresa={datos.empresa} nombre={nombre} mostrar={datos.mostrarLogo} />
        <p className="mt-[3pt] text-[13pt] leading-[13.5pt]">{nombre}</p>
        <DatosEmpresa empresa={datos.empresa} />
        <p className="mt-[2pt]">
          <span className="font-semibold">Fecha de creación:</span> {formatoDia(datos.fecha)}
        </p>
        <p>
          <span className="font-semibold">Vencimiento de la factura:</span> {formatoDia(datos.vencimiento)}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-semibold">{datos.titulo}</p>
        <p className="my-[2pt] text-[14pt] leading-[16pt] font-semibold">
          {electronico ? "e-NCF" : "No. NCF"} {datos.ncf ?? "—"}
        </p>
        {datos.ncfVence?.trim() ? (
          <p>
            <span className="font-semibold">{electronico ? "Vencimiento e-NCF:" : "Vencimiento NCF:"}</span>{" "}
            {formatoDia(datos.ncfVence)}
          </p>
        ) : null}
        {datos.estado === "anulada" ? <p className="mt-[4pt] font-bold text-red-600">ANULADA</p> : null}
      </div>
    </header>
  );
}

function EncabezadoCotizacion({ datos }: { datos: DatosPapel }) {
  const nombre = nombreEmpresa(datos.empresa);

  return (
    <header className="flex items-start justify-between gap-[24pt]">
      <div className="flex min-w-0 flex-col">
        <Logo empresa={datos.empresa} nombre={nombre} mostrar={datos.mostrarLogo} />
        <p className="mt-[3pt] text-[13pt] leading-[13.5pt] font-semibold">{nombre}</p>
        {datos.empresa?.rnc?.trim() ? (
          <p>
            <span className="font-semibold">RNC:</span> {datos.empresa.rnc}
          </p>
        ) : null}
        {datos.empresa?.direccion?.trim() ? <p>{datos.empresa.direccion}</p> : null}
      </div>

      <div className="shrink-0 text-right">
        {datos.empresa?.correo?.trim() ? <p>{datos.empresa.correo}</p> : null}
        {datos.empresa?.telefono?.trim() ? <p>{datos.empresa.telefono}</p> : null}
      </div>
    </header>
  );
}

function EncabezadoConduce({ datos }: { datos: DatosPapel }) {
  const nombre = nombreEmpresa(datos.empresa);

  return (
    <header className="grid grid-cols-[120pt_1fr_120pt] items-start gap-[8pt]">
      <Logo empresa={datos.empresa} nombre={nombre} mostrar={datos.mostrarLogo} />

      <div className="text-center text-[8.5pt] leading-[9pt]">
        <p className="text-[10pt] font-bold">{nombre}</p>
        {datos.empresa?.rnc?.trim() ? <p>RNC: {datos.empresa.rnc}</p> : null}
        {datos.empresa?.direccion?.trim() ? <p>{datos.empresa.direccion}</p> : null}
        {datos.empresa?.telefono?.trim() ? <p>{datos.empresa.telefono}</p> : null}
        {datos.empresa?.correo?.trim() ? <p>{datos.empresa.correo}</p> : null}
      </div>

      <div className="text-right">
        <p className="text-[8pt]">Conduce</p>
        <p className="text-[11pt] leading-[13pt] font-bold">No. {datos.numero}</p>
        {datos.estado === "anulada" ? <p className="mt-[2pt] font-bold text-red-600">ANULADO</p> : null}
      </div>
    </header>
  );
}

function BloqueClienteFactura({ datos }: { datos: DatosPapel }) {
  return (
    <section className="mt-[18pt] flex justify-between gap-[20pt] bg-[#f7f8fa] px-[5pt] py-[3pt]">
      <div className="flex min-w-0 flex-col">
        <p>
          <span className="font-semibold">Cliente:</span> {datos.contacto.nombre}
        </p>
        {datos.contacto.rnc_cedula?.trim() ? (
          <p>
            <span className="font-semibold">RNC:</span> {datos.contacto.rnc_cedula}
          </p>
        ) : null}
        {datos.identificadorExtranjeroCliente?.trim() ? (
          <p>
            <span className="font-semibold">Identificador extranjero:</span> {datos.identificadorExtranjeroCliente}
          </p>
        ) : null}
        {datos.contacto.telefono?.trim() ? (
          <p>
            <span className="font-semibold">Teléfono:</span> {datos.contacto.telefono}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end">
        <p>
          <span className="font-semibold">Moneda:</span> DOP
        </p>
        {datos.saldo != null ? (
          <p>
            <span className="font-semibold">Valor restante por pagar:</span> {formatearMontoPapel(datos.saldo)}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function BloqueClienteCotizacion({ datos }: { datos: DatosPapel }) {
  return (
    <section className="mt-[14pt] flex items-start justify-between gap-[20pt]">
      <div className="flex min-w-0 flex-col">
        <p>
          <span className="font-semibold">Cliente:</span> {datos.contacto.nombre}
        </p>
        {datos.contacto.rnc_cedula?.trim() ? (
          <p>
            <span className="font-semibold">RNC:</span> {datos.contacto.rnc_cedula}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[11pt] leading-[16pt] font-semibold">{datos.titulo}</p>
        <p className="text-[14pt] leading-[16pt] font-semibold">No. {datos.numero}</p>
        <p>
          <span className="font-semibold">Fecha de creación:</span> {formatoDia(datos.fecha)}
        </p>
        <p>
          <span className="font-semibold">Fecha de vencimiento:</span> {formatoDia(datos.vencimiento)}
        </p>
        {datos.estado === "anulada" ? <p className="mt-[3pt] font-bold text-red-600">ANULADA</p> : null}
      </div>
    </section>
  );
}

function BloqueClienteConduce({ datos }: { datos: DatosPapel }) {
  return (
    <section className="mt-[18pt] grid grid-cols-[64pt_1fr_30pt_74pt_170pt] grid-rows-4 border-t border-l border-[#c9d0da] text-[8pt] leading-[11pt]">
      <p className={CELDA_ETIQUETA}>SEÑOR(ES)</p>
      <p className="col-span-3 border-r border-b border-[#c9d0da] px-[4pt] py-[2pt]">{datos.contacto.nombre}</p>
      <p className={CELDA_ETIQUETA}>FECHA DE EXPEDICIÓN</p>
      <p className={CELDA_ETIQUETA}>DIRECCIÓN</p>
      <p className="col-span-3 border-r border-b border-[#c9d0da] px-[4pt] py-[2pt]">
        {datos.contacto.direccion?.trim() ?? ""}
      </p>
      <p className="border-r border-b border-[#c9d0da] px-[4pt] py-[2pt]">{formatoDia(datos.fecha)}</p>
      <p className={CELDA_ETIQUETA}>CIUDAD</p>
      <p className="col-span-3 border-r border-b border-[#c9d0da] px-[4pt] py-[2pt]" />
      <p className={CELDA_ETIQUETA}>FECHA DE VENCIMIENTO</p>
      <p className={CELDA_ETIQUETA}>TELÉFONO</p>
      <p className="border-r border-b border-[#c9d0da] px-[4pt] py-[2pt]">{datos.contacto.telefono?.trim() ?? ""}</p>
      <p className={CELDA_ETIQUETA}>RNC</p>
      <p className="border-r border-b border-[#c9d0da] px-[4pt] py-[2pt]">{datos.contacto.rnc_cedula?.trim() ?? ""}</p>
      <p className="border-r border-b border-[#c9d0da] px-[4pt] py-[2pt]">{formatoDia(datos.vencimiento)}</p>
    </section>
  );
}

function TablaFactura({ lineas }: { lineas: LineaPapel[] }) {
  return (
    <table className="mx-[5pt] mt-[12pt] w-[calc(100%-10pt)] table-fixed border-collapse text-left">
      <colgroup>
        <col className="w-[52pt]" />
        <col />
        <col className="w-[46pt]" />
        <col className="w-[90pt]" />
        <col className="w-[90pt]" />
        <col className="w-[90pt]" />
        <col className="w-[90pt]" />
      </colgroup>
      <thead>
        <tr className="border-y border-[#d7dce3] bg-[#f7f8fa] text-[7.5pt]">
          <th className="px-[5pt] py-[2.5pt] font-semibold">Cantidad</th>
          <th className="px-[5pt] py-[2.5pt] font-semibold">Descripción</th>
          <th className="px-[5pt] py-[2.5pt] font-semibold">Unidad</th>
          <th className="px-[5pt] py-[2.5pt] font-semibold whitespace-nowrap">Precio</th>
          <th className="px-[5pt] py-[2.5pt] font-semibold whitespace-nowrap">Descuento</th>
          <th className="px-[5pt] py-[2.5pt] font-semibold whitespace-nowrap">Impuesto</th>
          <th className="px-[5pt] py-[2.5pt] text-right font-semibold whitespace-nowrap">Valor</th>
        </tr>
      </thead>
      <tbody>
        {lineas.map((linea) => (
          <tr key={linea.id} className="border-b border-[#e2e5ea]">
            <td className={CELDA}>{formatoCantidad(linea.cantidad)}</td>
            <td className={CELDA_TEXTO}>{linea.descripcion}</td>
            <td className={CELDA}>Unidad</td>
            <td className={CELDA_MONTO}>{formatearPrecioPapel(linea.precio)}</td>
            <td className={CELDA_MONTO}>
              {linea.descuento_pct > 0 ? formatearMontoPapel(descuentoDeLinea(linea)) : ""}
            </td>
            <td className={CELDA_MONTO}>{formatearMontoPapel(linea.itbis)}</td>
            <td className={CELDA_NUMERO}>{formatearMontoPapel(linea.subtotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TablaCotizacion({ lineas }: { lineas: LineaPapel[] }) {
  return (
    <table className="mx-[5pt] mt-[20pt] w-[calc(100%-10pt)] table-fixed border-collapse text-left">
      <colgroup>
        <col />
        <col className="w-[90pt]" />
        <col className="w-[46pt]" />
        <col className="w-[52pt]" />
        <col className="w-[90pt]" />
        <col className="w-[90pt]" />
        <col className="w-[90pt]" />
      </colgroup>
      <thead>
        <tr className="border-y border-[#d7dce3] bg-[#f7f8fa] text-[7.5pt]">
          <th className="px-[5pt] py-[3pt] font-semibold">Concepto</th>
          <th className="px-[5pt] py-[3pt] font-semibold whitespace-nowrap">Precio</th>
          <th className="px-[5pt] py-[3pt] font-semibold">Unidad</th>
          <th className="px-[5pt] py-[3pt] text-right font-semibold whitespace-nowrap">Cantidad</th>
          <th className="px-[5pt] py-[3pt] font-semibold whitespace-nowrap">Descuento</th>
          <th className="px-[5pt] py-[3pt] font-semibold whitespace-nowrap">Impuesto</th>
          <th className="px-[5pt] py-[3pt] text-right font-semibold whitespace-nowrap">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {lineas.map((linea) => (
          <tr key={linea.id} className="border-b border-[#e2e5ea]">
            <td className={CELDA_TEXTO}>{linea.descripcion}</td>
            <td className={CELDA_MONTO}>{formatearPrecioPapel(linea.precio)}</td>
            <td className={CELDA}>Unidad</td>
            <td className={CELDA_NUMERO}>{formatoCantidad(linea.cantidad)}</td>
            <td className={CELDA_MONTO}>
              {linea.descuento_pct > 0 ? formatearMontoPapel(descuentoDeLinea(linea)) : ""}
            </td>
            <td className={CELDA_MONTO}>{formatearMontoPapel(linea.itbis)}</td>
            <td className={CELDA_NUMERO}>{formatearMontoPapel(linea.subtotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TablaConduce({ lineas }: { lineas: LineaPapel[] }) {
  return (
    <table className="mt-[14pt] w-full table-fixed border-collapse text-left text-[8pt]">
      <colgroup>
        <col />
        <col className="w-[80pt]" />
        <col className="w-[46pt]" />
        <col className="w-[80pt]" />
        <col className="w-[80pt]" />
        <col className="w-[80pt]" />
      </colgroup>
      <thead>
        <tr className="border border-[#c9d0da] bg-[#e6e8eb] text-[8pt]">
          <th className="border-r border-[#c9d0da] px-[5pt] py-[2pt] font-bold">Ítem</th>
          <th className="border-r border-[#c9d0da] px-[5pt] py-[2pt] font-bold whitespace-nowrap">Precio</th>
          <th className="border-r border-[#c9d0da] px-[5pt] py-[2pt] font-bold whitespace-nowrap">Cantidad</th>
          <th className="border-r border-[#c9d0da] px-[5pt] py-[2pt] font-bold whitespace-nowrap">Descuento</th>
          <th className="border-r border-[#c9d0da] px-[5pt] py-[2pt] font-bold whitespace-nowrap">Impuesto</th>
          <th className="px-[5pt] py-[2pt] font-bold whitespace-nowrap">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {lineas.map((linea) => (
          <tr key={linea.id} className="border-b border-[#e2e5ea]">
            <td className={CELDA}>{linea.descripcion}</td>
            <td className={CELDA_NUMERO}>{formatearPrecioPapel(linea.precio)}</td>
            <td className={CELDA_NUMERO}>{formatoCantidad(linea.cantidad)}</td>
            <td className={CELDA_NUMERO}>
              {linea.descuento_pct > 0 ? formatearMontoPapel(descuentoDeLinea(linea)) : ""}
            </td>
            <td className={CELDA_NUMERO}>{formatearMontoPapel(linea.itbis)}</td>
            <td className={CELDA_NUMERO}>{formatearMontoPapel(linea.subtotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FilaTotal({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-[12pt]">
      <span>{etiqueta}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}

function FilasImpuestos({ datos }: { datos: DatosPapel }) {
  const filas = resumenImpuestos(datos.lineas, datos.impuestos);

  return (
    <>
      {filas.map((fila) => (
        <FilaTotal key={fila.clave} etiqueta={fila.nombre} valor={formatearMontoPapel(fila.total)} />
      ))}
    </>
  );
}

function FilasMontosFiscalesEcf({ montos }: { montos: MontosFiscalesEcf }) {
  const tasasGravado: Array<{ monto: number | null | undefined; itbis: number | null | undefined; tasa: number }> = [
    { monto: montos.gravadoI1, itbis: montos.itbis1, tasa: 18 },
    { monto: montos.gravadoI2, itbis: montos.itbis2, tasa: 16 },
    { monto: montos.gravadoI3, itbis: montos.itbis3, tasa: 0 },
  ];
  const presentes = tasasGravado.filter((fila) => fila.monto != null);
  return (
    <>
      {montos.gravadoTotal != null ? (
        <FilaTotal etiqueta="MONTO GRAVADO" valor={formatearMontoPapel(montos.gravadoTotal)} />
      ) : null}
      {(montos.exento ?? 0) > 0 ? (
        <FilaTotal etiqueta="SUBTOTAL EXENTO" valor={formatearMontoPapel(montos.exento)} />
      ) : null}
      {presentes.length > 1
        ? presentes.map((fila) => (
            <FilaTotal
              key={`gravado-${fila.tasa}`}
              etiqueta={`GRAVADO ITBIS ${fila.tasa}%`}
              valor={formatearMontoPapel(fila.monto)}
            />
          ))
        : null}
      {presentes.length > 0
        ? presentes.map((fila) => (
            <FilaTotal
              key={`itbis-${fila.tasa}`}
              etiqueta={`ITBIS (${fila.tasa.toFixed(2)}%)`}
              valor={formatearMontoPapel(fila.itbis ?? 0)}
            />
          ))
        : montos.itbisTotal != null && montos.itbisTotal > 0
          ? [<FilaTotal key="itbis-total" etiqueta="ITBIS" valor={formatearMontoPapel(montos.itbisTotal)} />]
          : null}
    </>
  );
}

function TotalesFactura({ datos }: { datos: DatosPapel }) {
  return (
    <div className="flex justify-end">
      <div className="w-[210pt] text-[8pt] leading-[13.6pt]">
        <FilaTotal etiqueta="SUBTOTAL" valor={formatearMontoPapel(subtotalBruto(datos.subtotal, datos.descuento))} />
        {datos.descuento > 0 ? <FilaTotal etiqueta="DESCUENTO" valor={formatearMontoPapel(datos.descuento)} /> : null}
        {datos.montosFiscalesEcf ? (
          <FilasMontosFiscalesEcf montos={datos.montosFiscalesEcf} />
        ) : (
          <>
            <FilaTotal etiqueta="MONTO GRAVADO" valor={formatearMontoPapel(montoGravadoDeLineas(datos.lineas))} />
            <FilasImpuestos datos={datos} />
          </>
        )}
        <div className="mt-[3pt] flex justify-between gap-[12pt] border-t border-[#0a2352] pt-[2pt] text-[10pt] font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatearMontoPapel(datos.total)}</span>
        </div>
        {(datos.retencionesFiscales?.itbisRetenido ?? 0) > 0 ? (
          <FilaTotal etiqueta="ITBIS RETENIDO" valor={formatearMontoPapel(datos.retencionesFiscales?.itbisRetenido)} />
        ) : null}
        {(datos.retencionesFiscales?.isrRetenido ?? 0) > 0 ? (
          <FilaTotal etiqueta="ISR RETENIDO" valor={formatearMontoPapel(datos.retencionesFiscales?.isrRetenido)} />
        ) : null}
        <p className="mt-[2pt] text-right text-[10pt] font-semibold">
          Total de items: {formatoCantidad(totalItemsPapel(datos.lineas))}
        </p>
      </div>
    </div>
  );
}

function TotalesCotizacion({ datos }: { datos: DatosPapel }) {
  return (
    <div className="flex justify-end">
      <div className="w-[270pt] text-[10pt] leading-[16.1pt]">
        <FilaTotal etiqueta="Subtotal" valor={formatearMontoPapel(datos.subtotal)} />
        <FilasImpuestos datos={datos} />
        <div className="mt-[6pt] flex justify-between gap-[12pt] border-t border-[#0a2352] pt-[4pt] text-[13pt] font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatearMontoPapel(datos.total)}</span>
        </div>
      </div>
    </div>
  );
}

function TotalesConduce({ datos }: { datos: DatosPapel }) {
  return (
    <div className="flex justify-end">
      <div className="w-[145pt] text-[9pt] leading-[12pt]">
        <FilaTotal etiqueta="Subtotal" valor={formatearMontoPapel(datos.subtotal)} />
        <FilasImpuestos datos={datos} />
        <div className="mt-[2pt] flex justify-between gap-[12pt] border-t border-[#0a2352] pt-[1pt] font-bold">
          <span>Total</span>
          <span className="tabular-nums">{formatearMontoPapel(datos.total)}</span>
        </div>
      </div>
    </div>
  );
}

function NotasPapel({ datos }: { datos: DatosPapel }) {
  if (!datos.notas?.trim() && !datos.terminos?.trim() && !datos.pie?.trim()) return null;

  return (
    <section className="mt-[12pt] flex flex-col gap-[5pt] text-[9pt] leading-[11pt]">
      {datos.notas?.trim() ? (
        <div>
          <p className="font-semibold">Notas</p>
          <p className="whitespace-pre-line">{datos.notas}</p>
        </div>
      ) : null}
      {datos.terminos?.trim() ? (
        <div>
          <p className="font-semibold">Términos</p>
          <p className="whitespace-pre-line">{datos.terminos}</p>
        </div>
      ) : null}
      {datos.pie?.trim() ? <p className="whitespace-pre-line">{datos.pie}</p> : null}
    </section>
  );
}

function PieFactura({ mostrarOriginal = true }: { mostrarOriginal?: boolean }) {
  return (
    <footer className="mt-[18pt]">
      {mostrarOriginal ? <p className="text-[8pt] font-semibold">Original: Cliente</p> : null}
      <p className="mt-[22pt] text-center text-[6pt]">Generado con Medoxigas Contabilidad</p>
      <p className="mt-[8pt] text-[8pt]">Página 1 de 1</p>
    </footer>
  );
}

function PieCotizacion() {
  return <footer className="mt-[18pt] text-[8pt]">Página 1 de 1</footer>;
}

function PieConduce() {
  return (
    <footer className="mt-[40pt]">
      <div className="grid grid-cols-2 gap-[34pt] text-center text-[7.5pt]">
        <p className="border-t border-[#0a2352] pt-[3pt]">ELABORADO POR</p>
        <p className="border-t border-[#0a2352] pt-[3pt]">ACEPTADA, FIRMA Y/O SELLO Y FECHA</p>
      </div>
      <p className="mt-[14pt] text-center text-[6pt]">Generado con Medoxigas Contabilidad</p>
    </footer>
  );
}

function ContenidoFactura({ datos }: { datos: DatosPapel }) {
  return (
    <>
      <EncabezadoFactura datos={datos} />
      <BloqueClienteFactura datos={datos} />
      <TablaFactura lineas={datos.lineas} />
      <p className="mt-[8pt]">
        <span className="font-semibold">Total de líneas:</span> {datos.lineas.length}
      </p>
      <p className="-mx-[16pt] mt-[8pt] bg-[#f7f8fa] px-[21pt] py-[3.5pt] font-semibold">
        {montoEnLetras(datos.total)}
      </p>
      <div className="flex-1" />
      <TotalesFactura datos={datos} />
      <NotasPapel datos={datos} />
      {datos.emisionEcf ? (
        <div style={datos.margenFiscalMm != null ? { marginLeft: `${datos.margenFiscalMm}mm` } : undefined}>
          <BloqueFiscalEcf
            codigoSeguridad={datos.emisionEcf.codigoSeguridad}
            encf={datos.ncf}
            fechaHoraFirma={datos.emisionEcf.fechaHoraFirma}
            urlQr={datos.emisionEcf.urlQr}
          />
        </div>
      ) : null}
      <PieFactura mostrarOriginal={!datos.emisionEcf} />
    </>
  );
}

function ContenidoCotizacion({ datos }: { datos: DatosPapel }) {
  return (
    <>
      <EncabezadoCotizacion datos={datos} />
      <BloqueClienteCotizacion datos={datos} />
      <TablaCotizacion lineas={datos.lineas} />
      <p className="mx-[5pt] mt-[10pt] bg-[#f7f8fa] px-[5pt] py-[4.5pt]">{montoEnLetras(datos.total)}</p>
      <div className="flex-1" />
      <TotalesCotizacion datos={datos} />
      <NotasPapel datos={datos} />
      <PieCotizacion />
    </>
  );
}

function ContenidoConduce({ datos }: { datos: DatosPapel }) {
  return (
    <>
      <EncabezadoConduce datos={datos} />
      <BloqueClienteConduce datos={datos} />
      <TablaConduce lineas={datos.lineas} />
      <div className="flex-1" />
      <TotalesConduce datos={datos} />
      <NotasPapel datos={datos} />
      <PieConduce />
    </>
  );
}

export function DocumentoPapel(props: Props) {
  const datos =
    props.tipo === "factura"
      ? datosDeFactura(
          props.empresa,
          props.factura,
          props.lineas,
          props.contacto,
          props.ncfVence,
          props.mostrarLogo ?? true,
          props.impuestos,
          props.emisionEcf ?? null,
          props.retencionesFiscales ?? null,
          props.margenFiscalMm ?? null,
          props.montosFiscalesEcf ?? null,
          props.identificadorExtranjeroCliente ?? null,
        )
      : datosDeDocumento(props.tipo, props.vista, props.mostrarLogo ?? true);

  return (
    <article
      className={cn(
        "documento-papel mx-auto flex min-h-[10.98in] w-full flex-col bg-white px-[16pt] pt-[28pt] pb-[3pt]",
        "[font-family:var(--font-inter)] text-[10pt] leading-[12.1pt] text-[#0a2352]",
      )}
    >
      {datos.tipo === "factura" ? <ContenidoFactura datos={datos} /> : null}
      {datos.tipo === "cotizacion" ? <ContenidoCotizacion datos={datos} /> : null}
      {datos.tipo === "conduce" ? <ContenidoConduce datos={datos} /> : null}
    </article>
  );
}
