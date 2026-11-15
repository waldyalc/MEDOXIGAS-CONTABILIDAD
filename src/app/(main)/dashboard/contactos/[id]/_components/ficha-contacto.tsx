"use client";

import { useState } from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  ChevronDown,
  Download,
  EllipsisVertical,
  Eye,
  File,
  FileBarChart,
  FilePlus2,
  FileText,
  Hash,
  LayoutGrid,
  ListFilter,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Upload,
  User,
  Users,
} from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { etiquetaTipoContacto } from "@/lib/contactos/contactos";
import {
  type AsientoFicha,
  aCentavos,
  type CuentaFicha,
  type DatosFichaContacto,
  type DocumentoComercialFicha,
  type DocumentoFicha,
  etiquetaEstadoComercial,
  etiquetaEstadoDocumento,
  etiquetaEstadoPago,
  type NotaFicha,
  type PagoFicha,
  type TipoNotaFicha,
  totalAnticipos,
  totalPorCobrar,
  totalPorPagar,
} from "@/lib/contactos/ficha";
import {
  rutaAsiento,
  rutaCompra,
  rutaConduce,
  rutaContacto,
  rutaCotizacion,
  rutaCuenta,
  rutaFactura,
  rutaNotaCreditoCompra,
  rutaNotaCreditoVenta,
  rutaNotaDebitoVenta,
  rutaPagoProveedor,
  rutaPagoRecibido,
} from "@/lib/enlaces";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

type TipoFila =
  | "factura"
  | "compra"
  | "cotizacion"
  | "conduce"
  | "nota"
  | "pago-recibido"
  | "pago-proveedor"
  | "asiento";

const ETIQUETA_TIPO_FILA: Record<TipoFila, string> = {
  factura: "Factura",
  compra: "Compra",
  cotizacion: "Cotización",
  conduce: "Conduce",
  nota: "Nota",
  "pago-recibido": "Pago",
  "pago-proveedor": "Pago",
  asiento: "Asiento",
};

const CLASE_TIPO_FILA: Record<TipoFila, string> = {
  factura: "bg-primary/10 text-primary",
  compra: "bg-primary/10 text-primary",
  cotizacion: "bg-secondary text-secondary-foreground",
  conduce: "bg-secondary text-secondary-foreground",
  nota: "bg-secondary text-secondary-foreground",
  "pago-recibido": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "pago-proveedor": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  asiento: "bg-secondary text-secondary-foreground",
};

const PREFIJO_NOTA: Record<TipoNotaFicha, string> = {
  credito: "NCR",
  debito: "NDB",
  credito_compra: "NCC",
};

interface FilaUnificada {
  clave: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  tipo: TipoFila;
  prefijo: string;
  detalle: string;
  montoCentavos: number;
  estado: string;
  href: string;
  direccion: "cargo" | "abono";
}

const TX_POR_PAGINA = 10;
const PERSONAS_POR_PAGINA = 5;
const DOCS_POR_PAGINA = 8;

const TH = "text-muted-foreground text-xs font-medium tracking-wider uppercase";

function detalleNota(nota: NotaFicha): string {
  if (nota.tipo === "credito") return "Nota de crédito";
  if (nota.tipo === "debito") return "Nota de débito";
  return "Nota de crédito de compra";
}

function detallePagoRecibido(pago: PagoFicha): string {
  if (pago.factura_numero == null) return "Anticipo";
  return `Pago de factura #${pago.factura_numero}`;
}

function detallePagoProveedor(pago: PagoFicha): string {
  if (pago.factura_numero == null) return "Pago a proveedor";
  return `Pago de factura #${pago.factura_numero}`;
}

function facturasAFilas(facturas: readonly DocumentoFicha[], tipo: "factura" | "compra"): FilaUnificada[] {
  const esVenta = tipo === "factura";
  return facturas.map((fila) => ({
    clave: `${tipo}-${fila.id}`,
    numero: fila.numero,
    ncf: fila.ncf,
    fecha: fila.fecha,
    tipo,
    prefijo: esVenta ? "FAC" : "COM",
    detalle: esVenta ? "Factura de venta" : "Factura de proveedor",
    montoCentavos: aCentavos(fila.total),
    estado: fila.estado,
    href: esVenta ? rutaFactura(fila.id) : rutaCompra(fila.id),
    direccion: "cargo",
  }));
}

