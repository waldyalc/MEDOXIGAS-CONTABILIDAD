"use client";

import { useState } from "react";

import Link from "next/link";

import { ArrowLeft, FilePlus2, FileText, Search, ShoppingCart } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { etiquetaTipoContacto } from "@/lib/contactos/contactos";
import {
  type AsientoFicha,
  aCentavos,
  type CuentaFicha,
  construirTransacciones,
  type DatosFichaContacto,
  type DocumentoComercialFicha,
  type DocumentoFicha,
  etiquetaEstadoComercial,
  etiquetaEstadoDocumento,
  filtrarPorNumero,
  type PagoFicha,
  saldoDocumento,
  type TransaccionFicha,
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
  rutaPagoProveedor,
  rutaPagoRecibido,
} from "@/lib/enlaces";
import { formatoMoneda, formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

type PestanaFicha =
  | "transacciones"
  | "facturas"
  | "facturas-proveedor"
  | "cotizaciones"
  | "conduces"
  | "pagos-recibidos"
  | "pagos-proveedores"
  | "asientos";

interface Pestana {
  valor: PestanaFicha;
  etiqueta: string;
  aplicaA: "siempre" | "venta" | "compra";
}

const PESTANAS: Pestana[] = [
  { valor: "transacciones", etiqueta: "Transacciones", aplicaA: "siempre" },
  { valor: "facturas", etiqueta: "Facturas de venta", aplicaA: "venta" },
  { valor: "facturas-proveedor", etiqueta: "Facturas de proveedor", aplicaA: "compra" },
  { valor: "cotizaciones", etiqueta: "Cotizaciones", aplicaA: "venta" },
  { valor: "conduces", etiqueta: "Conduces", aplicaA: "venta" },
  { valor: "pagos-recibidos", etiqueta: "Pagos recibidos", aplicaA: "venta" },
  { valor: "pagos-proveedores", etiqueta: "Pagos a proveedores", aplicaA: "compra" },
  { valor: "asientos", etiqueta: "Asientos", aplicaA: "siempre" },
];

const FILTROS_INICIALES: Record<PestanaFicha, string> = {
  transacciones: "",
  facturas: "",
  "facturas-proveedor": "",
  cotizaciones: "",
  conduces: "",
  "pagos-recibidos": "",
  "pagos-proveedores": "",
  asientos: "",
};

function aplicaPestana(pestana: Pestana, tipo: DatosFichaContacto["contacto"]["tipo"]): boolean {
  if (pestana.aplicaA === "siempre") return true;
  if (pestana.aplicaA === "venta") return tipo !== "proveedor";
  return tipo !== "cliente";
}

function EstadoDocumentoBadge({ estado, tipo }: { estado: string; tipo: "venta" | "compra" }) {
  const etiqueta = etiquetaEstadoDocumento(estado, tipo);

  if (estado === "anulada") return <Badge variant="destructive">{etiqueta}</Badge>;
  if (estado === "pagada") {
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

function EstadoPagoBadge({ estado }: { estado: string }) {
  if (estado === "anulado") return <Badge variant="destructive">Anulado</Badge>;
  return <Badge variant="secondary">Activo</Badge>;
}

function EstadoComercialBadge({ estado }: { estado: string }) {
  const etiqueta = etiquetaEstadoComercial(estado);

  if (estado === "anulada") return <Badge variant="destructive">{etiqueta}</Badge>;
  if (estado === "convertida") {
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

function FiltroNumero({
  valor,
  onChange,
  ariaLabel,
}: {
  readonly valor: string;
  readonly onChange: (valor: string) => void;
  readonly ariaLabel: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Filtrar por número…"
        aria-label={ariaLabel}
        className="pl-8"
      />
    </div>
  );
}

function TablaTransacciones({ filas }: { readonly filas: TransaccionFicha[] }) {
  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Detalle</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Egresos</TableHead>
            <TableHead className="text-right">Ingresos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                No hay transacciones.
              </TableCell>
            </TableRow>
          ) : (
            filas.map((fila) => (
              <TableRow key={fila.clave} className="relative cursor-pointer">
                <TableCell className="font-medium">
                  <Enlace className="absolute inset-0" href={fila.href} aria-label={`Ver ${fila.detalle}`} />
                  <span className="pointer-events-none relative">{formatoDia(fila.fecha)}</span>
                </TableCell>
                <TableCell className="whitespace-normal">{fila.detalle}</TableCell>
                <TableCell>
                  <EstadoPagoBadge estado={fila.estado} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fila.egresosCentavos === 0 ? "—" : formatoMonedaCentavos(fila.egresosCentavos)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fila.ingresosCentavos === 0 ? "—" : formatoMonedaCentavos(fila.ingresosCentavos)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function TablaFacturas({ filas, tipo }: { readonly filas: DocumentoFicha[]; readonly tipo: "venta" | "compra" }) {
  const esVenta = tipo === "venta";

  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número / NCF</TableHead>
            <TableHead>Creación</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">{esVenta ? "Cobrado" : "Pagado"}</TableHead>
            <TableHead className="text-right">{esVenta ? "Por cobrar" : "Por pagar"}</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                No hay facturas.
              </TableCell>
            </TableRow>
          ) : (
            filas.map((fila) => (
              <TableRow key={fila.id} className="relative cursor-pointer">
                <TableCell className="font-medium">
                  <Enlace
                    className="absolute inset-0"
                    href={esVenta ? rutaFactura(fila.id) : rutaCompra(fila.id)}
                    aria-label={`Ver factura ${fila.numero}`}
                  />
                  <span className="pointer-events-none relative flex flex-col">
                    <span>#{fila.numero}</span>
                    <span className="text-muted-foreground font-mono text-xs">{fila.ncf ?? "—"}</span>
                  </span>
                </TableCell>
                <TableCell>{formatoDia(fila.fecha)}</TableCell>
                <TableCell>{formatoDia(fila.vencimiento)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatoMonedaCentavos(aCentavos(fila.total))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatoMonedaCentavos(aCentavos(fila.pagado))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fila.estado === "anulada" ? "—" : formatoMonedaCentavos(saldoDocumento(fila.total, fila.pagado))}
                </TableCell>
                <TableCell>
                  <EstadoDocumentoBadge estado={fila.estado} tipo={tipo} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function TablaComerciales({
  filas,
  tipo,
}: {
  readonly filas: DocumentoComercialFicha[];
  readonly tipo: "cotizacion" | "conduce";
}) {
  const esCotizacion = tipo === "cotizacion";

  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                {esCotizacion ? "No hay cotizaciones." : "No hay conduces."}
              </TableCell>
            </TableRow>
          ) : (
            filas.map((fila) => (
              <TableRow key={fila.id} className="relative cursor-pointer">
                <TableCell className="font-medium">
                  <Enlace
                    className="absolute inset-0"
                    href={esCotizacion ? rutaCotizacion(fila.id) : rutaConduce(fila.id)}
                    aria-label={`Ver ${esCotizacion ? "cotización" : "conduce"} #${fila.numero}`}
                  />
                  <span className="pointer-events-none relative">#{fila.numero}</span>
                </TableCell>
                <TableCell>{formatoDia(fila.fecha)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoMoneda(fila.total)}</TableCell>
                <TableCell>
                  <EstadoComercialBadge estado={fila.estado} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function TablaPagos({ filas, tipo }: { readonly filas: PagoFicha[]; readonly tipo: "recibido" | "proveedor" }) {
  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Factura</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                No hay pagos.
              </TableCell>
            </TableRow>
          ) : (
            filas.map((fila) => (
              <TableRow key={fila.id} className="relative cursor-pointer">
                <TableCell className="font-medium">
                  <Enlace
                    className="absolute inset-0"
                    href={tipo === "recibido" ? rutaPagoRecibido(fila.id) : rutaPagoProveedor(fila.id)}
                    aria-label={`Ver pago ${fila.numero}`}
                  />
                  <span className="pointer-events-none relative">#{fila.numero}</span>
                </TableCell>
                <TableCell>{formatoDia(fila.fecha)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {fila.factura_numero === null ? "—" : `#${fila.factura_numero}`}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatoMonedaCentavos(aCentavos(fila.monto))}
                </TableCell>
                <TableCell>
                  <EstadoPagoBadge estado={fila.estado} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function TablaAsientos({ filas }: { readonly filas: AsientoFicha[] }) {
  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="text-right">Débito</TableHead>
            <TableHead className="text-right">Crédito</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                No hay asientos.
              </TableCell>
            </TableRow>
          ) : (
            filas.map((fila) => (
              <TableRow key={fila.id} className="relative cursor-pointer">
                <TableCell className="font-medium">
                  <Enlace
                    className="absolute inset-0"
                    href={rutaAsiento(fila.id)}
                    aria-label={`Ver asiento ${fila.numero}`}
                  />
                  <span className="pointer-events-none relative">#{fila.numero}</span>
                </TableCell>
                <TableCell>{formatoDia(fila.fecha)}</TableCell>
                <TableCell className="whitespace-normal">{fila.descripcion}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoMonedaCentavos(fila.debitoCentavos)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoMonedaCentavos(fila.creditoCentavos)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
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

export function FichaContacto({
  datos,
  puedeCrear,
}: {
  readonly datos: DatosFichaContacto;
  readonly puedeCrear: boolean;
}) {
  const {
    contacto,
    cuentaCxc,
    cuentaCxp,
    facturas,
    facturasProveedor,
    cotizaciones,
    conduces,
    pagosRecibidos,
    pagosProveedor,
    asientos,
  } = datos;
  const [pestana, setPestana] = useState<PestanaFicha>("transacciones");
  const [filtros, setFiltros] = useState<Record<PestanaFicha, string>>(FILTROS_INICIALES);

  const visibles = PESTANAS.filter((item) => aplicaPestana(item, contacto.tipo));
  const porCobrar = totalPorCobrar(facturas);
  const anticipos = totalAnticipos(pagosRecibidos);
  const porPagar = totalPorPagar(facturasProveedor);

  function cambiarPestana(valor: string | number) {
    const encontrada = PESTANAS.find((item) => item.valor === valor);
    if (encontrada) setPestana(encontrada.valor);
  }

  function cambiarFiltro(valor: PestanaFicha, texto: string) {
    setFiltros((actuales) => ({ ...actuales, [valor]: texto }));
  }

  function tablaDe(valor: PestanaFicha) {
    if (valor === "transacciones") {
      return (
        <TablaTransacciones
          filas={filtrarPorNumero(construirTransacciones(pagosRecibidos, pagosProveedor), filtros.transacciones)}
        />
      );
    }
    if (valor === "facturas")
      return <TablaFacturas filas={filtrarPorNumero(facturas, filtros.facturas)} tipo="venta" />;
    if (valor === "facturas-proveedor") {
      return <TablaFacturas filas={filtrarPorNumero(facturasProveedor, filtros["facturas-proveedor"])} tipo="compra" />;
    }
    if (valor === "cotizaciones") {
      return <TablaComerciales filas={filtrarPorNumero(cotizaciones, filtros.cotizaciones)} tipo="cotizacion" />;
    }
    if (valor === "conduces") {
      return <TablaComerciales filas={filtrarPorNumero(conduces, filtros.conduces)} tipo="conduce" />;
    }
    if (valor === "pagos-recibidos") {
      return <TablaPagos filas={filtrarPorNumero(pagosRecibidos, filtros["pagos-recibidos"])} tipo="recibido" />;
    }
    if (valor === "pagos-proveedores") {
      return <TablaPagos filas={filtrarPorNumero(pagosProveedor, filtros["pagos-proveedores"])} tipo="proveedor" />;
    }
    return <TablaAsientos filas={filtrarPorNumero(asientos, filtros.asientos)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/contactos" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Contactos
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{contacto.nombre}</h1>
            <Badge variant="secondary">{etiquetaTipoContacto(contacto.tipo)}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {puedeCrear && contacto.tipo !== "proveedor" ? (
              <Button render={<Link href={`/dashboard/facturacion/nueva?cliente=${contacto.id}`} prefetch={false} />}>
                <FilePlus2 data-icon="inline-start" />
                Nueva factura
              </Button>
            ) : null}
            {puedeCrear && contacto.tipo !== "cliente" ? (
              <Button render={<Link href="/dashboard/compras/nueva" prefetch={false} />}>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Nombre</dt>
            <dd className="font-medium">{contacto.nombre}</dd>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd>{etiquetaTipoContacto(contacto.tipo)}</dd>
            <dt className="text-muted-foreground">RNC / Cédula</dt>
            <dd className="tabular-nums">{contacto.rnc_cedula ?? "—"}</dd>
            <dt className="text-muted-foreground">Teléfono</dt>
            <dd className="tabular-nums">{contacto.telefono ?? "—"}</dd>
            <dt className="text-muted-foreground">Correo</dt>
            <dd>{contacto.correo ?? "—"}</dd>
            <dt className="text-muted-foreground">Dirección</dt>
            <dd className="whitespace-pre-line">{contacto.direccion ?? "—"}</dd>
          </dl>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
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

      <div className="grid gap-4 sm:grid-cols-3">
        <TarjetaResumen titulo="Por cobrar" centavos={porCobrar} />
        <TarjetaResumen titulo="Anticipos recibidos" centavos={anticipos} />
        <TarjetaResumen titulo="Por pagar" centavos={porPagar} />
      </div>

      <Tabs value={pestana} onValueChange={cambiarPestana}>
        <TabsList className="max-w-full justify-start overflow-x-auto">
          {visibles.map((item) => (
            <TabsTrigger key={item.valor} value={item.valor}>
              {item.etiqueta}
            </TabsTrigger>
          ))}
        </TabsList>

        {visibles.map((item) => (
          <TabsContent key={item.valor} value={item.valor} className="flex flex-col gap-3">
            <FiltroNumero
              valor={filtros[item.valor]}
              onChange={(texto) => cambiarFiltro(item.valor, texto)}
              ariaLabel={`Filtrar ${item.etiqueta} por número`}
            />
            {tablaDe(item.valor)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
