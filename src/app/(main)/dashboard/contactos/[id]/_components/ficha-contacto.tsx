"use client";

import { useState } from "react";

import Link from "next/link";

import {
  ArrowLeft,
  Building2,
  Download,
  FilePlus2,
  FileText,
  Hash,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Upload,
} from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  "pago-recibido": "Pago recibido",
  "pago-proveedor": "Pago proveedor",
  asiento: "Asiento",
};

interface FilaUnificada {
  clave: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  tipo: TipoFila;
  detalle: string;
  montoCentavos: number;
  estado: string;
  href: string;
}

const FILAS_POR_PAGINA = 15;

function detalleNota(nota: NotaFicha): string {
  if (nota.tipo === "credito") return "Nota de crédito";
  if (nota.tipo === "debito") return "Nota de débito";
  return "Nota de crédito de compra";
}

function detallePagoRecibido(pago: PagoFicha): string {
  if (pago.factura_numero == null) return "Anticipo";
  return `Factura #${pago.factura_numero}`;
}

function detallePagoProveedor(pago: PagoFicha): string {
  if (pago.factura_numero == null) return "Pago a proveedor";
  return `Factura de proveedor #${pago.factura_numero}`;
}

function facturasAFilas(facturas: readonly DocumentoFicha[], tipo: "factura" | "compra"): FilaUnificada[] {
  const esVenta = tipo === "factura";
  return facturas.map((fila) => ({
    clave: `${tipo}-${fila.id}`,
    numero: fila.numero,
    ncf: fila.ncf,
    fecha: fila.fecha,
    tipo,
    detalle: esVenta ? "Factura de venta" : "Factura de proveedor",
    montoCentavos: aCentavos(fila.total),
    estado: fila.estado,
    href: esVenta ? rutaFactura(fila.id) : rutaCompra(fila.id),
  }));
}

function comercialesAFilas(filas: readonly DocumentoComercialFicha[], tipo: "cotizacion" | "conduce"): FilaUnificada[] {
  return filas.map((fila) => ({
    clave: `${tipo}-${fila.id}`,
    numero: fila.numero,
    ncf: null,
    fecha: fila.fecha,
    tipo,
    detalle: tipo === "cotizacion" ? "Cotización" : "Conduce",
    montoCentavos: aCentavos(fila.total),
    estado: fila.estado,
    href: tipo === "cotizacion" ? rutaCotizacion(fila.id) : rutaConduce(fila.id),
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
    detalle: detalleNota(fila),
    montoCentavos: aCentavos(fila.total),
    estado: fila.estado,
    href: rutaNota(fila),
  }));
}

function pagosAFilas(pagos: readonly PagoFicha[], tipo: "pago-recibido" | "pago-proveedor"): FilaUnificada[] {
  return pagos.map((fila) => ({
    clave: `${tipo}-${fila.id}`,
    numero: fila.numero,
    ncf: null,
    fecha: fila.fecha,
    tipo,
    detalle: tipo === "pago-recibido" ? detallePagoRecibido(fila) : detallePagoProveedor(fila),
    montoCentavos: aCentavos(fila.monto),
    estado: fila.estado,
    href: tipo === "pago-recibido" ? rutaPagoRecibido(fila.id) : rutaPagoProveedor(fila.id),
  }));
}