function comercialesAFilas(filas: readonly DocumentoComercialFicha[], tipo: "cotizacion" | "conduce"): FilaUnificada[] {
  return filas.map((fila) => ({
    clave: `${tipo}-${fila.id}`,
    numero: fila.numero,
    ncf: null,
    fecha: fila.fecha,
    tipo,
    prefijo: tipo === "cotizacion" ? "COT" : "CON",
    detalle: tipo === "cotizacion" ? "Cotización" : "Conduce",
    montoCentavos: aCentavos(fila.total),
    estado: fila.estado,
    href: tipo === "cotizacion" ? rutaCotizacion(fila.id) : rutaConduce(fila.id),
    direccion: "cargo",
  }));
}

function rutaNota(nota: NotaFicha): string {
  if (nota.tipo === "credito") return rutaNotaCreditoVenta(nota.id);
  if (nota.tipo === "debito") return rutaNotaDebitoVenta(nota.id);
  return rutaNotaCreditoCompra(nota.id);
}

function notasAFilas(notas: readonly NotaFicha[]): FilaUnificada[] {
  return notas.map((fila) => ({
    clave: `nota-${fila.tipo}-${fila.id}`,
    numero: fila.numero,
    ncf: fila.ncf,
    fecha: fila.fecha,
    tipo: "nota",
    prefijo: PREFIJO_NOTA[fila.tipo],
    detalle: detalleNota(fila),
    montoCentavos: aCentavos(fila.total),
    estado: fila.estado,
    href: rutaNota(fila),
    direccion: fila.tipo === "debito" ? "cargo" : "abono",
  }));
}

function pagosAFilas(pagos: readonly PagoFicha[], tipo: "pago-recibido" | "pago-proveedor"): FilaUnificada[] {
  return pagos.map((fila) => ({
    clave: `${tipo}-${fila.id}`,
    numero: fila.numero,
    ncf: null,
    fecha: fila.fecha,
    tipo,
    prefijo: "PAG",
    detalle: tipo === "pago-recibido" ? detallePagoRecibido(fila) : detallePagoProveedor(fila),
    montoCentavos: aCentavos(fila.monto),
    estado: fila.estado,
    href: tipo === "pago-recibido" ? rutaPagoRecibido(fila.id) : rutaPagoProveedor(fila.id),
    direccion: "abono",
  }));
}

function asientosAFilas(asientos: readonly AsientoFicha[]): FilaUnificada[] {
  return asientos.map((fila) => ({
    clave: `asiento-${fila.id}`,
    numero: fila.numero,
    ncf: null,
    fecha: fila.fecha,
    tipo: "asiento",
    prefijo: "ASI",
    detalle: fila.descripcion,
    montoCentavos: fila.debitoCentavos,
    estado: "activo",
    href: rutaAsiento(fila.id),
    direccion: "cargo",
  }));
}

function construirFilas(datos: DatosFichaContacto): FilaUnificada[] {
  const filas: FilaUnificada[] = [
    ...facturasAFilas(datos.facturas, "factura"),
    ...facturasAFilas(datos.facturasProveedor, "compra"),
    ...comercialesAFilas(datos.cotizaciones, "cotizacion"),
    ...comercialesAFilas(datos.conduces, "conduce"),
    ...notasAFilas(datos.notasVenta),
    ...notasAFilas(datos.notasCompra),
    ...pagosAFilas(datos.pagosRecibidos, "pago-recibido"),
    ...pagosAFilas(datos.pagosProveedor, "pago-proveedor"),
    ...asientosAFilas(datos.asientos),
  ];
  return filas.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero - a.numero);
}

function TipoBadge({ tipo }: { readonly tipo: TipoFila }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", CLASE_TIPO_FILA[tipo])}>
      {ETIQUETA_TIPO_FILA[tipo]}
    </Badge>
  );
}

function EstadoFilaBadge({ estado, tipo }: { readonly estado: string; readonly tipo: TipoFila }) {
  let etiqueta: string;
  if (tipo === "factura" || tipo === "compra")
    etiqueta = etiquetaEstadoDocumento(estado, tipo === "factura" ? "venta" : "compra");
  else if (tipo === "cotizacion" || tipo === "conduce") etiqueta = etiquetaEstadoComercial(estado);
  else etiqueta = etiquetaEstadoPago(estado);

  if (estado === "anulada" || estado === "anulado") return <Badge variant="destructive">{etiqueta}</Badge>;
  if (estado === "pagada" || estado === "convertida") {
    return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{etiqueta}</Badge>;
  }
  return <Badge variant="secondary">{etiqueta}</Badge>;
}

function MetaItem({ icono, texto }: { readonly icono: React.ReactNode; readonly texto: string }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
      {icono}
      {texto}
    </span>
  );
}

function usePagina(total: number, porPagina: number): { pagina: number; setPagina: (p: number) => void } {
  const [pagina, setPagina] = useState(0);
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  return { pagina: Math.min(pagina, paginas - 1), setPagina };
}

