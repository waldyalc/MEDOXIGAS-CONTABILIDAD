"use client";

import { type ReactNode, useState } from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  EllipsisVertical,
  FileText,
  Hash,
  LayoutGrid,
  Package,
  Percent,
  ReceiptText,
  Search,
  ShoppingCart,
  Tag,
  Truck,
  Wrench,
} from "lucide-react";

import { Enlace } from "@/components/enlace";
import {
  BotonFiltro,
  CLASE_PANEL_FICHA,
  GrillaKpis,
  ItemDato,
  ItemPestana,
  type KpiFicha,
  MetaItem,
  type OpcionFiltro,
  PiePagina,
  TH,
  usePagina,
} from "@/components/ficha/ficha-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { etiquetaEstadoDocumento } from "@/lib/contactos/ficha";
import { rutaCompra, rutaConduce, rutaContacto, rutaCotizacion, rutaCuenta, rutaFactura } from "@/lib/enlaces";
import { formatoCantidad, formatoMoneda, formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import {
  type CuentaFicha,
  type FichaProducto as DatosFichaProducto,
  type DocumentoComercialFicha,
  type DocumentoFicha,
  type DocumentoNumerado,
  etiquetaEstadoComercial,
  filtrarPorNumero,
  precioConItbis,
  saldoCentavos,
  sumarCantidades,
} from "@/lib/productos/ficha";
import type { FilaKardex } from "@/lib/productos/kardex";
import { etiquetaTasaItbis } from "@/lib/productos/productos";

const POR_PAGINA = 10;

type PestanaProducto = "resumen" | "ventas" | "compras" | "cotizaciones" | "conduces" | "kardex";

function numeroDocumento(prefijo: string, numero: number): string {
  return `${prefijo}-${String(numero).padStart(4, "0")}`;
}

function EstadoBadge({ estado, etiqueta }: { readonly estado: string; readonly etiqueta: string }) {
  if (estado === "anulada") return <Badge variant="destructive">{etiqueta}</Badge>;
  if (estado === "pagada" || estado === "convertida") {
    return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{etiqueta}</Badge>;
  }
  return <Badge variant="secondary">{etiqueta}</Badge>;
}

function FilaVacia({ columnas, children }: { readonly columnas: number; readonly children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={columnas} className="text-muted-foreground py-10 text-center whitespace-normal">
        {children}
      </TableCell>
    </TableRow>
  );
}

function CeldaDocumento({
  href,
  prefijo,
  numero,
  ncf,
}: {
  readonly href: string;
  readonly prefijo: string;
  readonly numero: number;
  readonly ncf?: string | null;
}) {
  const id = numeroDocumento(prefijo, numero);
  return (
    <TableCell>
      <Enlace className="absolute inset-0" href={href} aria-label={`Ver ${id}`} />
      <span className="pointer-events-none relative flex flex-col">
        <span className="text-primary font-medium">{id}</span>
        {ncf ? <span className="text-muted-foreground font-mono text-xs">{ncf}</span> : null}
      </span>
    </TableCell>
  );
}

function EnlaceTercero({ id, nombre }: { readonly id: string; readonly nombre: string }) {
  return (
    <Enlace href={rutaContacto(id)} className="text-foreground relative font-medium">
      {nombre}
    </Enlace>
  );
}

function ListaBuscable<T extends DocumentoNumerado>({
  filas,
  unidad,
  children,
}: {
  readonly filas: readonly T[];
  readonly unidad: string;
  readonly children: (visibles: readonly T[], filtrado: boolean) => ReactNode;
}) {
  const [busqueda, setBusqueda] = useState("");
  const filtradas = filtrarPorNumero(filas, busqueda);
  const { pagina, setPagina } = usePagina(filtradas.length, POR_PAGINA);
  const visibles = filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative w-full max-w-xs">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por número o NCF…"
          aria-label={`Buscar ${unidad}`}
          className="pl-8"
        />
      </div>
      {children(visibles, busqueda.trim() !== "")}
      <PiePagina
        total={filtradas.length}
        porPagina={POR_PAGINA}
        pagina={pagina}
        setPagina={setPagina}
        unidad={unidad}
      />
    </div>
  );
}

