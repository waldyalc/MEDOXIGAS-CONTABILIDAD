"use client";

import { type FormEvent, type ReactNode, useEffect, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import {
  ArrowLeft,
  Ban,
  ChevronDown,
  Copy,
  Download,
  FileMinus,
  FilePlus2,
  FileText,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Printer,
  Share2,
  Truck,
} from "lucide-react";
import { createPortal } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { convertirRemisionAFactura } from "@/lib/conduces/acciones";
import { convertirCotizacionAFactura } from "@/lib/cotizaciones/acciones";
import type {
  DocumentoDetalle,
  DocumentoRelacionado,
  DocumentoVista,
  FacturaRelacionada,
} from "@/lib/cotizaciones/tipos";
import {
  rutaConduce,
  rutaContacto,
  rutaCotizacion,
  rutaFactura,
  rutaNotaCreditoVenta,
  rutaNotaDebitoVenta,
  rutaPagoRecibido,
  rutaProducto,
} from "@/lib/enlaces";
import { anularFactura } from "@/lib/facturacion/acciones";
import { tituloTipoComprobante } from "@/lib/facturacion/comprobantes";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import type {
  AsientoVista,
  ContactoResumen,
  Empresa,
  FacturaDetalle,
  FacturaLinea,
  FacturaVista,
  NotaVentaResumen,
  PagoFacturaVista,
} from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";

import { AsientoContable } from "./asiento-contable";
import { nombreArchivoPapel } from "./papel";
import {
  descuentoDeLineas,
  estadoDeDocumento,
  estadoDeFactura,
  etiquetaDescuento,
  etiquetaItbisTotal,
  etiquetaTasaItbis,
  montoGravadoDeLineas,
  permisosDeDocumento,
  permisosDeFactura,
  resumenFactura,
  type TipoVistaDocumento,
  type TonoEstado,
  totalNotasActivas,
} from "./vista";

const TONOS_ESTADO: Record<TonoEstado, string> = {
  amber: "border-amber-700/15 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  green: "border-emerald-700/15 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  red: "border-rose-700/15 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  neutral: "border-border bg-muted text-muted-foreground",
};

const METODOS_PAGO: Record<PagoFacturaVista["metodo"], string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

const COMPROBANTES = [
  { value: "02", label: "02 Consumo" },
  { value: "01", label: "01 Crédito fiscal" },
] as const;

const BOTON_ICONO = "size-10 rounded-[10px] border-slate-400/40";
const BOTON_TEXTO = "h-9 rounded-[10px] border-slate-400/40 px-4";
const PESTANA = "h-auto flex-none rounded-none px-6 py-2 text-sm font-normal after:bottom-0 after:bg-primary";

const RUTAS_VOLVER: Record<TipoVistaDocumento, string> = {
  factura: "/dashboard/facturacion",
  cotizacion: "/dashboard/cotizaciones",
  conduce: "/dashboard/conduces",
};

const ETIQUETAS_VOLVER: Record<TipoVistaDocumento, string> = {
  factura: "Volver a mis facturas",
  cotizacion: "Volver a mis cotizaciones",
  conduce: "Volver a mis conduces",
};

const TITULOS_INFORMACION: Record<TipoVistaDocumento, string> = {
  factura: "Información de la factura",
  cotizacion: "Información de la cotización",
  conduce: "Información del conduce",
};

const NOMBRES_DOCUMENTO: Record<TipoVistaDocumento, string> = {
  factura: "factura",
  cotizacion: "cotización",
  conduce: "conduce",
};

const TITULOS_DOCUMENTO: Record<TipoVistaDocumento, string> = {
  factura: "Factura",
  cotizacion: "Cotización",
  conduce: "Conduce",
};

interface PropsBase {
  puedeEscribir: boolean;
  papel: ReactNode;
}

type Props =
  | (PropsBase & { tipo: "factura"; datos: FacturaVista })
  | (PropsBase & { tipo: "cotizacion" | "conduce"; datos: DocumentoVista });

function EtiquetaEstado({ etiqueta, tono }: { etiqueta: string; tono: TonoEstado }) {
  return (
    <Badge variant="outline" className={cn("h-5 rounded-[4px] px-[5px] py-px text-xs font-medium", TONOS_ESTADO[tono])}>
      {etiqueta}
    </Badge>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <dt className="text-sm leading-5 font-medium">{etiqueta}</dt>
      <dd className="m-0 text-sm leading-5">{children}</dd>
    </div>
  );
}

function ResumenFactura({
  resumen,
  notasCredito,
  notasDebito,
}: {
  resumen: ReturnType<typeof resumenFactura>;
  notasCredito: NotaVentaResumen[];
  notasDebito: NotaVentaResumen[];
}) {
  const [abierto, setAbierto] = useState(false);
  const items = [
    { etiqueta: "Valor total", valor: formatoMoneda(resumen.valorTotal), peligro: false },
    { etiqueta: "Valor retenido", valor: formatoMoneda(resumen.valorRetenido), peligro: false },
    { etiqueta: "Total cobrado", valor: formatoMoneda(resumen.totalCobrado), peligro: false },
    { etiqueta: "Por cobrar", valor: formatoMoneda(resumen.porCobrar), peligro: true },
  ];

  return (
    <Card className="border-border bg-card gap-0 overflow-hidden rounded-2xl border py-0 shadow-none ring-0 [--card-spacing:0px]">
      <div className="flex flex-col md:flex-row">
        {items.map((item) => (
          <div
            key={item.etiqueta}
            className="border-border flex flex-col gap-1 border-b p-4 last:border-b-0 md:flex-1 md:border-r md:border-b-0 md:last:border-r-0"
          >
            <span className="text-muted-foreground text-xs leading-4 font-medium">{item.etiqueta}</span>
            <span
              className={cn(
                "text-xl leading-7 font-semibold text-slate-700 tabular-nums dark:text-slate-200",
                item.peligro && "text-rose-700 dark:text-rose-400",
              )}
            >
              {item.valor}
            </span>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out",
          abierto ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0">
          <div className="border-border flex flex-col border-t md:flex-row">
            <div className="border-border flex flex-1 flex-col gap-1 border-b p-4 md:border-r md:border-b-0">
              <span className="text-muted-foreground text-xs leading-4 font-medium">Notas de crédito</span>
              <span className="text-xl leading-7 font-semibold text-slate-700 tabular-nums dark:text-slate-200">
                {formatoMoneda(totalNotasActivas(notasCredito))}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1 p-4">
              <span className="text-muted-foreground text-xs leading-4 font-medium">Notas de débito</span>
              <span className="text-xl leading-7 font-semibold text-slate-700 tabular-nums dark:text-slate-200">
                {formatoMoneda(totalNotasActivas(notasDebito))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        className="text-primary border-border dark:hover:bg-muted/40 h-auto w-full gap-1 rounded-none border-t px-4 py-2 text-xs font-medium hover:bg-slate-50"
        aria-expanded={abierto}
        onClick={() => setAbierto((valor) => !valor)}
      >
        Ver más
        <ChevronDown className={cn("size-4 transition-transform", abierto && "rotate-180")} />
      </Button>
    </Card>
  );
}

function EncabezadoDocumento({ empresa, numeroDocumento }: { empresa: Empresa | null; numeroDocumento: string }) {
  const nombreEmpresa = empresa?.nombre?.trim() || "MEDOXIGAS ALC, SRL";
  const logo = empresa?.logo_url?.trim() || "/marca/logo-medoxigas.png";

  return (
    <header className="mb-[30px] flex flex-col gap-4 py-3 md:flex-row md:items-center md:justify-between md:gap-2 md:py-0">
      <div className="flex w-full justify-center md:w-1/3 md:justify-start">
        <div className="flex h-[117px] w-full max-w-[300px] items-center justify-center overflow-hidden rounded-lg bg-white">
          {/* biome-ignore lint/performance/noImgElement: logo configurable de la empresa */}
          <img src={logo} alt={nombreEmpresa} className="max-h-full max-w-full object-contain" />
        </div>
      </div>

      <div className="w-full text-center md:w-1/3">
        <p className="text-foreground text-base leading-6 font-semibold">{nombreEmpresa}</p>
        {empresa?.rnc?.trim() ? <p className="text-xs leading-4">{empresa.rnc}</p> : null}
        {empresa?.correo?.trim() ? <p className="text-xs leading-4">{empresa.correo}</p> : null}
      </div>

      <div className="w-full md:w-1/3 md:text-right">
        <p className="text-foreground text-base leading-6 font-semibold">No. {numeroDocumento}</p>
      </div>
    </header>
  );
}

function InformacionDocumento({
  titulo,
  contacto,
  fecha,
  vencimiento,
  columnas,
}: {
  titulo: string;
  contacto: ContactoResumen;
  fecha: string;
  vencimiento: string;
  columnas: 2 | 3;
}) {
  const esFactura = columnas === 3;

  return (
    <section>
      <h2 className="text-foreground mb-4 text-base leading-6 font-semibold">{titulo}</h2>
      <dl className={cn("m-0 grid grid-cols-1 gap-8", columnas === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <Campo etiqueta="Cliente">
          <Link
            href={rutaContacto(contacto.id)}
            className={cn("text-foreground hover:underline", !esFactura && "text-base underline underline-offset-4")}
          >
            {contacto.nombre}
          </Link>
        </Campo>

        <Campo etiqueta={esFactura ? "RNC" : "Identificación"}>{contacto.rnc_cedula?.trim() || "—"}</Campo>

        <Campo etiqueta={esFactura ? "Creación" : "Fecha de creación"}>{formatoDia(fecha)}</Campo>

        <Campo etiqueta={esFactura ? "Vencimiento" : "Fecha de vencimiento"}>{formatoDia(vencimiento)}</Campo>
      </dl>
    </section>
  );
}

function TablaLineas({ lineas }: { lineas: FacturaLinea[] }) {
  const columnas = ["Producto o servicio", "Cantidad", "Precio", "Descuento", "Impuesto", "Subtotal"];

  return (
    <section className="mt-10">
      <h3 className="text-foreground mb-6 text-base leading-6 font-bold">Productos y servicios</h3>
      <div className="border-border overflow-x-auto rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {columnas.map((columna, indice) => (
                <TableHead
                  key={columna}
                  className={cn(
                    "bg-muted/60 text-foreground relative h-10 px-4 text-xs font-medium whitespace-nowrap",
                    indice > 0 && "text-right",
                    indice < columnas.length - 1 &&
                      "after:bg-border after:absolute after:top-2 after:right-0 after:h-[60%] after:w-px",
                  )}
                >
                  {columna}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnas.length} className="text-muted-foreground h-24 text-center text-sm">
                  Este documento no tiene productos.
                </TableCell>
              </TableRow>
            ) : (
              lineas.map((linea) => (
                <TableRow key={linea.id}>
                  <TableCell className="h-12 px-4 text-sm">
                    {linea.producto_id ? (
                      <Link
                        href={rutaProducto(linea.producto_id)}
                        className="text-foreground underline underline-offset-4"
                      >
                        {linea.descripcion}
                      </Link>
                    ) : (
                      <span className="text-foreground">{linea.descripcion}</span>
                    )}
                  </TableCell>
                  <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                    {formatoCantidad(linea.cantidad)}
                  </TableCell>
                  <TableCell className="h-12 px-4 text-right text-sm whitespace-nowrap tabular-nums">
                    {formatoMoneda(linea.precio)}
                  </TableCell>
                  <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                    {etiquetaDescuento(linea.descuento_pct)}
                  </TableCell>
                  <TableCell className="h-12 px-4 text-right text-sm whitespace-nowrap tabular-nums">
                    {etiquetaTasaItbis(linea.itbis_tasa)}
                  </TableCell>
                  <TableCell className="h-12 px-4 text-right text-sm whitespace-nowrap tabular-nums">
                    {formatoMoneda(linea.subtotal)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function TotalesDocumento({
  lineas,
  subtotal,
  descuento,
  itbis,
  total,
}: {
  lineas: FacturaLinea[];
  subtotal: number;
  descuento: number;
  itbis: number;
  total: number;
}) {
  return (
    <section className="mt-10 flex md:justify-end">
      <div className="text-muted-foreground w-80 max-w-full text-base">
        <div className="flex h-6 items-center justify-between gap-4">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatoMoneda(subtotal)}</span>
        </div>
        <div className="flex h-6 items-center justify-between gap-4">
          <span>Descuento</span>
          <span className="tabular-nums">{formatoMoneda(descuento)}</span>
        </div>
        <div className="flex h-6 items-center justify-between gap-4">
          <span>Monto gravado</span>
          <span className="tabular-nums">{formatoMoneda(montoGravadoDeLineas(lineas))}</span>
        </div>
        <div className="flex h-6 items-center justify-between gap-4">
          <span>{etiquetaItbisTotal(lineas)}</span>
          <span className="tabular-nums">{formatoMoneda(itbis)}</span>
        </div>
        <div className="text-foreground mt-7 flex items-center justify-between gap-4 text-xl leading-7 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatoMoneda(total)}</span>
        </div>
      </div>
    </section>
  );
}

interface ColumnaTabla {
  titulo: string;
}

function TablaDatos({
  columnas,
  vacio,
  hayFilas,
  children,
}: {
  columnas: ColumnaTabla[];
  vacio: string;
  hayFilas: boolean;
  children: ReactNode;
}) {
  return (
    <div className="border-border overflow-x-auto rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {columnas.map((columna) => (
              <TableHead key={columna.titulo} className="bg-muted/60 text-foreground h-10 px-4 text-xs font-medium">
                {columna.titulo}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {hayFilas ? (
            children
          ) : (
            <TableRow>
              <TableCell colSpan={columnas.length} className="text-muted-foreground h-24 text-center text-sm">
                {vacio}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function TablaPagos({ pagos }: { pagos: PagoFacturaVista[] }) {
  return (
    <TablaDatos
      columnas={[
        { titulo: "Fecha" },
        { titulo: "Monto" },
        { titulo: "Recibo de caja" },
        { titulo: "Método de pago" },
        { titulo: "Estado" },
      ]}
      vacio="Sin pagos registrados."
      hayFilas={pagos.length > 0}
    >
      {pagos.map((pago) => (
        <TableRow key={pago.id}>
          <TableCell className="h-12 px-4 text-sm">{formatoDia(pago.fecha)}</TableCell>
          <TableCell className="h-12 px-4 text-sm tabular-nums">{formatoMoneda(pago.monto)}</TableCell>
          <TableCell className="h-12 px-4 text-sm">
            <Link href={rutaPagoRecibido(pago.id)} className="text-primary hover:underline">
              #{pago.numero}
            </Link>
          </TableCell>
          <TableCell className="h-12 px-4 text-sm">{METODOS_PAGO[pago.metodo]}</TableCell>
          <TableCell className="h-12 px-4 text-sm">{pago.estado === "anulado" ? "Anulado" : "Activo"}</TableCell>
        </TableRow>
      ))}
    </TablaDatos>
  );
}

function TablaNotas({ notas, tipo }: { notas: NotaVentaResumen[]; tipo: "credito" | "debito" }) {
  const ruta = tipo === "credito" ? rutaNotaCreditoVenta : rutaNotaDebitoVenta;
  const vacio = tipo === "credito" ? "Sin notas de crédito." : "Sin notas de débito.";

  return (
    <TablaDatos
      columnas={[
        { titulo: "Número" },
        { titulo: "Fecha" },
        { titulo: "NCF" },
        { titulo: "Total" },
        { titulo: "Estado" },
      ]}
      vacio={vacio}
      hayFilas={notas.length > 0}
    >
      {notas.map((nota) => (
        <TableRow key={nota.id}>
          <TableCell className="h-12 px-4 text-sm">
            <Link href={ruta(nota.id)} className="text-primary hover:underline">
              {nota.numero}
            </Link>
          </TableCell>
          <TableCell className="h-12 px-4 text-sm">{formatoDia(nota.fecha)}</TableCell>
          <TableCell className="h-12 px-4 font-mono text-xs">{nota.ncf}</TableCell>
          <TableCell className="h-12 px-4 text-sm tabular-nums">{formatoMoneda(nota.total)}</TableCell>
          <TableCell className="h-12 px-4 text-sm">{nota.estado === "anulada" ? "Anulada" : "Activa"}</TableCell>
        </TableRow>
      ))}
    </TablaDatos>
  );
}

function TablaFacturaRelacionada({ factura }: { factura: FacturaRelacionada }) {
  return (
    <TablaDatos
      columnas={[
        { titulo: "Número" },
        { titulo: "NCF" },
        { titulo: "Fecha" },
        { titulo: "Total" },
        { titulo: "Estado" },
      ]}
      vacio="Sin factura asociada."
      hayFilas
    >
      <TableRow>
        <TableCell className="h-12 px-4 text-sm">
          <Link href={rutaFactura(factura.id)} className="text-primary hover:underline">
            #{factura.numero}
          </Link>
        </TableCell>
        <TableCell className="h-12 px-4 font-mono text-xs">{factura.ncf ?? "—"}</TableCell>
        <TableCell className="h-12 px-4 text-sm">{formatoDia(factura.fecha)}</TableCell>
        <TableCell className="h-12 px-4 text-sm tabular-nums">{formatoMoneda(factura.total)}</TableCell>
        <TableCell className="h-12 px-4 text-sm">{factura.estado === "anulada" ? "Anulada" : "Activa"}</TableCell>
      </TableRow>
    </TablaDatos>
  );
}

function etiquetaEstadoRelacionado(estado: string): string {
  if (estado === "anulada") return "Anulada";
  if (estado === "convertida") return "Convertida";
  return "Abierta";
}

function TablaDocumentoRelacionado({
  documento,
  tipo,
}: {
  documento: DocumentoRelacionado;
  tipo: "cotizacion" | "conduce";
}) {
  return (
    <TablaDatos
      columnas={[{ titulo: "Número" }, { titulo: "Fecha" }, { titulo: "Total" }, { titulo: "Estado" }]}
      vacio="Sin documento asociado."
      hayFilas
    >
      <TableRow>
        <TableCell className="h-12 px-4 text-sm">
          <Link
            href={tipo === "cotizacion" ? rutaCotizacion(documento.id) : rutaConduce(documento.id)}
            className="text-primary hover:underline"
          >
            #{documento.numero}
          </Link>
        </TableCell>
        <TableCell className="h-12 px-4 text-sm">{formatoDia(documento.fecha)}</TableCell>
        <TableCell className="h-12 px-4 text-sm tabular-nums">{formatoMoneda(documento.total)}</TableCell>
        <TableCell className="h-12 px-4 text-sm">{etiquetaEstadoRelacionado(documento.estado)}</TableCell>
      </TableRow>
    </TablaDatos>
  );
}

function EstadoVacio({
  mensaje,
  textoBoton,
  onAccion,
}: {
  mensaje: string;
  textoBoton?: string;
  onAccion?: () => void;
}) {
  return (
    <div className="border-border mt-4 flex flex-col items-center justify-center gap-4 rounded-[12px] border p-4 text-center">
      <FileText className="text-muted-foreground size-16" aria-hidden="true" />
      <p className="text-muted-foreground text-base leading-6 font-medium">{mensaje}</p>
      {textoBoton && onAccion ? (
        <Button variant="outline" className="h-9 rounded-[10px]" onClick={onAccion}>
          {textoBoton}
        </Button>
      ) : null}
    </div>
  );
}

function PortalImpresion({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  if (!montado) return null;

  return createPortal(
    <div data-print-root>
      <div data-print-paper>{children}</div>
    </div>,
    document.body,
  );
}

interface MenuAccionesProps {
  facturaId: string | null;
  facturaRelacionada: FacturaRelacionada | null;
  puedeNotaCredito: boolean;
  puedeNotaDebito: boolean;
  puedeAnular: boolean;
  onNavegar: (ruta: string) => void;
  onDescargarPdf: () => void;
  onImprimir: () => void;
  onAnular: () => void;
}

function MenuAcciones(props: MenuAccionesProps) {
  return (
    <>
      {props.puedeNotaCredito && props.facturaId ? (
        <DropdownMenuItem
          className="px-4 py-2"
          onClick={() => props.onNavegar(`/dashboard/notas-credito/nueva?factura=${props.facturaId}`)}
        >
          <FileMinus />
          Nota de crédito
        </DropdownMenuItem>
      ) : null}

      {props.puedeNotaDebito && props.facturaId ? (
        <DropdownMenuItem
          className="px-4 py-2"
          onClick={() => props.onNavegar(`/dashboard/notas-debito/nueva?factura=${props.facturaId}`)}
        >
          <FilePlus2 />
          Nota de débito
        </DropdownMenuItem>
      ) : null}

      {props.puedeNotaCredito || props.puedeNotaDebito ? <DropdownMenuSeparator /> : null}

      {props.facturaRelacionada ? (
        <>
          <DropdownMenuItem
            className="px-4 py-2"
            onClick={() => props.onNavegar(rutaFactura(props.facturaRelacionada?.id ?? ""))}
          >
            <FileText />
            Ver factura
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      ) : null}

      <DropdownMenuItem className="px-4 py-2" onClick={props.onDescargarPdf}>
        <Download />
        Descargar PDF
      </DropdownMenuItem>

      <DropdownMenuItem className="px-4 py-2" onClick={props.onImprimir}>
        <Printer />
        Imprimir
      </DropdownMenuItem>

      {props.puedeAnular ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="px-4 py-2" onClick={props.onAnular}>
            <Ban />
            Anular
          </DropdownMenuItem>
        </>
      ) : null}
    </>
  );
}

interface AccionesDocumentoProps extends MenuAccionesProps {
  tipo: TipoVistaDocumento;
  esFactura: boolean;
  documentoId: string | null;
  contactoId: string | null;
  puedePagar: boolean;
  puedeConvertir: boolean;
  puedeConvertirEnConduce: boolean;
  puedeEditar: boolean;
  puedeClonar: boolean;
  pendiente: boolean;
  onCompartir: () => void;
  onAbrirConvertir: () => void;
  onConvertirEnConduce: () => void;
  onClonar: () => void;
}

function AccionesDocumento(props: AccionesDocumentoProps) {
  const rutaEditar = props.tipo === "factura" ? null : `${RUTAS_VOLVER[props.tipo]}/${props.documentoId ?? ""}/editar`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.puedeEditar && rutaEditar ? (
        <Button variant="outline" className={BOTON_TEXTO} render={<Link href={rutaEditar} />}>
          <Pencil />
          Editar
        </Button>
      ) : null}

      {props.puedeClonar ? (
        <Button variant="outline" className={BOTON_TEXTO} onClick={props.onClonar}>
          <Copy />
          Clonar
        </Button>
      ) : null}

      {props.puedeConvertir ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="h-9 rounded-[10px] px-4" disabled={props.pendiente} />}>
            Convertir
            <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} className="min-w-[185px] rounded-lg">
            {props.puedeConvertirEnConduce ? (
              <DropdownMenuItem className="px-4 py-2" onClick={props.onConvertirEnConduce}>
                <Truck />
                Convertir en conduce
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem className="px-4 py-2" onClick={props.onAbrirConvertir}>
              <FilePlus2 />
              Convertir en factura
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon" className={BOTON_ICONO} aria-label="Más acciones" />}
        >
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4} className="min-w-[185px] rounded-lg">
          <MenuAcciones
            facturaId={props.facturaId}
            facturaRelacionada={props.facturaRelacionada}
            puedeNotaCredito={props.puedeNotaCredito}
            puedeNotaDebito={props.puedeNotaDebito}
            puedeAnular={props.puedeAnular}
            onNavegar={props.onNavegar}
            onDescargarPdf={props.onDescargarPdf}
            onImprimir={props.onImprimir}
            onAnular={props.onAnular}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" size="icon" className={BOTON_ICONO} aria-label="Compartir" onClick={props.onCompartir}>
        <Share2 />
      </Button>

      <Button variant="outline" size="icon" className={BOTON_ICONO} aria-label="Imprimir" onClick={props.onImprimir}>
        <Printer />
      </Button>

      {props.esFactura && props.puedePagar && props.facturaId ? (
        <Button
          variant="outline"
          className={BOTON_TEXTO}
          render={
            <Link
              href={`/dashboard/pagos-recibidos/nuevo?factura=${props.facturaId}&cliente=${props.contactoId ?? ""}`}
            />
          }
        >
          <Plus />
          Agregar pago
        </Button>
      ) : null}
    </div>
  );
}

function EncabezadoVista({
  titulo,
  estado,
  rutaVolver,
  etiquetaVolver,
  acciones,
}: {
  titulo: string;
  estado: { etiqueta: string; tono: TonoEstado };
  rutaVolver: string;
  etiquetaVolver: string;
  acciones: ReactNode;
}) {
  return (
    <div>
      <Link href={rutaVolver} className="text-primary mb-2 inline-flex items-center gap-1 text-xs font-medium">
        <ArrowLeft className="size-4" />
        {etiquetaVolver}
      </Link>

      <header className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-xl leading-7 font-semibold text-slate-900 dark:text-slate-100">{titulo}</h1>
          <EtiquetaEstado {...estado} />
        </div>
        {acciones}
      </header>
    </div>
  );
}

interface DocumentoVentaCardProps {
  empresa: Empresa | null;
  numeroDocumento: string;
  tituloInformacion: string;
  contacto: ContactoResumen;
  fecha: string;
  vencimiento: string;
  columnas: 2 | 3;
  lineas: FacturaLinea[];
  subtotal: number;
  descuento: number;
  itbis: number;
  total: number;
}

function DocumentoVentaCard(props: DocumentoVentaCardProps) {
  return (
    <Card className="bg-card gap-0 rounded-[12px] border border-slate-400/20 py-0 shadow-none ring-0 [--card-spacing:0px]">
      <div className="p-3 text-slate-700 sm:p-5 md:p-8 dark:text-slate-200">
        <EncabezadoDocumento empresa={props.empresa} numeroDocumento={props.numeroDocumento} />
        <InformacionDocumento
          titulo={props.tituloInformacion}
          contacto={props.contacto}
          fecha={props.fecha}
          vencimiento={props.vencimiento}
          columnas={props.columnas}
        />
        <TablaLineas lineas={props.lineas} />
        <TotalesDocumento
          lineas={props.lineas}
          subtotal={props.subtotal}
          descuento={props.descuento}
          itbis={props.itbis}
          total={props.total}
        />
      </div>
    </Card>
  );
}

function PanelFactura({
  pagos,
  notasCredito,
  notasDebito,
  asiento,
}: {
  pagos: PagoFacturaVista[];
  notasCredito: NotaVentaResumen[];
  notasDebito: NotaVentaResumen[];
  asiento: AsientoVista | null;
}) {
  return (
    <Card className="bg-card gap-0 rounded-[12px] border border-slate-400/20 px-2 pt-2 pb-6 shadow-none ring-0 [--card-spacing:0px] sm:px-8 sm:pb-8">
      <Tabs defaultValue="pagos" className="gap-0">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-slate-300 p-0"
        >
          <TabsTrigger value="pagos" className={PESTANA}>
            Pagos
          </TabsTrigger>
          <TabsTrigger value="notas-credito" className={PESTANA}>
            Notas crédito
          </TabsTrigger>
          <TabsTrigger value="notas-debito" className={PESTANA}>
            Notas débito
          </TabsTrigger>
          <TabsTrigger value="contabilidad" className={PESTANA}>
            Contabilidad
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pagos" className="mt-6">
          <TablaPagos pagos={pagos} />
        </TabsContent>
        <TabsContent value="notas-credito" className="mt-6">
          <TablaNotas notas={notasCredito} tipo="credito" />
        </TabsContent>
        <TabsContent value="notas-debito" className="mt-6">
          <TablaNotas notas={notasDebito} tipo="debito" />
        </TabsContent>
        <TabsContent value="contabilidad" className="mt-6">
          <AsientoContable asiento={asiento ?? { asiento: null, lineas: [] }} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function ContenidoFacturaRelacionada({
  factura,
  puedeConvertir,
  onConvertir,
}: {
  factura: FacturaRelacionada | null;
  puedeConvertir: boolean;
  onConvertir: () => void;
}) {
  if (factura) return <TablaFacturaRelacionada factura={factura} />;

  return (
    <EstadoVacio
      mensaje="Aquí se mostrará la factura asociada"
      textoBoton={puedeConvertir ? "Convertir en factura" : undefined}
      onAccion={puedeConvertir ? onConvertir : undefined}
    />
  );
}

function ContenidoConduceRelacionado({
  remision,
  puedeConvertir,
  onConvertir,
}: {
  remision: DocumentoRelacionado | null;
  puedeConvertir: boolean;
  onConvertir: () => void;
}) {
  if (remision) return <TablaDocumentoRelacionado documento={remision} tipo="conduce" />;

  return (
    <EstadoVacio
      mensaje="Aquí se mostrará el conduce asociado"
      textoBoton={puedeConvertir ? "Convertir en conduce" : undefined}
      onAccion={puedeConvertir ? onConvertir : undefined}
    />
  );
}

function PanelDocumento({
  tipo,
  facturaRelacionada,
  cotizacionOrigen,
  remisionRelacionada,
  puedeConvertir,
  puedeConvertirEnConduce,
  onConvertir,
  onConvertirEnConduce,
}: {
  tipo: "cotizacion" | "conduce";
  facturaRelacionada: FacturaRelacionada | null;
  cotizacionOrigen: DocumentoRelacionado | null;
  remisionRelacionada: DocumentoRelacionado | null;
  puedeConvertir: boolean;
  puedeConvertirEnConduce: boolean;
  onConvertir: () => void;
  onConvertirEnConduce: () => void;
}) {
  return (
    <Card className="bg-card gap-0 rounded-[12px] border border-slate-400/20 px-2 pt-2 pb-6 shadow-none ring-0 [--card-spacing:0px] sm:px-8 sm:pb-8">
      <Tabs defaultValue="facturas" className="gap-0">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-slate-300 p-0"
        >
          <TabsTrigger value="facturas" className={PESTANA}>
            Facturas
          </TabsTrigger>
          {tipo === "cotizacion" ? (
            <TabsTrigger value="conduces" className={PESTANA}>
              Conduces
            </TabsTrigger>
          ) : null}
          {tipo === "conduce" && cotizacionOrigen ? (
            <TabsTrigger value="cotizacion" className={PESTANA}>
              Cotización
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="facturas" className="mt-6">
          <ContenidoFacturaRelacionada
            factura={facturaRelacionada}
            puedeConvertir={puedeConvertir}
            onConvertir={onConvertir}
          />
        </TabsContent>

        {tipo === "cotizacion" ? (
          <TabsContent value="conduces" className="mt-6">
            <ContenidoConduceRelacionado
              remision={remisionRelacionada}
              puedeConvertir={puedeConvertirEnConduce}
              onConvertir={onConvertirEnConduce}
            />
          </TabsContent>
        ) : null}

        {tipo === "conduce" && cotizacionOrigen ? (
          <TabsContent value="cotizacion" className="mt-6">
            <TablaDocumentoRelacionado documento={cotizacionOrigen} tipo="cotizacion" />
          </TabsContent>
        ) : null}
      </Tabs>
    </Card>
  );
}

function DialogoConvertir({
  abierto,
  onOpenChange,
  nombreDocumento,
  tipoComprobante,
  onTipoComprobante,
  pendiente,
  error,
  onSubmit,
  onCancel,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  nombreDocumento: string;
  tipoComprobante: string;
  onTipoComprobante: (valor: string) => void;
  pendiente: boolean;
  error: string | null;
  onSubmit: (evento: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convertir {nombreDocumento} a factura</DialogTitle>
          <DialogDescription>
            Se creará una factura con el mismo cliente, fechas y líneas. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tipo-comprobante">Tipo de comprobante</Label>
            <Select
              items={COMPROBANTES.map((opcion) => ({ value: opcion.value, label: opcion.label }))}
              value={tipoComprobante}
              disabled={pendiente}
              onValueChange={(valor: string | null) => {
                if (valor) onTipoComprobante(valor);
              }}
            >
              <SelectTrigger id="tipo-comprobante" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {COMPROBANTES.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">El NCF se asigna al crear la factura.</p>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pendiente} onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              Convertir en factura
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoAnular({
  abierto,
  onOpenChange,
  numero,
  pendiente,
  error,
  onAnular,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  numero: number;
  pendiente: boolean;
  error: string | null;
  onAnular: () => void;
}) {
  return (
    <AlertDialog open={abierto} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular la factura #{numero}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se creará un asiento de anulación y el NCF quedará sin efecto. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pendiente} onClick={onAnular}>
            {pendiente ? <Loader2 className="animate-spin" /> : null}
            Anular factura
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface VistaPreparada {
  factura: FacturaDetalle | null;
  documento: DocumentoDetalle | null;
  base: FacturaDetalle | DocumentoDetalle;
  lineas: FacturaLinea[];
  contacto: ContactoResumen;
  empresa: Empresa | null;
  pagos: PagoFacturaVista[];
  notasCredito: NotaVentaResumen[];
  notasDebito: NotaVentaResumen[];
  asiento: AsientoVista | null;
  facturaRelacionada: FacturaRelacionada | null;
  cotizacionOrigen: DocumentoRelacionado | null;
  remisionRelacionada: DocumentoRelacionado | null;
  resumen: ReturnType<typeof resumenFactura> | null;
  estado: ReturnType<typeof estadoDeFactura>;
  descuento: number;
  permisos: ReturnType<typeof permisosDeFactura>;
  titulo: string;
  numeroDocumento: string;
  nombreArchivo: string;
  rutaVolver: string;
  etiquetaVolver: string;
  tituloInformacion: string;
}

function prepararVista(props: Props): VistaPreparada | null {
  let factura: FacturaDetalle | null = null;
  let documento: DocumentoDetalle | null = null;
  let pagos: PagoFacturaVista[] = [];
  let notasCredito: NotaVentaResumen[] = [];
  let notasDebito: NotaVentaResumen[] = [];
  let asiento: AsientoVista | null = null;
  let facturaRelacionada: FacturaRelacionada | null = null;
  let cotizacionOrigen: DocumentoRelacionado | null = null;
  let remisionRelacionada: DocumentoRelacionado | null = null;

  if (props.tipo === "factura") {
    factura = props.datos.factura;
    pagos = props.datos.pagos;
    notasCredito = props.datos.notasCredito;
    notasDebito = props.datos.notasDebito;
    asiento = props.datos.asiento;
  } else {
    documento = props.datos.documento;
    facturaRelacionada = props.datos.facturaRelacionada;
    cotizacionOrigen = props.datos.cotizacionOrigen;
    remisionRelacionada = props.datos.remisionRelacionada;
  }

  const base = factura ?? documento;
  if (!base) return null;

  const lineas: FacturaLinea[] = props.datos.lineas;
  const resumen = factura ? resumenFactura(factura) : null;
  const saldoPorCobrar = resumen?.porCobrar ?? 0;
  const tipo = props.tipo;

  return {
    factura,
    documento,
    base,
    lineas,
    contacto: props.datos.contacto,
    empresa: props.datos.empresa,
    pagos,
    notasCredito,
    notasDebito,
    asiento,
    facturaRelacionada,
    cotizacionOrigen,
    remisionRelacionada,
    resumen,
    estado: factura
      ? estadoDeFactura(factura.estado, saldoPorCobrar)
      : estadoDeDocumento(base.estado, facturaRelacionada != null),
    descuento: factura ? factura.descuento : descuentoDeLineas(lineas),
    permisos:
      props.tipo === "factura"
        ? permisosDeFactura(base.estado, saldoPorCobrar, props.puedeEscribir)
        : permisosDeDocumento(base.estado, props.puedeEscribir, props.tipo),
    titulo: factura
      ? `${tituloTipoComprobante(factura.tipo_comprobante)}${factura.ncf ? ` NCF ${factura.ncf}` : ""}`
      : `${TITULOS_DOCUMENTO[tipo]} ${base.numero}`,
    numeroDocumento: factura ? (factura.ncf ?? String(factura.numero)) : String(base.numero),
    nombreArchivo: nombreArchivoPapel(tipo, base.numero, factura?.ncf ?? null),
    rutaVolver: RUTAS_VOLVER[tipo],
    etiquetaVolver: ETIQUETAS_VOLVER[tipo],
    tituloInformacion: TITULOS_INFORMACION[tipo],
  };
}

function useAccionesVista({
  tipo,
  documento,
  factura,
  titulo,
  nombreArchivo,
}: {
  tipo: TipoVistaDocumento;
  documento: DocumentoDetalle | null;
  factura: FacturaDetalle | null;
  titulo: string;
  nombreArchivo: string;
}) {
  const router = useRouter();
  const [convertirAbierto, setConvertirAbierto] = useState(false);
  const [anularAbierto, setAnularAbierto] = useState(false);
  const [tipoComprobante, setTipoComprobante] = useState("02");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function imprimir() {
    window.print();
  }

  function descargarPdf() {
    const tituloAnterior = document.title;
    document.title = nombreArchivo;
    try {
      window.print();
    } finally {
      document.title = tituloAnterior;
    }
  }

  function navegar(ruta: string) {
    router.push(ruta);
  }

  async function compartir() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.add({ title: "Enlace copiado" });
    } catch (fallo) {
      if (fallo instanceof DOMException && fallo.name === "AbortError") return;
      toast.add({ type: "error", title: "No se pudo compartir el enlace" });
    }
  }

  function abrirConvertir() {
    setError(null);
    setConvertirAbierto(true);
  }

  function convertirEnConduce() {
    if (tipo !== "cotizacion" || !documento) return;
    router.push(`/dashboard/conduces/nueva?cotizacion=${encodeURIComponent(documento.id)}`);
  }

  function clonar() {
    const id = factura?.id ?? documento?.id;
    if (!id) return;

    const ruta =
      tipo === "factura"
        ? "/dashboard/facturacion/nueva"
        : `/dashboard/${tipo === "cotizacion" ? "cotizaciones" : "conduces"}/nueva`;
    router.push(`${ruta}?clonar=${encodeURIComponent(id)}`);
  }

  function cambiarConvertir(abierto: boolean) {
    setError(null);
    setConvertirAbierto(abierto);
  }

  function cambiarAnular(abierto: boolean) {
    setError(null);
    setAnularAbierto(abierto);
  }

  function convertir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (tipo === "factura" || !documento) return;

    setError(null);
    iniciar(async () => {
      const resultado =
        tipo === "cotizacion"
          ? await convertirCotizacionAFactura(documento.id, tipoComprobante)
          : await convertirRemisionAFactura(documento.id, tipoComprobante);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setConvertirAbierto(false);
      router.push(`/dashboard/facturacion/${resultado.id}`);
    });
  }

  function anular() {
    if (!factura) return;

    setError(null);
    iniciar(async () => {
      const resultado = await anularFactura(factura.id);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setAnularAbierto(false);
      router.refresh();
    });
  }

  return {
    convertirAbierto,
    anularAbierto,
    tipoComprobante,
    setTipoComprobante,
    error,
    pendiente,
    imprimir,
    descargarPdf,
    navegar,
    compartir,
    abrirConvertir,
    convertirEnConduce,
    clonar,
    cambiarConvertir,
    cambiarAnular,
    convertir,
    anular,
  };
}

export function VistaDocumentoVenta(props: Props) {
  const preparado = prepararVista(props);
  const acciones = useAccionesVista({
    tipo: props.tipo,
    documento: preparado?.documento ?? null,
    factura: preparado?.factura ?? null,
    titulo: preparado?.titulo ?? "",
    nombreArchivo: preparado?.nombreArchivo ?? "documento",
  });
  const papel = props.papel;

  if (!preparado) return null;

  const { factura, base, lineas, contacto, empresa, pagos, notasCredito, notasDebito, asiento } = preparado;
  const tipoDocumento = props.tipo === "factura" ? null : props.tipo;
  const documentoId = factura?.id ?? preparado.documento?.id ?? null;

  let panel: ReactNode = null;
  if (factura) {
    panel = <PanelFactura pagos={pagos} notasCredito={notasCredito} notasDebito={notasDebito} asiento={asiento} />;
  } else if (tipoDocumento) {
    panel = (
      <PanelDocumento
        tipo={tipoDocumento}
        facturaRelacionada={preparado.facturaRelacionada}
        cotizacionOrigen={preparado.cotizacionOrigen}
        remisionRelacionada={preparado.remisionRelacionada}
        puedeConvertir={preparado.permisos.convertir}
        puedeConvertirEnConduce={preparado.permisos.convertirEnConduce}
        onConvertir={acciones.abrirConvertir}
        onConvertirEnConduce={acciones.convertirEnConduce}
      />
    );
  }

  return (
    <div className="bg-muted/40 -m-4 p-4 md:-m-6 md:p-6 print:m-0 print:bg-transparent print:p-0">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 [font-family:var(--font-inter)] print:hidden">
        <EncabezadoVista
          titulo={preparado.titulo}
          estado={preparado.estado}
          rutaVolver={preparado.rutaVolver}
          etiquetaVolver={preparado.etiquetaVolver}
          acciones={
            <AccionesDocumento
              tipo={props.tipo}
              esFactura={factura != null}
              facturaId={factura?.id ?? null}
              documentoId={documentoId}
              contactoId={factura?.contacto_id ?? null}
              facturaRelacionada={preparado.facturaRelacionada}
              puedePagar={preparado.permisos.pagar}
              puedeNotaCredito={preparado.permisos.notaCredito}
              puedeNotaDebito={preparado.permisos.notaDebito}
              puedeAnular={preparado.permisos.anular}
              puedeConvertir={preparado.permisos.convertir}
              puedeConvertirEnConduce={preparado.permisos.convertirEnConduce}
              puedeEditar={preparado.permisos.editar}
              puedeClonar={preparado.permisos.clonar}
              pendiente={acciones.pendiente}
              onNavegar={acciones.navegar}
              onDescargarPdf={acciones.descargarPdf}
              onImprimir={acciones.imprimir}
              onCompartir={() => void acciones.compartir()}
              onAbrirConvertir={acciones.abrirConvertir}
              onConvertirEnConduce={acciones.convertirEnConduce}
              onClonar={acciones.clonar}
              onAnular={() => {
                acciones.cambiarAnular(true);
              }}
            />
          }
        />

        {preparado.resumen ? (
          <ResumenFactura resumen={preparado.resumen} notasCredito={notasCredito} notasDebito={notasDebito} />
        ) : null}

        <DocumentoVentaCard
          empresa={empresa}
          numeroDocumento={preparado.numeroDocumento}
          tituloInformacion={preparado.tituloInformacion}
          contacto={contacto}
          fecha={base.fecha}
          vencimiento={base.vencimiento}
          columnas={factura ? 3 : 2}
          lineas={lineas}
          subtotal={base.subtotal}
          descuento={preparado.descuento}
          itbis={base.itbis}
          total={base.total}
        />

        {panel}
      </div>

      <DialogoConvertir
        abierto={acciones.convertirAbierto}
        onOpenChange={acciones.cambiarConvertir}
        nombreDocumento={NOMBRES_DOCUMENTO[props.tipo]}
        tipoComprobante={acciones.tipoComprobante}
        onTipoComprobante={acciones.setTipoComprobante}
        pendiente={acciones.pendiente}
        error={acciones.error}
        onSubmit={acciones.convertir}
        onCancel={() => acciones.cambiarConvertir(false)}
      />

      <DialogoAnular
        abierto={acciones.anularAbierto}
        onOpenChange={acciones.cambiarAnular}
        numero={factura?.numero ?? 0}
        pendiente={acciones.pendiente}
        error={acciones.error}
        onAnular={acciones.anular}
      />

      <PortalImpresion>{papel}</PortalImpresion>
    </div>
  );
}