function PiePagina({
  total,
  porPagina,
  pagina,
  setPagina,
  unidad,
}: {
  readonly total: number;
  readonly porPagina: number;
  readonly pagina: number;
  readonly setPagina: (p: number) => void;
  readonly unidad: string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const enPagina = Math.max(0, Math.min(porPagina, total - pagina * porPagina));
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm">
        Mostrando {enPagina} de {total} {unidad}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>
          Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={pagina >= paginas - 1} onClick={() => setPagina(pagina + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}

interface OpcionFiltro {
  readonly valor: string;
  readonly etiqueta: string;
}

function BotonFiltro({
  valor,
  opciones,
  onCambiar,
}: {
  readonly valor: string;
  readonly opciones: readonly OpcionFiltro[];
  readonly onCambiar: (valor: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <ListFilter data-icon="inline-start" />
        Filtrar
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuRadioGroup value={valor} onValueChange={(nuevo) => onCambiar(String(nuevo))}>
          {opciones.map((opcion) => (
            <DropdownMenuRadioItem key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface AccionEnlace {
  readonly etiqueta: string;
  readonly href: string;
  readonly icono: React.ReactNode;
}

function accionesFicha(
  contacto: DatosFichaContacto["contacto"],
  puedeCrear: boolean,
  esVenta: boolean,
  esCompra: boolean,
): { primaria: AccionEnlace; secundarias: AccionEnlace[] } {
  const estadoCuenta: AccionEnlace = {
    etiqueta: "Estado de cuenta",
    href: `${rutaContacto(contacto.id)}/estado-cuenta`,
    icono: <FileText />,
  };
  const nuevaCompra: AccionEnlace = {
    etiqueta: "Nueva compra",
    href: "/dashboard/compras/nueva",
    icono: <ShoppingCart />,
  };

  if (puedeCrear && esVenta) {
    const secundarias: AccionEnlace[] = [];
    if (esCompra) secundarias.push(nuevaCompra);
    secundarias.push(estadoCuenta);
    return {
      primaria: {
        etiqueta: "Nueva factura",
        href: `/dashboard/facturacion/nueva?cliente=${contacto.id}`,
        icono: <FilePlus2 />,
      },
      secundarias,
    };
  }
  if (puedeCrear && esCompra) return { primaria: nuevaCompra, secundarias: [estadoCuenta] };
  return { primaria: estadoCuenta, secundarias: [] };
}

function EncabezadoFicha({
  contacto,
  primaria,
  secundarias,
}: {
  readonly contacto: DatosFichaContacto["contacto"];
  readonly primaria: AccionEnlace;
  readonly secundarias: readonly AccionEnlace[];
}) {
  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3.5">
        <div className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-lg">
          <Building2 className="size-6" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{contacto.nombre}</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Activo
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <MetaItem icono={<Hash className="size-3.5" />} texto={`RNC: ${contacto.rnc_cedula ?? "—"}`} />
            <MetaItem icono={<Phone className="size-3.5" />} texto={contacto.telefono ?? "Sin teléfono"} />
            <MetaItem icono={<Mail className="size-3.5" />} texto={contacto.correo ?? "Sin correo"} />
            <MetaItem icono={<MapPin className="size-3.5" />} texto={contacto.direccion ?? "Sin dirección"} />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button render={<Link href={primaria.href} prefetch={false} />}>
          {primaria.icono}
          {primaria.etiqueta}
        </Button>
        {secundarias.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Más acciones" />}>
              <EllipsisVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {secundarias.map((accion) => (
                <DropdownMenuItem key={accion.etiqueta} render={<Link href={accion.href} prefetch={false} />}>
                  {accion.icono}
                  {accion.etiqueta}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

function ItemPestana({
  activo,
  icono,
  etiqueta,
  onClick,
}: {
  readonly activo: boolean;
  readonly icono: React.ReactNode;
  readonly etiqueta: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "text-muted-foreground hover:text-foreground relative inline-flex h-11 items-center gap-1.5 px-3 text-sm font-medium transition-colors",
        activo && "text-primary hover:text-primary",
      )}
    >
      {icono}
      {etiqueta}
      <span
        className={cn(
          "bg-primary absolute inset-x-3 bottom-0 h-0.5 rounded-t-full opacity-0 transition-opacity",
          activo && "opacity-100",
        )}
      />
    </button>
  );
}

function CuentaEnlace({ cuenta }: { readonly cuenta: CuentaFicha | null }) {
  if (!cuenta) return <span className="text-muted-foreground">—</span>;
  return (
    <Enlace href={rutaCuenta(cuenta.id)} className="font-medium">
      {cuenta.codigo} · {cuenta.nombre}
    </Enlace>
  );
}

function ItemDato({ etiqueta, children }: { readonly etiqueta: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{etiqueta}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

function ContenidoResumen({
  contacto,
  cuentaCxc,
  cuentaCxp,
}: {
  readonly contacto: DatosFichaContacto["contacto"];
  readonly cuentaCxc: CuentaFicha | null;
  readonly cuentaCxp: CuentaFicha | null;
}) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Información general</h2>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <ItemDato etiqueta="Nombre">{contacto.nombre}</ItemDato>
          <ItemDato etiqueta="Tipo">{etiquetaTipoContacto(contacto.tipo)}</ItemDato>
          <ItemDato etiqueta="RNC / Cédula">
            <span className="tabular-nums">{contacto.rnc_cedula ?? "—"}</span>
          </ItemDato>
          <ItemDato etiqueta="Teléfono">
            <span className="tabular-nums">{contacto.telefono ?? "—"}</span>
          </ItemDato>
          <ItemDato etiqueta="Correo">{contacto.correo ?? "—"}</ItemDato>
          <ItemDato etiqueta="Dirección">
            <span className="whitespace-pre-line">{contacto.direccion ?? "—"}</span>
          </ItemDato>
        </dl>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Contabilidad</h2>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <ItemDato etiqueta="Cuenta por cobrar (CxC)">
            <CuentaEnlace cuenta={cuentaCxc} />
          </ItemDato>
          <ItemDato etiqueta="Cuenta por pagar (CxP)">
            <CuentaEnlace cuenta={cuentaCxp} />
          </ItemDato>
        </dl>
      </section>
    </div>
  );
}

type TonoStat = "normal" | "positivo" | "pendiente";

interface StatMontoDef {
  readonly etiqueta: string;
  readonly centavos: number;
  readonly tono: TonoStat;
}

const CLASE_TONO_STAT: Record<TonoStat, string> = {
  normal: "text-foreground",
  positivo: "text-emerald-600 dark:text-emerald-400",
  pendiente: "text-red-500",
};

function StatMonto({ etiqueta, centavos, tono }: StatMontoDef) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{etiqueta}</span>
      <span className={cn("text-xl font-semibold tabular-nums", CLASE_TONO_STAT[tono])}>
        {formatoMonedaCentavos(centavos)}
      </span>
    </div>
  );
}

function construirStats(
  datos: DatosFichaContacto,
  esVenta: boolean,
  esCompra: boolean,
): { izquierda: StatMontoDef[]; derecha: StatMontoDef[] } {
  const izquierda: StatMontoDef[] = [];
  const derecha: StatMontoDef[] = [];

  if (esVenta) {
    izquierda.push({
      etiqueta: "Total facturado",
      centavos: datos.facturas.reduce((t, f) => (f.estado === "anulada" ? t : t + aCentavos(f.total)), 0),
      tono: "normal",
    });
    derecha.push(
      {
        etiqueta: "Total cobrado",
        centavos: datos.facturas.reduce((t, f) => (f.estado === "anulada" ? t : t + aCentavos(f.pagado)), 0),
        tono: "positivo",
      },
      { etiqueta: "Por cobrar", centavos: totalPorCobrar(datos.facturas), tono: "pendiente" },
    );
    const anticipos = totalAnticipos(datos.pagosRecibidos);
    if (anticipos > 0) derecha.push({ etiqueta: "Anticipos", centavos: anticipos, tono: "normal" });
  }

  if (esCompra) {
    const comprado = datos.facturasProveedor.reduce((t, f) => (f.estado === "anulada" ? t : t + aCentavos(f.total)), 0);
    const pagado = datos.facturasProveedor.reduce((t, f) => (f.estado === "anulada" ? t : t + aCentavos(f.pagado)), 0);
    if (esVenta) derecha.push({ etiqueta: "Total comprado", centavos: comprado, tono: "normal" });
    else izquierda.push({ etiqueta: "Total comprado", centavos: comprado, tono: "normal" });
    derecha.push(
      { etiqueta: "Total pagado", centavos: pagado, tono: "positivo" },
      { etiqueta: "Por pagar", centavos: totalPorPagar(datos.facturasProveedor), tono: "pendiente" },
    );
  }

  return { izquierda, derecha };
}

function coincidenTexto(fila: FilaUnificada, texto: string): boolean {
  if (texto === "") return true;
  const id = `${fila.prefijo}-${fila.numero}`.toLowerCase();
  return (
    id.includes(texto) ||
    String(fila.numero).includes(texto) ||
    (fila.ncf ?? "").toLowerCase().includes(texto) ||
    fila.detalle.toLowerCase().includes(texto)
  );
}

function PestanaTransacciones({
  filas,
  filtroTipo,
  statsIzquierda,
  statsDerecha,
}: {
  readonly filas: readonly FilaUnificada[];
  readonly filtroTipo: string;
  readonly statsIzquierda: readonly StatMontoDef[];
  readonly statsDerecha: readonly StatMontoDef[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const texto = busqueda.trim().toLowerCase();
  const filtradas = filas.filter((fila) => {
    if (filtroTipo !== "todos" && fila.tipo !== filtroTipo) return false;
    return coincidenTexto(fila, texto);
  });
  const { pagina, setPagina } = usePagina(filtradas.length, TX_POR_PAGINA);
  const visibles = filtradas.slice(pagina * TX_POR_PAGINA, (pagina + 1) * TX_POR_PAGINA);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap justify-between gap-x-10 gap-y-4">
        <div className="flex w-full max-w-xs flex-col gap-4">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar transacciones…"
              aria-label="Buscar transacciones"
              className="pl-8"
            />
          </div>
          {statsIzquierda.map((stat) => (
            <StatMonto key={stat.etiqueta} {...stat} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          {statsDerecha.map((stat) => (
            <StatMonto key={stat.etiqueta} {...stat} />
          ))}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={TH}>Transacción</TableHead>
            <TableHead className={TH}>Fecha</TableHead>
            <TableHead className={TH}>Tipo</TableHead>
            <TableHead className={TH}>Descripción</TableHead>
            <TableHead className={cn(TH, "text-right")}>Monto</TableHead>
            <TableHead className={TH}>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                No hay transacciones.
              </TableCell>
            </TableRow>
          ) : (
            visibles.map((fila) => (
              <TableRow key={fila.clave} className="relative cursor-pointer">
                <TableCell>
                  <Enlace
                    className="absolute inset-0"
                    href={fila.href}
                    aria-label={`Ver ${fila.detalle} ${fila.prefijo}-${fila.numero}`}
                  />
                  <span className="pointer-events-none relative flex flex-col">
                    <span className="text-primary font-medium">
                      {fila.prefijo}-{String(fila.numero).padStart(4, "0")}
                    </span>
                    {fila.ncf ? <span className="text-muted-foreground font-mono text-xs">{fila.ncf}</span> : null}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatoDia(fila.fecha)}</TableCell>
                <TableCell>
                  <TipoBadge tipo={fila.tipo} />
                </TableCell>
                <TableCell className="whitespace-normal">{fila.detalle}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {fila.direccion === "abono" ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      -{formatoMonedaCentavos(fila.montoCentavos)}
                    </span>
                  ) : (
                    formatoMonedaCentavos(fila.montoCentavos)
                  )}
                </TableCell>
                <TableCell>
                  <EstadoFilaBadge estado={fila.estado} tipo={fila.tipo} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <PiePagina
        total={filtradas.length}
        porPagina={TX_POR_PAGINA}
        pagina={pagina}
        setPagina={setPagina}
        unidad="transacciones"
      />
    </div>
  );
}

interface PersonaContacto {
  nombre: string;
  puesto: string;
  departamento: string;
  correo: string;
  telefono: string;
  principal: boolean;
}

// TODO backend: no existe tabla de personas de contacto por cliente; datos de ejemplo del diseño.
const PERSONAS_EJEMPLO: PersonaContacto[] = [
  {
    nombre: "Ana García",
    puesto: "Gerente de compras",
    departamento: "Compras",
    correo: "ana.garcia@empresa.com",
    telefono: "+1 (809) 555-0101",
    principal: false,
  },
  {
    nombre: "Luis Peña",
    puesto: "Contador",
    departamento: "Finanzas",
    correo: "luis.pena@empresa.com",
    telefono: "+1 (809) 555-0102",
    principal: false,
  },
  {
    nombre: "María Santos",
    puesto: "Asistente administrativa",
    departamento: "Operaciones",
    correo: "maria.santos@empresa.com",
    telefono: "+1 (809) 555-0103",
    principal: false,
  },
  {
    nombre: "Carlos Núñez",
    puesto: "Director de TI",
    departamento: "Tecnología",
    correo: "carlos.nunez@empresa.com",
    telefono: "+1 (809) 555-0104",
    principal: false,
  },
  {
    nombre: "Rosa Díaz",
    puesto: "Asesora legal",
    departamento: "Legal",
    correo: "rosa.diaz@empresa.com",
    telefono: "+1 (809) 555-0105",
    principal: false,
  },
];

function AvatarPersona({ className }: { readonly className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarFallback className="bg-primary/10 text-primary">
        <User className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}

function TarjetaPersona({ persona }: { readonly persona: PersonaContacto }) {
  return (
    <div className="ring-foreground/10 bg-card relative flex flex-col gap-3 rounded-xl p-4 ring-1">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Opciones de ${persona.nombre}`}
        className="absolute top-3 right-3"
      >
        <EllipsisVertical />
      </Button>
      <div className="flex items-start gap-3">
        <AvatarPersona />
        <div className="flex min-w-0 flex-col">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{persona.nombre}</span>
            {persona.principal ? <Badge className="bg-primary/10 text-primary">Principal</Badge> : null}
          </p>
          <p className="text-muted-foreground text-sm">{persona.puesto}</p>
          <p className="text-muted-foreground text-sm">{persona.departamento}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="inline-flex items-center gap-2">
          <Mail className="text-muted-foreground size-3.5" />
          <span className="text-primary truncate">{persona.correo}</span>
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-2">
          <Phone className="size-3.5" />
          <span className="tabular-nums">{persona.telefono}</span>
        </span>
      </div>
    </div>
  );
}

function PestanaContactos({ contacto }: { readonly contacto: DatosFichaContacto["contacto"] }) {
  // TODO backend: cuando exista la tabla de personas, reemplazar PERSONAS_EJEMPLO por los datos reales.
  const personas: PersonaContacto[] = [
    {
      nombre: contacto.nombre,
      puesto: "Contacto principal",
      departamento: "—",
      correo: contacto.correo ?? "—",
      telefono: contacto.telefono ?? "—",
      principal: true,
    },
    ...PERSONAS_EJEMPLO,
  ];
  const { pagina, setPagina } = usePagina(personas.length, PERSONAS_POR_PAGINA);
  const visibles = personas.slice(pagina * PERSONAS_POR_PAGINA, (pagina + 1) * PERSONAS_POR_PAGINA);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold">Personas de contacto</h2>
        <p className="text-muted-foreground text-sm">Administra los contactos clave de este cliente.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {personas.map((persona) => (
          <TarjetaPersona key={`${persona.nombre}-${persona.correo}`} persona={persona} />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Todos los contactos</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={TH}>Nombre</TableHead>
              <TableHead className={TH}>Rol</TableHead>
              <TableHead className={TH}>Departamento</TableHead>
              <TableHead className={TH}>Correo</TableHead>
              <TableHead className={TH}>Teléfono</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((persona) => (
              <TableRow key={`fila-${persona.nombre}-${persona.correo}`}>
                <TableCell>
                  <span className="flex items-center gap-2.5">
                    <AvatarPersona className="size-7" />
                    <span className="flex flex-col">
                      <span className="font-medium">{persona.nombre}</span>
                      {persona.principal ? (
                        <span className="text-muted-foreground text-xs">Contacto principal</span>
                      ) : null}
                    </span>
                  </span>
                </TableCell>
                <TableCell>{persona.puesto}</TableCell>
                <TableCell className="text-muted-foreground">{persona.departamento}</TableCell>
                <TableCell className="text-primary">{persona.correo}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{persona.telefono}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PiePagina
          total={personas.length}
          porPagina={PERSONAS_POR_PAGINA}
          pagina={pagina}
          setPagina={setPagina}
          unidad="contactos"
        />
      </div>
    </div>
  );
}

interface AdjuntoEjemplo {
  nombre: string;
  tipo: string;
  tamano: string;
  subidoPor: string;
  fecha: string;
}

// TODO backend: no existe tabla de archivos adjuntos; filas de ejemplo del diseño.
const ADJUNTOS_EJEMPLO: AdjuntoEjemplo[] = [
  {
    nombre: "contrato-servicios.pdf",
    tipo: "Contrato",
    tamano: "2.4 MB",
    subidoPor: "Ana García",
    fecha: "2026-01-15",
  },
  { nombre: "factura-1045.pdf", tipo: "Factura", tamano: "158 KB", subidoPor: "Sistema", fecha: "2026-01-25" },
  { nombre: "logo-empresa.png", tipo: "Imagen", tamano: "45 KB", subidoPor: "Luis Peña", fecha: "2026-01-10" },
  {
    nombre: "inventario-2025.xlsx",
    tipo: "Hoja de cálculo",
    tamano: "1.2 MB",
    subidoPor: "María Santos",
    fecha: "2025-12-20",
  },
  {
    nombre: "acuerdo-confidencialidad.pdf",
    tipo: "Legal",
    tamano: "234 KB",
    subidoPor: "Rosa Díaz",
    fecha: "2025-11-15",
  },
  {
    nombre: "declaracion-itbis-2025.pdf",
    tipo: "Impuestos",
    tamano: "3.8 MB",
    subidoPor: "Contabilidad",
    fecha: "2026-01-05",
  },
  {
    nombre: "cotizacion-anual.pdf",
    tipo: "Cotización",
    tamano: "89 KB",
    subidoPor: "Carlos Núñez",
    fecha: "2025-12-31",
  },
  {
    nombre: "politica-devoluciones.docx",
    tipo: "Legal",
    tamano: "512 KB",
    subidoPor: "Equipo legal",
    fecha: "2025-12-15",
  },
];

const OPCIONES_DOC: OpcionFiltro[] = [
  { valor: "todos", etiqueta: "Todos los tipos" },
  ...[...new Set(ADJUNTOS_EJEMPLO.map((adjunto) => adjunto.tipo))].map((tipo) => ({ valor: tipo, etiqueta: tipo })),
];

function TarjetaConteoDoc({
  etiqueta,
  cantidad,
  icono,
  claseIcono,
}: {
  readonly etiqueta: string;
  readonly cantidad: number;
  readonly icono: React.ReactNode;
  readonly claseIcono: string;
}) {
  return (
    <div className="ring-foreground/10 bg-card flex items-center gap-3 rounded-xl p-4 ring-1">
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", claseIcono)}>{icono}</div>
      <div className="flex flex-col">
        <span className="text-muted-foreground text-xs">{etiqueta}</span>
        <span className="text-xl font-semibold tabular-nums">{cantidad}</span>
      </div>
    </div>
  );
}

function PestanaDocumentos({ datos, filtroDoc }: { readonly datos: DatosFichaContacto; readonly filtroDoc: string }) {
  const adjuntos = ADJUNTOS_EJEMPLO.filter((adjunto) => filtroDoc === "todos" || adjunto.tipo === filtroDoc);
  const { pagina, setPagina } = usePagina(adjuntos.length, DOCS_POR_PAGINA);
  const visibles = adjuntos.slice(pagina * DOCS_POR_PAGINA, (pagina + 1) * DOCS_POR_PAGINA);
  const otros =
    datos.notasVenta.length +
    datos.notasCompra.length +
    datos.pagosRecibidos.length +
    datos.pagosProveedor.length +
    datos.asientos.length +
    ADJUNTOS_EJEMPLO.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <TarjetaConteoDoc
          etiqueta="Facturas"
          cantidad={datos.facturas.length + datos.facturasProveedor.length}
          icono={<FileText className="size-5" />}
          claseIcono="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <TarjetaConteoDoc
          etiqueta="Reportes"
          cantidad={datos.cotizaciones.length + datos.conduces.length}
          icono={<FileBarChart className="size-5" />}
          claseIcono="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        />
        <TarjetaConteoDoc
          etiqueta="Otros"
          cantidad={otros}
          icono={<File className="size-5" />}
          claseIcono="bg-orange-500/10 text-orange-600 dark:text-orange-400"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={TH}>Nombre</TableHead>
            <TableHead className={TH}>Tipo</TableHead>
            <TableHead className={TH}>Tamaño</TableHead>
            <TableHead className={TH}>Subido por</TableHead>
            <TableHead className={TH}>Fecha</TableHead>
            <TableHead className={cn(TH, "text-right")}>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                No hay archivos adjuntos.
              </TableCell>
            </TableRow>
          ) : (
            visibles.map((adjunto) => (
              <TableRow key={adjunto.nombre}>
                <TableCell className="font-medium">{adjunto.nombre}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{adjunto.tipo}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{adjunto.tamano}</TableCell>
                <TableCell>{adjunto.subidoPor}</TableCell>
                <TableCell className="text-muted-foreground">{formatoDia(adjunto.fecha)}</TableCell>
                <TableCell>
                  <span className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Ver ${adjunto.nombre}`}>
                      <Eye />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Descargar ${adjunto.nombre}`}>
                      <Download />
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <PiePagina
        total={adjuntos.length}
        porPagina={DOCS_POR_PAGINA}
        pagina={pagina}
        setPagina={setPagina}
        unidad="documentos"
      />
    </div>
  );
}

type PestanaFicha = "resumen" | "transacciones" | "contactos" | "documentos";

function AccionPestana({
  pestana,
  puedeCrear,
  filtroTipo,
  setFiltroTipo,
  opcionesTipo,
  filtroDoc,
  setFiltroDoc,
}: {
  readonly pestana: PestanaFicha;
  readonly puedeCrear: boolean;
  readonly filtroTipo: string;
  readonly setFiltroTipo: (valor: string) => void;
  readonly opcionesTipo: readonly OpcionFiltro[];
  readonly filtroDoc: string;
  readonly setFiltroDoc: (valor: string) => void;
}) {
  if (pestana === "transacciones") {
    return <BotonFiltro valor={filtroTipo} opciones={opcionesTipo} onCambiar={setFiltroTipo} />;
  }
  if (pestana === "contactos") {
    return puedeCrear ? (
      <Button size="sm">
        <Plus data-icon="inline-start" />
        Agregar contacto
      </Button>
    ) : null;
  }
  if (pestana === "documentos") {
    return (
      <div className="flex items-center gap-2">
        <BotonFiltro valor={filtroDoc} opciones={OPCIONES_DOC} onCambiar={setFiltroDoc} />
        {puedeCrear ? (
          <Button size="sm">
            <Upload data-icon="inline-start" />
            Subir documento
          </Button>
        ) : null}
      </div>
    );
  }
  return null;
}

export function FichaContacto({
  datos,
  puedeCrear,
}: {
  readonly datos: DatosFichaContacto;
  readonly puedeCrear: boolean;
}) {
  const { contacto, cuentaCxc, cuentaCxp } = datos;
  const [pestana, setPestana] = useState<PestanaFicha>("resumen");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroDoc, setFiltroDoc] = useState("todos");

  const esVenta = contacto.tipo !== "proveedor";
  const esCompra = contacto.tipo !== "cliente";

  const filas = construirFilas(datos);
  const tiposPresentes = [...new Set(filas.map((fila) => fila.tipo))];
  const opcionesTipo: OpcionFiltro[] = [
    { valor: "todos", etiqueta: "Todos los tipos" },
    ...tiposPresentes.map((tipo) => ({ valor: tipo, etiqueta: ETIQUETA_TIPO_FILA[tipo] })),
  ];
  const stats = construirStats(datos, esVenta, esCompra);
  const { primaria, secundarias } = accionesFicha(contacto, puedeCrear, esVenta, esCompra);

  return (
    <div className="flex flex-col gap-6" style={{ fontFamily: "var(--font-inter)" }}>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={<Link href="/dashboard/contactos" prefetch={false} />}
      >
        <ArrowLeft data-icon="inline-start" />
        Contactos
      </Button>

      <div className="bg-card ring-foreground/10 rounded-xl ring-1">
        <EncabezadoFicha contacto={contacto} primaria={primaria} secundarias={secundarias} />

        <Tabs value={pestana} className="gap-0">
          <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-2 sm:px-4">
            <nav className="flex items-center gap-1" aria-label="Secciones de la ficha">
              <ItemPestana
                activo={pestana === "resumen"}
                onClick={() => setPestana("resumen")}
                icono={<LayoutGrid className="size-4" />}
                etiqueta="Resumen"
              />
              <ItemPestana
                activo={pestana === "transacciones"}
                onClick={() => setPestana("transacciones")}
                icono={<ArrowLeftRight className="size-4" />}
                etiqueta="Transacciones"
              />
              <ItemPestana
                activo={pestana === "contactos"}
                onClick={() => setPestana("contactos")}
                icono={<Users className="size-4" />}
                etiqueta="Contactos"
              />
              <ItemPestana
                activo={pestana === "documentos"}
                onClick={() => setPestana("documentos")}
                icono={<FileText className="size-4" />}
                etiqueta="Documentos"
              />
            </nav>
            <div className="flex items-center gap-2 py-1.5">
              <AccionPestana
                pestana={pestana}
                puedeCrear={puedeCrear}
                filtroTipo={filtroTipo}
                setFiltroTipo={setFiltroTipo}
                opcionesTipo={opcionesTipo}
                filtroDoc={filtroDoc}
                setFiltroDoc={setFiltroDoc}
              />
            </div>
          </div>

          <TabsContent value="resumen" className="p-4 sm:p-5">
            <ContenidoResumen contacto={contacto} cuentaCxc={cuentaCxc} cuentaCxp={cuentaCxp} />
          </TabsContent>

          <TabsContent value="transacciones" className="p-4 sm:p-5">
            <PestanaTransacciones
              filas={filas}
              filtroTipo={filtroTipo}
              statsIzquierda={stats.izquierda}
              statsDerecha={stats.derecha}
            />
          </TabsContent>

          <TabsContent value="contactos" className="p-4 sm:p-5">
            <PestanaContactos contacto={contacto} />
          </TabsContent>

          <TabsContent value="documentos" className="p-4 sm:p-5">
            <PestanaDocumentos datos={datos} filtroDoc={filtroDoc} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
