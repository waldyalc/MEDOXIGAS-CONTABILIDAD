"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import {
  ArrowLeft,
  ArrowLeftRight,
  BookOpen,
  Building2,
  Download,
  EllipsisVertical,
  Eye,
  File,
  FileBarChart,
  FileMinus,
  FilePlus2,
  FileText,
  Hash,
  LayoutGrid,
  Mail,
  MapPin,
  Phone,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  SquarePen,
  Truck,
  Upload,
  User,
  Users,
  Wallet,
} from "lucide-react";

import { FormularioContacto } from "@/components/contactos/formulario-contacto";
import { Enlace } from "@/components/enlace";
import {
  BotonFiltro,
  CLASE_PANEL_FICHA,
  GrillaKpis,
  ItemDato,
  type KpiFicha,
  MetaItem,
  type OpcionFiltro,
  PestanasFicha,
  PiePagina,
  TH,
  type TonoKpi,
  usePagina,
} from "@/components/ficha/ficha-ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { type Contacto, etiquetaTipoContacto } from "@/lib/contactos/contactos";
import {
  type AsientoFicha,
  aCentavos,
  type CuentaFicha,
  type DatosFichaContacto,
  type DocumentoComercialFicha,
  type DocumentoFicha,
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
import type { ListaPrecio } from "@/lib/inventario/tipos";

import {
  type ClaseEstado,
  EstadoBadge,
  PestanaAsientos,
  PestanaComerciales,
  PestanaFacturas,
  PestanaNotas,
  PestanaPagos,
} from "./pestanas-documentos";

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
    montoCentavos: Math.max(fila.debitoCentavos, fila.creditoCentavos),
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

const CLASE_ESTADO_FILA: Record<TipoFila, ClaseEstado> = {
  factura: "venta",
  compra: "compra",
  cotizacion: "comercial",
  conduce: "comercial",
  nota: "pago",
  "pago-recibido": "pago",
  "pago-proveedor": "pago",
  asiento: "pago",
};

interface AccionEnlace {
  readonly etiqueta: string;
  readonly href: string;
  readonly icono: React.ReactNode;
}

function accionesFicha(contacto: DatosFichaContacto["contacto"], esVenta: boolean, esCompra: boolean): AccionEnlace[] {
  const acciones: AccionEnlace[] = [];
  if (esVenta) {
    acciones.push({
      etiqueta: "Nueva factura",
      href: `/dashboard/facturacion/nueva?cliente=${contacto.id}`,
      icono: <FilePlus2 />,
    });
  }
  if (esCompra) {
    acciones.push({ etiqueta: "Nueva compra", href: "/dashboard/compras/nueva", icono: <ShoppingCart /> });
  }
  acciones.push({
    etiqueta: "Estado de cuenta",
    href: `${rutaContacto(contacto.id)}/estado-cuenta`,
    icono: <FileText />,
  });
  return acciones;
}

function EncabezadoFicha({
  contacto,
  acciones,
  onEditar,
  estadoCuentaHref,
}: {
  readonly contacto: DatosFichaContacto["contacto"];
  readonly acciones: readonly AccionEnlace[];
  readonly onEditar: (() => void) | null;
  readonly estadoCuentaHref: string;
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
        {onEditar ? (
          <Button onClick={onEditar}>
            <SquarePen data-icon="inline-start" />
            Editar perfil
          </Button>
        ) : (
          <Button nativeButton={false} render={<Link href={estadoCuentaHref} prefetch={false} />}>
            <FileText data-icon="inline-start" />
            Estado de cuenta
          </Button>
        )}
        {acciones.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Más acciones" />}>
              <EllipsisVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {acciones.map((accion) => (
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

function CuentaEnlace({ cuenta }: { readonly cuenta: CuentaFicha | null }) {
  if (!cuenta) return <span className="text-muted-foreground">—</span>;
  return (
    <Enlace href={rutaCuenta(cuenta.id)} className="font-medium">
      {cuenta.codigo} · {cuenta.nombre}
    </Enlace>
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

function construirKpis(datos: DatosFichaContacto): KpiFicha[] {
  // Las notas de crédito y débito siempre se aplican a una factura al crearse.
  const notasPorAplicar = 0;
  const kpis: { etiqueta: string; centavos: number; tono: TonoKpi }[] = [
    { etiqueta: "Cuentas por cobrar", centavos: totalPorCobrar(datos.facturas), tono: "pendiente" },
    { etiqueta: "Anticipos recibidos", centavos: totalAnticipos(datos.pagosRecibidos), tono: "normal" },
    { etiqueta: "Anticipos entregados", centavos: totalAnticipos(datos.pagosProveedor), tono: "normal" },
    { etiqueta: "Por pagar", centavos: totalPorPagar(datos.facturasProveedor), tono: "pendiente" },
    { etiqueta: "Notas crédito por aplicar", centavos: notasPorAplicar, tono: "normal" },
    { etiqueta: "Notas débito por aplicar", centavos: notasPorAplicar, tono: "normal" },
  ];
  return kpis.map(({ centavos, ...kpi }) => ({ ...kpi, valor: formatoMonedaCentavos(centavos) }));
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

function IdentificadorMovimiento({ fila, numero }: { readonly fila: FilaUnificada; readonly numero: string }) {
  if (fila.tipo === "factura") {
    return fila.ncf ? (
      <span className="text-primary font-medium">{fila.ncf}</span>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }

  return (
    <>
      <span className="text-primary font-medium">{numero}</span>
      {fila.ncf ? <span className="text-muted-foreground font-mono text-xs">{fila.ncf}</span> : null}
    </>
  );
}

function FilaMovimiento({ fila }: { readonly fila: FilaUnificada }) {
  const esFacturaVenta = fila.tipo === "factura";
  const numero = `${fila.prefijo}-${String(fila.numero).padStart(4, "0")}`;
  let ariaLabel = `Ver ${fila.detalle} ${numero}`;
  if (esFacturaVenta) ariaLabel = fila.ncf ? `Ver factura ${fila.ncf}` : "Ver factura de venta";

  return (
    <TableRow className="relative cursor-pointer">
      <TableCell>
        <Enlace className="absolute inset-0" href={fila.href} aria-label={ariaLabel} />
        <span className="pointer-events-none relative flex flex-col">
          <IdentificadorMovimiento fila={fila} numero={numero} />
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatoDia(fila.fecha)}</TableCell>
      <TableCell>
        <TipoBadge tipo={fila.tipo} />
      </TableCell>
      <TableCell className="whitespace-normal">{fila.detalle}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {fila.direccion === "abono" ? (
          <span className="text-emerald-600 dark:text-emerald-400">-{formatoMonedaCentavos(fila.montoCentavos)}</span>
        ) : (
          formatoMonedaCentavos(fila.montoCentavos)
        )}
      </TableCell>
      <TableCell>
        <EstadoBadge estado={fila.estado} clase={CLASE_ESTADO_FILA[fila.tipo]} />
      </TableCell>
    </TableRow>
  );
}

function TablaMovimientos({ filas, unidad }: { readonly filas: readonly FilaUnificada[]; readonly unidad: string }) {
  return (
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
        {filas.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
              No hay {unidad}.
            </TableCell>
          </TableRow>
        ) : (
          filas.map((fila) => <FilaMovimiento key={fila.clave} fila={fila} />)
        )}
      </TableBody>
    </Table>
  );
}

function PestanaTabla({
  filas,
  filtroTipo,
  unidad,
}: {
  readonly filas: readonly FilaUnificada[];
  readonly filtroTipo: string;
  readonly unidad: string;
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
      <div className="relative w-full max-w-xs">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder={`Buscar ${unidad}…`}
          aria-label={`Buscar ${unidad}`}
          className="pl-8"
        />
      </div>
      <TablaMovimientos filas={visibles} unidad={unidad} />
      <PiePagina
        total={filtradas.length}
        porPagina={TX_POR_PAGINA}
        pagina={pagina}
        setPagina={setPagina}
        unidad={unidad}
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

type PestanaFicha =
  | "resumen"
  | "transacciones"
  | "facturas"
  | "cotizaciones"
  | "conduces"
  | "notas"
  | "pagos"
  | "asientos"
  | "compras"
  | "notas-compra"
  | "pagos-proveedor"
  | "contactos"
  | "documentos";

interface ItemMenuFicha {
  readonly valor: PestanaFicha;
  readonly etiqueta: string;
  readonly icono: React.ReactNode;
}

function pestanasFicha(esVenta: boolean, esCompra: boolean): ItemMenuFicha[] {
  const venta: ItemMenuFicha[] = [
    { valor: "facturas", etiqueta: "Facturas de venta", icono: <ReceiptText className="size-4" /> },
    { valor: "cotizaciones", etiqueta: "Cotizaciones", icono: <FileText className="size-4" /> },
    { valor: "conduces", etiqueta: "Conduces", icono: <Truck className="size-4" /> },
    { valor: "notas", etiqueta: "Notas de crédito y débito", icono: <FileMinus className="size-4" /> },
    { valor: "pagos", etiqueta: "Pagos recibidos", icono: <Wallet className="size-4" /> },
  ];
  const compra: ItemMenuFicha[] = [
    { valor: "compras", etiqueta: "Facturas de proveedor", icono: <ShoppingCart className="size-4" /> },
    { valor: "notas-compra", etiqueta: "Notas crédito de compra", icono: <FileMinus className="size-4" /> },
    { valor: "pagos-proveedor", etiqueta: "Pagos a proveedor", icono: <Wallet className="size-4" /> },
  ];
  return [
    { valor: "resumen", etiqueta: "Resumen", icono: <LayoutGrid className="size-4" /> },
    { valor: "transacciones", etiqueta: "Transacciones", icono: <ArrowLeftRight className="size-4" /> },
    ...(esVenta ? venta : []),
    ...(esCompra ? compra : []),
    { valor: "asientos", etiqueta: "Asientos", icono: <BookOpen className="size-4" /> },
    { valor: "contactos", etiqueta: "Contactos", icono: <Users className="size-4" /> },
    { valor: "documentos", etiqueta: "Documentos", icono: <File className="size-4" /> },
  ];
}

interface FiltroPestana {
  readonly valor: string;
  readonly onCambiar: (valor: string) => void;
  readonly opciones: readonly OpcionFiltro[];
}

function AccionPestana({
  pestana,
  puedeCrear,
  filtroTx,
  filtroDoc,
}: {
  readonly pestana: PestanaFicha;
  readonly puedeCrear: boolean;
  readonly filtroTx: FiltroPestana;
  readonly filtroDoc: FiltroPestana;
}) {
  if (pestana === "transacciones") {
    return <BotonFiltro valor={filtroTx.valor} opciones={filtroTx.opciones} onCambiar={filtroTx.onCambiar} />;
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
        <BotonFiltro valor={filtroDoc.valor} opciones={filtroDoc.opciones} onCambiar={filtroDoc.onCambiar} />
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
  contactoEditable,
  listasPrecios,
}: {
  readonly datos: DatosFichaContacto;
  readonly puedeCrear: boolean;
  readonly contactoEditable: Contacto | null;
  readonly listasPrecios: ListaPrecio[];
}) {
  const { contacto, cuentaCxc, cuentaCxp } = datos;
  const router = useRouter();
  const [pestana, setPestana] = useState<PestanaFicha>("resumen");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroDoc, setFiltroDoc] = useState("todos");
  const [editando, setEditando] = useState(false);

  const esVenta = contacto.tipo !== "proveedor";
  const esCompra = contacto.tipo !== "cliente";

  const filas = construirFilas(datos);
  const tiposPresentes = [...new Set(filas.map((fila) => fila.tipo))];
  const opcionesTipo: OpcionFiltro[] = [
    { valor: "todos", etiqueta: "Todos los tipos" },
    ...tiposPresentes.map((tipo) => ({ valor: tipo, etiqueta: ETIQUETA_TIPO_FILA[tipo] })),
  ];

  const kpis = construirKpis(datos);
  const secundarias = puedeCrear ? accionesFicha(contacto, esVenta, esCompra) : [];
  const estadoCuentaHref = `${rutaContacto(contacto.id)}/estado-cuenta`;

  function cerrarEdicion() {
    setEditando(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6" style={{ fontFamily: "var(--font-inter)" }}>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/dashboard/contactos" prefetch={false} />}
      >
        <ArrowLeft data-icon="inline-start" />
        Contactos
      </Button>

      <div className={CLASE_PANEL_FICHA}>
        <EncabezadoFicha
          contacto={contacto}
          acciones={secundarias}
          onEditar={puedeCrear && contactoEditable ? () => setEditando(true) : null}
          estadoCuentaHref={estadoCuentaHref}
        />

        <div className="px-5 pb-5">
          <GrillaKpis kpis={kpis} />
        </div>

        <Tabs value={pestana} className="gap-0">
          <div className="border-border flex flex-col gap-2 border-b px-2 pb-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
            <PestanasFicha
              ariaLabel="Secciones de la ficha"
              items={pestanasFicha(esVenta, esCompra)}
              valor={pestana}
              onCambiar={setPestana}
              className="sm:flex-1"
            />
            <div className="flex items-center gap-2 pb-1.5 sm:py-1.5">
              <AccionPestana
                pestana={pestana}
                puedeCrear={puedeCrear}
                filtroTx={{ valor: filtroTipo, onCambiar: setFiltroTipo, opciones: opcionesTipo }}
                filtroDoc={{ valor: filtroDoc, onCambiar: setFiltroDoc, opciones: OPCIONES_DOC }}
              />
            </div>
          </div>

          <TabsContent value="resumen" className="p-4 sm:p-5">
            <ContenidoResumen contacto={contacto} cuentaCxc={cuentaCxc} cuentaCxp={cuentaCxp} />
          </TabsContent>

          <TabsContent value="transacciones" className="p-4 sm:p-5">
            <PestanaTabla filas={filas} filtroTipo={filtroTipo} unidad="transacciones" />
          </TabsContent>

          <TabsContent value="facturas" className="p-4 sm:p-5">
            <PestanaFacturas facturas={datos.facturas} esVenta ruta={rutaFactura} />
          </TabsContent>

          <TabsContent value="cotizaciones" className="p-4 sm:p-5">
            <PestanaComerciales filas={datos.cotizaciones} prefijo="COT" unidad="cotizaciones" ruta={rutaCotizacion} />
          </TabsContent>

          <TabsContent value="conduces" className="p-4 sm:p-5">
            <PestanaComerciales filas={datos.conduces} prefijo="CON" unidad="conduces" ruta={rutaConduce} />
          </TabsContent>

          <TabsContent value="notas" className="p-4 sm:p-5">
            <PestanaNotas
              notas={datos.notasVenta}
              unidad="notas de crédito y débito"
              prefijo={(nota) => PREFIJO_NOTA[nota.tipo]}
              ruta={rutaNota}
            />
          </TabsContent>

          <TabsContent value="pagos" className="p-4 sm:p-5">
            <PestanaPagos pagos={datos.pagosRecibidos} unidad="pagos recibidos" ruta={rutaPagoRecibido} />
          </TabsContent>

          <TabsContent value="compras" className="p-4 sm:p-5">
            <PestanaFacturas facturas={datos.facturasProveedor} esVenta={false} ruta={rutaCompra} />
          </TabsContent>

          <TabsContent value="notas-compra" className="p-4 sm:p-5">
            <PestanaNotas
              notas={datos.notasCompra}
              unidad="notas crédito de compra"
              prefijo={(nota) => PREFIJO_NOTA[nota.tipo]}
              ruta={rutaNota}
            />
          </TabsContent>

          <TabsContent value="pagos-proveedor" className="p-4 sm:p-5">
            <PestanaPagos pagos={datos.pagosProveedor} unidad="pagos a proveedor" ruta={rutaPagoProveedor} />
          </TabsContent>

          <TabsContent value="asientos" className="p-4 sm:p-5">
            <PestanaAsientos asientos={datos.asientos} ruta={rutaAsiento} />
          </TabsContent>

          <TabsContent value="contactos" className="p-4 sm:p-5">
            <PestanaContactos contacto={contacto} />
          </TabsContent>

          <TabsContent value="documentos" className="p-4 sm:p-5">
            <PestanaDocumentos datos={datos} filtroDoc={filtroDoc} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar contacto</DialogTitle>
          </DialogHeader>
          {contactoEditable ? (
            <FormularioContacto
              key={contactoEditable.id}
              contacto={contactoEditable}
              listasPrecios={listasPrecios}
              onGuardado={cerrarEdicion}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