function asientosAFilas(asientos: readonly AsientoFicha[]): FilaUnificada[] {
  return asientos.map((fila) => ({
    clave: `asiento-${fila.id}`,
    numero: fila.numero,
    ncf: null,
    fecha: fila.fecha,
    tipo: "asiento",
    detalle: fila.descripcion,
    montoCentavos: fila.debitoCentavos,
    estado: "activo",
    href: rutaAsiento(fila.id),
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
  if (tipo === "pago-recibido") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      >
        {ETIQUETA_TIPO_FILA[tipo]}
      </Badge>
    );
  }
  if (tipo === "factura" || tipo === "compra") return <Badge variant="outline">{ETIQUETA_TIPO_FILA[tipo]}</Badge>;
  return <Badge variant="secondary">{ETIQUETA_TIPO_FILA[tipo]}</Badge>;
}

function EstadoFilaBadge({ estado, tipo }: { readonly estado: string; readonly tipo: TipoFila }) {
  let etiqueta: string;
  if (tipo === "factura" || tipo === "compra")
    etiqueta = etiquetaEstadoDocumento(estado, tipo === "factura" ? "venta" : "compra");
  else if (tipo === "cotizacion" || tipo === "conduce") etiqueta = etiquetaEstadoComercial(estado);
  else etiqueta = etiquetaEstadoPago(estado);

  if (estado === "anulada" || estado === "anulado") return <Badge variant="destructive">{etiqueta}</Badge>;
  if (estado === "pagada" || estado === "convertida") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      >
        {etiqueta}
      </Badge>
    );
  }
  return <Badge variant="secondary">{etiqueta}</Badge>;
}

function TarjetaResumen({ titulo, centavos }: { readonly titulo: string; readonly centavos: number }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-normal">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatoMonedaCentavos(centavos)}</p>
      </CardContent>
    </Card>
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

function MetaItem({ icono, texto }: { readonly icono: React.ReactNode; readonly texto: string }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
      {icono}
      {texto}
    </span>
  );
}