function TablaFacturas({
  documentos,
  tipo,
  filtrado,
}: {
  readonly documentos: readonly DocumentoFicha[];
  readonly tipo: "venta" | "compra";
  readonly filtrado: boolean;
}) {
  const esVenta = tipo === "venta";
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={TH}>Factura</TableHead>
          <TableHead className={TH}>{esVenta ? "Cliente" : "Proveedor"}</TableHead>
          <TableHead className={TH}>Fecha</TableHead>
          <TableHead className={TH}>Vence</TableHead>
          <TableHead className={cn(TH, "text-right")}>Cantidad</TableHead>
          <TableHead className={cn(TH, "text-right")}>Total</TableHead>
          <TableHead className={cn(TH, "text-right")}>{esVenta ? "Por cobrar" : "Por pagar"}</TableHead>
          <TableHead className={TH}>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documentos.length === 0 ? (
          <FilaVacia columnas={8}>
            {filtrado
              ? "No se encontraron facturas con ese filtro."
              : `Este producto todavía no tiene facturas de ${esVenta ? "venta" : "compra"}.`}
          </FilaVacia>
        ) : (
          documentos.map((documento) => (
            <TableRow key={documento.id} className="relative cursor-pointer">
              <CeldaDocumento
                href={esVenta ? rutaFactura(documento.id) : rutaCompra(documento.id)}
                prefijo={esVenta ? "FAC" : "COM"}
                numero={documento.numero}
                ncf={documento.ncf}
              />
              <TableCell>
                <EnlaceTercero id={documento.contactoId} nombre={documento.contactoNombre} />
              </TableCell>
              <TableCell className="text-muted-foreground">{formatoDia(documento.fecha)}</TableCell>
              <TableCell className="text-muted-foreground">{formatoDia(documento.vencimiento)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatoCantidad(documento.cantidad)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(documento.total)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatoMonedaCentavos(saldoCentavos(documento.total, documento.pagado, documento.credito))}
              </TableCell>
              <TableCell>
                <EstadoBadge estado={documento.estado} etiqueta={etiquetaEstadoDocumento(documento.estado, tipo)} />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function TablaComerciales({
  documentos,
  tipo,
  filtrado,
}: {
  readonly documentos: readonly DocumentoComercialFicha[];
  readonly tipo: "cotizacion" | "conduce";
  readonly filtrado: boolean;
}) {
  const esCotizacion = tipo === "cotizacion";
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={TH}>{esCotizacion ? "Cotización" : "Conduce"}</TableHead>
          <TableHead className={TH}>Fecha</TableHead>
          <TableHead className={cn(TH, "text-right")}>Total</TableHead>
          <TableHead className={TH}>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documentos.length === 0 ? (
          <FilaVacia columnas={4}>
            {filtrado
              ? "No se encontraron documentos con ese filtro."
              : `Este producto todavía no tiene ${esCotizacion ? "cotizaciones" : "conduces"}.`}
          </FilaVacia>
        ) : (
          documentos.map((documento) => (
            <TableRow key={documento.id} className="relative cursor-pointer">
              <CeldaDocumento
                href={esCotizacion ? rutaCotizacion(documento.id) : rutaConduce(documento.id)}
                prefijo={esCotizacion ? "COT" : "CON"}
                numero={documento.numero}
              />
              <TableCell className="text-muted-foreground">{formatoDia(documento.fecha)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(documento.total)}</TableCell>
              <TableCell>
                <EstadoBadge estado={documento.estado} etiqueta={etiquetaEstadoComercial(documento.estado)} />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function TablaKardex({ filas, filtrado }: { readonly filas: readonly FilaKardex[]; readonly filtrado: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={TH}>Documento</TableHead>
          <TableHead className={TH}>Fecha</TableHead>
          <TableHead className={TH}>Tercero</TableHead>
          <TableHead className={cn(TH, "text-right")}>Entrada</TableHead>
          <TableHead className={cn(TH, "text-right")}>Salida</TableHead>
          <TableHead className={cn(TH, "text-right")}>Costo unitario</TableHead>
          <TableHead className={cn(TH, "text-right")}>Existencia</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.length === 0 ? (
          <FilaVacia columnas={7}>
            {filtrado
              ? "No se encontraron movimientos con ese filtro."
              : "Este producto todavía no tiene movimientos de inventario."}
          </FilaVacia>
        ) : (
          filas.map((fila) => (
            <TableRow key={`${fila.tipo}:${fila.documentoId}`} className="relative cursor-pointer">
              <CeldaDocumento
                href={fila.tipo === "venta" ? rutaFactura(fila.documentoId) : rutaCompra(fila.documentoId)}
                prefijo={fila.tipo === "venta" ? "FAC" : "COM"}
                numero={fila.numero}
                ncf={fila.ncf}
              />
              <TableCell className="text-muted-foreground">{formatoDia(fila.fecha)}</TableCell>
              <TableCell>
                <EnlaceTercero id={fila.terceroId} nombre={fila.terceroNombre} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {fila.entrada > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">+{formatoCantidad(fila.entrada)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {fila.salida > 0 ? (
                  <span className="text-red-500">-{formatoCantidad(fila.salida)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatoMoneda(fila.costoUnitario)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatoCantidad(fila.existencia)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function CuentaEnlace({ cuenta }: { readonly cuenta: CuentaFicha | null }) {
  if (!cuenta) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1">
      <Enlace href={rutaCuenta(cuenta.cuenta.id)} className="font-medium">
        {cuenta.cuenta.codigo} · {cuenta.cuenta.nombre}
      </Enlace>
      {cuenta.porDefecto ? <span className="text-muted-foreground text-xs font-normal">(por defecto)</span> : null}
    </span>
  );
}

function ContenidoResumen({ ficha }: { readonly ficha: DatosFichaProducto }) {
  const { producto, cuentas, existencias, kardex } = ficha;
  const esServicio = producto.tipo === "servicio";

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Información general</h2>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <ItemDato etiqueta="Nombre">{producto.nombre}</ItemDato>
          <ItemDato etiqueta="Referencia">{producto.referencia?.trim() || "—"}</ItemDato>
          <ItemDato etiqueta="Tipo">{esServicio ? "Servicio" : "Producto"}</ItemDato>
          <ItemDato etiqueta="Inventariable">{producto.inventariable ? "Sí" : "No"}</ItemDato>
          <div className="sm:col-span-2">
            <ItemDato etiqueta="Descripción">
              <span className="whitespace-pre-line">{producto.descripcion?.trim() || "—"}</span>
            </ItemDato>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Precio</h2>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <ItemDato etiqueta="Precio sin ITBIS">
            <span className="tabular-nums">{formatoMoneda(producto.precio)}</span>
          </ItemDato>
          <ItemDato etiqueta="ITBIS">{etiquetaTasaItbis(producto.itbis_tasa)}</ItemDato>
          <ItemDato etiqueta="Precio con ITBIS">
            <span className="tabular-nums">{formatoMoneda(precioConItbis(producto.precio, producto.itbis_tasa))}</span>
          </ItemDato>
          <ItemDato etiqueta="Costo">
            <span className="tabular-nums">{formatoMoneda(producto.costo)}</span>
          </ItemDato>
        </dl>
      </section>

      {producto.inventariable ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold">Inventario</h2>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <ItemDato etiqueta="Existencia inicial">
              <span className="tabular-nums">{formatoCantidad(kardex.existenciaInicial)}</span>
            </ItemDato>
            <ItemDato etiqueta="Existencia actual">
              <span className="tabular-nums">{formatoCantidad(producto.cantidad)}</span>
            </ItemDato>
            {/* TODO backend: no existe la existencia mínima del producto. */}
            <ItemDato etiqueta="Existencia mínima">—</ItemDato>
          </dl>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TH}>Almacén</TableHead>
                <TableHead className={cn(TH, "text-right")}>Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existencias.length === 0 ? (
                <FilaVacia columnas={2}>Sin existencias registradas por almacén.</FilaVacia>
              ) : (
                existencias.map((existencia) => (
                  <TableRow key={existencia.almacen_id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {existencia.almacen_nombre}
                        {existencia.es_principal ? (
                          <Badge className="bg-primary/10 text-primary">Principal</Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatoCantidad(existencia.cantidad)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Contabilidad</h2>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <ItemDato etiqueta="Cuenta de ingreso">
            <CuentaEnlace cuenta={cuentas.ingreso} />
          </ItemDato>
          {producto.inventariable ? (
            <ItemDato etiqueta="Cuenta de inventario">
              <CuentaEnlace cuenta={cuentas.inventario} />
            </ItemDato>
          ) : null}
          <ItemDato etiqueta="Cuenta de costo">
            <CuentaEnlace cuenta={cuentas.costo} />
          </ItemDato>
        </dl>
      </section>
    </div>
  );
}

function Pildora({ className, children }: { readonly className: string; readonly children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

function EncabezadoProducto({
  producto,
  puedeEscribir,
}: {
  readonly producto: DatosFichaProducto["producto"];
  readonly puedeEscribir: boolean;
}) {
  const esServicio = producto.tipo === "servicio";
  const id = encodeURIComponent(producto.id);

  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3.5">
        <div className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-lg">
          {esServicio ? <Wrench className="size-6" /> : <Package className="size-6" />}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{producto.nombre}</h1>
            <Pildora className="bg-primary/10 text-primary">{esServicio ? "Servicio" : "Producto"}</Pildora>
            {producto.inventariable ? (
              <Pildora className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Inventariable
              </Pildora>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <MetaItem
              icono={<Hash className="size-3.5" />}
              texto={`Ref: ${producto.referencia?.trim() || "Sin referencia"}`}
            />
            <MetaItem
              icono={<Tag className="size-3.5" />}
              texto={formatoMoneda(precioConItbis(producto.precio, producto.itbis_tasa))}
            />
            <MetaItem
              icono={<Percent className="size-3.5" />}
              texto={`ITBIS ${etiquetaTasaItbis(producto.itbis_tasa)}`}
            />
            {producto.inventariable ? (
              <MetaItem
                icono={<Boxes className="size-3.5" />}
                texto={`Existencia: ${formatoCantidad(producto.cantidad)}`}
              />
            ) : null}
          </div>
        </div>
      </div>
      {puedeEscribir ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            nativeButton={false}
            render={<Link href={`/dashboard/facturacion/nueva?producto=${id}`} prefetch={false} />}
          >
            <ReceiptText data-icon="inline-start" />
            Facturar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Más acciones" />}>
              <EllipsisVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem render={<Link href={`/dashboard/compras/nueva?producto=${id}`} prefetch={false} />}>
                <ShoppingCart />
                Comprar este producto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}

function construirKpis(ficha: DatosFichaProducto): KpiFicha[] {
  const { producto, facturasVenta, facturasCompra } = ficha;
  const kpis: KpiFicha[] = [
    {
      etiqueta: "Precio con ITBIS",
      valor: formatoMoneda(precioConItbis(producto.precio, producto.itbis_tasa)),
      tono: "normal",
    },
    { etiqueta: "Costo", valor: formatoMoneda(producto.costo), tono: "normal" },
  ];
  if (producto.inventariable) {
    kpis.push({
      etiqueta: "Existencia actual",
      valor: formatoCantidad(producto.cantidad),
      tono: producto.cantidad > 0 ? "normal" : "pendiente",
    });
  }
  kpis.push(
    {
      etiqueta: "Unidades vendidas",
      valor: formatoCantidad(sumarCantidades(facturasVenta.map((factura) => factura.cantidad))),
      tono: "positivo",
    },
    {
      etiqueta: "Unidades compradas",
      valor: formatoCantidad(sumarCantidades(facturasCompra.map((factura) => factura.cantidad))),
      tono: "normal",
    },
  );
  return kpis;
}

function opcionesEstado(documentos: readonly DocumentoFicha[], tipo: "venta" | "compra"): OpcionFiltro[] {
  const estados = [...new Set(documentos.map((documento) => documento.estado))];
  return [
    { valor: "todos", etiqueta: "Todos los estados" },
    ...estados.map((estado) => ({ valor: estado, etiqueta: etiquetaEstadoDocumento(estado, tipo) })),
  ];
}

function filtrarEstado<T extends { estado: string }>(documentos: readonly T[], estado: string): readonly T[] {
  return estado === "todos" ? documentos : documentos.filter((documento) => documento.estado === estado);
}

export function FichaProducto({
  ficha,
  puedeEscribir,
}: {
  readonly ficha: DatosFichaProducto;
  readonly puedeEscribir: boolean;
}) {
  const { producto, facturasVenta, facturasCompra, cotizaciones, conduces, kardex } = ficha;
  const [pestana, setPestana] = useState<PestanaProducto>("resumen");
  const [estadoVentas, setEstadoVentas] = useState("todos");
  const [estadoCompras, setEstadoCompras] = useState("todos");

  const opcionesVentas = opcionesEstado(facturasVenta, "venta");
  const opcionesCompras = opcionesEstado(facturasCompra, "compra");

  const pestanas: { valor: PestanaProducto; etiqueta: string; icono: ReactNode }[] = [
    { valor: "resumen", etiqueta: "Resumen", icono: <LayoutGrid className="size-4" /> },
    { valor: "ventas", etiqueta: "Ventas", icono: <ReceiptText className="size-4" /> },
    { valor: "compras", etiqueta: "Compras", icono: <ShoppingCart className="size-4" /> },
    { valor: "cotizaciones", etiqueta: "Cotizaciones", icono: <FileText className="size-4" /> },
    { valor: "conduces", etiqueta: "Conduces", icono: <Truck className="size-4" /> },
  ];
  if (producto.inventariable) {
    pestanas.push({ valor: "kardex", etiqueta: "Kárdex", icono: <ClipboardList className="size-4" /> });
  }

  return (
    <div className="flex flex-col gap-6" style={{ fontFamily: "var(--font-inter)" }}>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/dashboard/productos" prefetch={false} />}
      >
        <ArrowLeft data-icon="inline-start" />
        Productos
      </Button>

      <div className={CLASE_PANEL_FICHA}>
        <EncabezadoProducto producto={producto} puedeEscribir={puedeEscribir} />

        <div className="px-5 pb-5">
          <GrillaKpis kpis={construirKpis(ficha)} />
        </div>

        <Tabs value={pestana} className="gap-0">
          <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-2 sm:px-4">
            <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Secciones de la ficha">
              {pestanas.map((item) => (
                <ItemPestana
                  key={item.valor}
                  activo={pestana === item.valor}
                  onClick={() => setPestana(item.valor)}
                  icono={item.icono}
                  etiqueta={item.etiqueta}
                />
              ))}
            </nav>
            <div className="flex items-center gap-2 py-1.5">
              {pestana === "ventas" && opcionesVentas.length > 2 ? (
                <BotonFiltro valor={estadoVentas} opciones={opcionesVentas} onCambiar={setEstadoVentas} />
              ) : null}
              {pestana === "compras" && opcionesCompras.length > 2 ? (
                <BotonFiltro valor={estadoCompras} opciones={opcionesCompras} onCambiar={setEstadoCompras} />
              ) : null}
            </div>
          </div>

          <TabsContent value="resumen" className="p-4 sm:p-5">
            <ContenidoResumen ficha={ficha} />
          </TabsContent>

          <TabsContent value="ventas" className="p-4 sm:p-5">
            <ListaBuscable filas={filtrarEstado(facturasVenta, estadoVentas)} unidad="facturas">
              {(visibles, filtrado) => (
                <TablaFacturas documentos={visibles} tipo="venta" filtrado={filtrado || estadoVentas !== "todos"} />
              )}
            </ListaBuscable>
          </TabsContent>

          <TabsContent value="compras" className="p-4 sm:p-5">
            <ListaBuscable filas={filtrarEstado(facturasCompra, estadoCompras)} unidad="facturas">
              {(visibles, filtrado) => (
                <TablaFacturas documentos={visibles} tipo="compra" filtrado={filtrado || estadoCompras !== "todos"} />
              )}
            </ListaBuscable>
          </TabsContent>

          <TabsContent value="cotizaciones" className="p-4 sm:p-5">
            <ListaBuscable filas={cotizaciones} unidad="cotizaciones">
              {(visibles, filtrado) => <TablaComerciales documentos={visibles} tipo="cotizacion" filtrado={filtrado} />}
            </ListaBuscable>
          </TabsContent>

          <TabsContent value="conduces" className="p-4 sm:p-5">
            <ListaBuscable filas={conduces} unidad="conduces">
              {(visibles, filtrado) => <TablaComerciales documentos={visibles} tipo="conduce" filtrado={filtrado} />}
            </ListaBuscable>
          </TabsContent>

          {producto.inventariable ? (
            <TabsContent value="kardex" className="p-4 sm:p-5">
              <ListaBuscable filas={kardex.filas} unidad="movimientos">
                {(visibles, filtrado) => <TablaKardex filas={visibles} filtrado={filtrado} />}
              </ListaBuscable>
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </div>
  );
}