function TablaUnificada({ filas }: { readonly filas: FilaUnificada[] }) {
  const [pagina, setPagina] = useState(0);
  const paginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA));
  const paginaActual = Math.min(pagina, paginas - 1);
  const visibles = filas.slice(paginaActual * FILAS_POR_PAGINA, (paginaActual + 1) * FILAS_POR_PAGINA);

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número / NCF</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Estado</TableHead>
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
                  <TableCell className="font-medium">
                    <Enlace
                      className="absolute inset-0"
                      href={fila.href}
                      aria-label={`Ver ${fila.detalle} #${fila.numero}`}
                    />
                    <span className="pointer-events-none relative flex flex-col">
                      <span>#{fila.numero}</span>
                      {fila.ncf ? <span className="text-muted-foreground font-mono text-xs">{fila.ncf}</span> : null}
                    </span>
                  </TableCell>
                  <TableCell>{formatoDia(fila.fecha)}</TableCell>
                  <TableCell>
                    <TipoBadge tipo={fila.tipo} />
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-normal">{fila.detalle}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMonedaCentavos(fila.montoCentavos)}</TableCell>
                  <TableCell>
                    <EstadoFilaBadge estado={fila.estado} tipo={fila.tipo} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Mostrando {visibles.length} de {filas.length} transacciones
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={paginaActual === 0} onClick={() => setPagina(paginaActual - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={paginaActual >= paginas - 1}
            onClick={() => setPagina(paginaActual + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}

interface PersonaContacto {
  nombre: string;
  rol: string;
  departamento: string;
  correo: string;
  telefono: string;
}

// TODO backend: no existe tabla de personas de contacto por cliente; datos de ejemplo del diseño.
const PERSONAS_EJEMPLO: PersonaContacto[] = [
  {
    nombre: "Ana García",
    rol: "Contacto principal",
    departamento: "Compras",
    correo: "ana.garcia@ejemplo.com",
    telefono: "+1 (809) 555-0101",
  },
  {
    nombre: "Luis Peña",
    rol: "Contador",
    departamento: "Finanzas",
    correo: "luis.pena@ejemplo.com",
    telefono: "+1 (809) 555-0102",
  },
  {
    nombre: "María Santos",
    rol: "Recepción",
    departamento: "Operaciones",
    correo: "maria.santos@ejemplo.com",
    telefono: "+1 (809) 555-0103",
  },
];

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

function TarjetaPersona({ persona }: { readonly persona: PersonaContacto }) {
  return (
    <div className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback>{iniciales(persona.nombre)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{persona.nombre}</p>
          <p className="text-muted-foreground text-sm">{persona.rol}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <Mail className="size-3.5" />
          {persona.correo}
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <Phone className="size-3.5" />
          {persona.telefono}
        </span>
      </div>
    </div>
  );
}

function PestanaContactos({ contacto }: { readonly contacto: DatosFichaContacto["contacto"] }) {
  // TODO backend: cuando exista la tabla de personas, reemplazar PERSONAS_EJEMPLO por los datos reales.
  const principal: PersonaContacto = {
    nombre: contacto.nombre,
    rol: "Contacto principal",
    departamento: "—",
    correo: contacto.correo ?? "—",
    telefono: contacto.telefono ?? "—",
  };
  const personas = [principal, ...PERSONAS_EJEMPLO];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Personas de contacto</h2>
          <p className="text-muted-foreground text-sm">Personas con las que se trata en esta empresa</p>
        </div>
        <Button variant="outline" size="sm">
          <Plus data-icon="inline-start" />
          Agregar contacto
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {personas.map((persona) => (
          <TarjetaPersona key={`${persona.nombre}-${persona.correo}`} persona={persona} />
        ))}
        <button
          type="button"
          className="border-muted-foreground/30 text-muted-foreground hover:bg-muted/50 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-colors"
        >
          <Plus className="size-5" />
          <span className="text-sm font-medium">Agregar contacto</span>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-medium">Todos los contactos</h3>
        <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Teléfono</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {personas.map((persona) => (
                <TableRow key={`fila-${persona.nombre}-${persona.correo}`}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="text-xs">{iniciales(persona.nombre)}</AvatarFallback>
                      </Avatar>
                      {persona.nombre}
                    </span>
                  </TableCell>
                  <TableCell>{persona.rol}</TableCell>
                  <TableCell className="text-muted-foreground">{persona.departamento}</TableCell>
                  <TableCell className="text-muted-foreground">{persona.correo}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{persona.telefono}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
  { nombre: "contrato-servicios.pdf", tipo: "Contrato", tamano: "2.4 MB", subidoPor: "Sistema", fecha: "2026-01-15" },
  { nombre: "factura-1045.pdf", tipo: "Factura", tamano: "158 KB", subidoPor: "Sistema", fecha: "2026-01-10" },
];

function TarjetaConteo({ titulo, cantidad }: { readonly titulo: string; readonly cantidad: number }) {
  return (
    <Card size="sm">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-muted-foreground text-sm font-normal">{titulo}</CardTitle>
        <FileText className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{cantidad}</p>
      </CardContent>
    </Card>
  );
}

function PestanaDocumentos({ datos }: { readonly datos: DatosFichaContacto }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <TarjetaConteo titulo="Facturas" cantidad={datos.facturas.length + datos.facturasProveedor.length} />
        <TarjetaConteo titulo="Docs. comerciales" cantidad={datos.cotizaciones.length + datos.conduces.length} />
        <TarjetaConteo
          titulo="Otros"
          cantidad={
            datos.notasVenta.length +
            datos.notasCompra.length +
            datos.pagosRecibidos.length +
            datos.pagosProveedor.length
          }
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">Archivos adjuntos</h3>
          <Button size="sm">
            <Upload data-icon="inline-start" />
            Subir documento
          </Button>
        </div>
        <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead>Subido por</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ADJUNTOS_EJEMPLO.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                    No hay archivos adjuntos.
                  </TableCell>
                </TableRow>
              ) : (
                ADJUNTOS_EJEMPLO.map((adjunto) => (
                  <TableRow key={adjunto.nombre}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <FileText className="text-muted-foreground size-4" />
                        {adjunto.nombre}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{adjunto.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{adjunto.tamano}</TableCell>
                    <TableCell className="text-muted-foreground">{adjunto.subidoPor}</TableCell>
                    <TableCell>{formatoDia(adjunto.fecha)}</TableCell>
                    <TableCell>
                      <span className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`Descargar ${adjunto.nombre}`}>
                          <Download className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Más acciones">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function EncabezadoFicha({
  contacto,
  puedeCrear,
  esVenta,
  esCompra,
}: {
  readonly contacto: DatosFichaContacto["contacto"];
  readonly puedeCrear: boolean;
  readonly esVenta: boolean;
  readonly esCompra: boolean;
}) {
  return (
    <div className="bg-card ring-foreground/10 flex flex-col gap-4 rounded-xl p-5 ring-1 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
          <Building2 className="size-6" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{contacto.nombre}</h1>
            <Badge variant="secondary">{etiquetaTipoContacto(contacto.tipo)}</Badge>
            <Badge
              variant="outline"
              className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
            >
              Activo
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <MetaItem icono={<Hash className="size-3.5" />} texto={contacto.rnc_cedula ?? "Sin RNC"} />
            <MetaItem icono={<Phone className="size-3.5" />} texto={contacto.telefono ?? "Sin teléfono"} />
            <MetaItem icono={<Mail className="size-3.5" />} texto={contacto.correo ?? "Sin correo"} />
            <MetaItem icono={<MapPin className="size-3.5" />} texto={contacto.direccion ?? "Sin dirección"} />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {puedeCrear && esVenta ? (
          <Button render={<Link href={`/dashboard/facturacion/nueva?cliente=${contacto.id}`} prefetch={false} />}>
            <FilePlus2 data-icon="inline-start" />
            Nueva factura
          </Button>
        ) : null}
        {puedeCrear && esCompra ? (
          <Button variant="outline" render={<Link href={`/dashboard/compras/nueva`} prefetch={false} />}>
            <ShoppingCart data-icon="inline-start" />
            Nueva compra
          </Button>
        ) : null}
        <Button variant="outline" render={<Link href={`${rutaContacto(contacto.id)}/estado-cuenta`} />}>
          <FileText data-icon="inline-start" />
          Estado de cuenta
        </Button>
      </div>
    </div>
  );
}

interface Kpis {
  esVenta: boolean;
  esCompra: boolean;
  facturado: number;
  cobrado: number;
  comprado: number;
  pagadoProveedor: number;
  porCobrar: number;
  porPagar: number;
  anticipos: number;
}

function TarjetasKpi({ kpis }: { readonly kpis: Kpis }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.esVenta ? <TarjetaResumen titulo="Total facturado" centavos={kpis.facturado} /> : null}
      {kpis.esVenta ? <TarjetaResumen titulo="Total cobrado" centavos={kpis.cobrado} /> : null}
      {kpis.esVenta ? <TarjetaResumen titulo="Por cobrar" centavos={kpis.porCobrar} /> : null}
      {kpis.esVenta && kpis.anticipos > 0 ? <TarjetaResumen titulo="Anticipos" centavos={kpis.anticipos} /> : null}
      {kpis.esCompra ? <TarjetaResumen titulo="Total comprado" centavos={kpis.comprado} /> : null}
      {kpis.esCompra ? <TarjetaResumen titulo="Total pagado" centavos={kpis.pagadoProveedor} /> : null}
      {kpis.esCompra ? <TarjetaResumen titulo="Por pagar" centavos={kpis.porPagar} /> : null}
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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Información general</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Nombre</dt>
            <dd className="font-medium">{contacto.nombre}</dd>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd>{etiquetaTipoContacto(contacto.tipo)}</dd>
            <dt className="text-muted-foreground">RNC / Cédula</dt>
            <dd className="tabular-nums">{contacto.rnc_cedula ?? "—"}</dd>
          </dl>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Teléfono</dt>
            <dd className="tabular-nums">{contacto.telefono ?? "—"}</dd>
            <dt className="text-muted-foreground">Correo</dt>
            <dd>{contacto.correo ?? "—"}</dd>
            <dt className="text-muted-foreground">Dirección</dt>
            <dd className="whitespace-pre-line">{contacto.direccion ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contabilidad</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
            <dt className="text-muted-foreground">Cuenta por cobrar (CxC)</dt>
            <dd>
              <CuentaEnlace cuenta={cuentaCxc} />
            </dd>
            <dt className="text-muted-foreground">Cuenta por pagar (CxP)</dt>
            <dd>
              <CuentaEnlace cuenta={cuentaCxp} />
            </dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function BarraFiltros({
  busqueda,
  setBusqueda,
  filtroTipo,
  setFiltroTipo,
  tipos,
}: {
  readonly busqueda: string;
  readonly setBusqueda: (valor: string) => void;
  readonly filtroTipo: string;
  readonly setFiltroTipo: (valor: string) => void;
  readonly tipos: readonly TipoFila[];
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative w-full sm:max-w-xs">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por número, NCF o detalle…"
          aria-label="Buscar transacciones"
          className="pl-8"
        />
      </div>
      <Select value={filtroTipo} onValueChange={(valor) => setFiltroTipo(valor ?? "todos")}>
        <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por tipo">
          <SelectValue placeholder="Todos los tipos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los tipos</SelectItem>
          {tipos.map((tipo) => (
            <SelectItem key={tipo} value={tipo}>
              {ETIQUETA_TIPO_FILA[tipo]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FichaContacto({
  datos,
  puedeCrear,
}: {
  readonly datos: DatosFichaContacto;
  readonly puedeCrear: boolean;
}) {
  const { contacto, cuentaCxc, cuentaCxp, facturas, facturasProveedor, pagosRecibidos } = datos;
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  const esVenta = contacto.tipo !== "proveedor";
  const esCompra = contacto.tipo !== "cliente";

  const kpis: Kpis = {
    esVenta,
    esCompra,
    facturado: facturas.reduce((t, f) => (f.estado === "anulada" ? t : t + aCentavos(f.total)), 0),
    cobrado: facturas.reduce((t, f) => (f.estado === "anulada" ? t : t + aCentavos(f.pagado)), 0),
    comprado: facturasProveedor.reduce((t, f) => (f.estado === "anulada" ? t : t + aCentavos(f.total)), 0),
    pagadoProveedor: facturasProveedor.reduce((t, f) => (f.estado === "anulada" ? t : t + aCentavos(f.pagado)), 0),
    porCobrar: totalPorCobrar(facturas),
    porPagar: totalPorPagar(facturasProveedor),
    anticipos: totalAnticipos(pagosRecibidos),
  };

  const filas = construirFilas(datos);
  const tiposPresentes = [...new Set(filas.map((f) => f.tipo))];
  const texto = busqueda.trim().toLowerCase();
  const filtradas = filas.filter((fila) => {
    if (filtroTipo !== "todos" && fila.tipo !== filtroTipo) return false;
    if (texto === "") return true;
    return (
      String(fila.numero).includes(texto) ||
      (fila.ncf ?? "").toLowerCase().includes(texto) ||
      fila.detalle.toLowerCase().includes(texto)
    );
  });

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

      <EncabezadoFicha contacto={contacto} puedeCrear={puedeCrear} esVenta={esVenta} esCompra={esCompra} />
      <TarjetasKpi kpis={kpis} />

      <Tabs defaultValue="resumen">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="transacciones">Transacciones</TabsTrigger>
          <TabsTrigger value="contactos">Contactos</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <ContenidoResumen contacto={contacto} cuentaCxc={cuentaCxc} cuentaCxp={cuentaCxp} />
        </TabsContent>

        <TabsContent value="transacciones" className="flex flex-col gap-3">
          <BarraFiltros
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            filtroTipo={filtroTipo}
            setFiltroTipo={setFiltroTipo}
            tipos={tiposPresentes}
          />
          <TablaUnificada filas={filtradas} />
        </TabsContent>

        <TabsContent value="contactos">
          <PestanaContactos contacto={contacto} />
        </TabsContent>

        <TabsContent value="documentos">
          <PestanaDocumentos datos={datos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
