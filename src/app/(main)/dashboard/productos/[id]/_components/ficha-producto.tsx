"use client";

import { type ReactNode, useState } from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  ArrowLeft,
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  ClipboardPen,
  EllipsisVertical,
  FileMinus,
  FilePlus,
  FileText,
  Hash,
  Info,
  Package,
  Percent,
  ReceiptText,
  ShoppingCart,
  Tag,
  Truck,
  Wrench,
} from "lucide-react";

import {
  BotonFiltro,
  CLASE_PANEL_FICHA,
  GrillaKpis,
  ItemPestana,
  type KpiFicha,
  MetaItem,
  type OpcionFiltro,
} from "@/components/ficha/ficha-ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { etiquetaEstadoDocumento } from "@/lib/contactos/ficha";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import {
  type FichaProducto as DatosFichaProducto,
  type DocumentoFicha,
  precioConItbis,
  sumarCantidades,
} from "@/lib/productos/ficha";
import { etiquetaTasaItbis } from "@/lib/productos/productos";

import { InformacionGeneral } from "./informacion-general";
import { ListaBuscable, PendienteBackend, TablaComerciales, TablaFacturas, TablaKardex } from "./tablas-producto";

type PestanaProducto =
  | "informacion"
  | "facturas-venta"
  | "facturas-proveedor"
  | "notas-credito"
  | "notas-debito"
  | "cotizaciones"
  | "conduces"
  | "ordenes-compra"
  | "transferencias"
  | "kardex";

/* TODO backend: la ficha no recibe estos documentos del producto
   (nota_credito_venta_lineas / nota_credito_compra_lineas, nota_debito_venta_lineas,
   orden_compra_lineas, transferencia_inventario_lineas). */
const PENDIENTES: { valor: PestanaProducto; titulo: string; icono: ReactNode }[] = [
  { valor: "notas-credito", titulo: "notas de crédito", icono: <FileMinus /> },
  { valor: "notas-debito", titulo: "notas de débito", icono: <FilePlus /> },
  { valor: "ordenes-compra", titulo: "órdenes de compra", icono: <ClipboardPen /> },
  { valor: "transferencias", titulo: "transferencias entre almacenes", icono: <ArrowLeftRight /> },
];

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
  onVerHistorial,
}: {
  readonly producto: DatosFichaProducto["producto"];
  readonly puedeEscribir: boolean;
  readonly onVerHistorial: () => void;
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
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {puedeEscribir ? (
          <>
            <Button
              nativeButton={false}
              render={<Link href={`/dashboard/facturacion/nueva?producto=${id}`} prefetch={false} />}
            >
              <ReceiptText data-icon="inline-start" />
              Facturar este producto
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/dashboard/compras/nueva?producto=${id}`} prefetch={false} />}
            >
              <ShoppingCart data-icon="inline-start" />
              Comprar este producto
            </Button>
          </>
        ) : null}
        {producto.inventariable ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Más acciones" />}>
              <EllipsisVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={onVerHistorial}>
                <ClipboardList />
                Historial de operaciones
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
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
  const [pestana, setPestana] = useState<PestanaProducto>("informacion");
  const [estadoVentas, setEstadoVentas] = useState("todos");
  const [estadoCompras, setEstadoCompras] = useState("todos");

  const opcionesVentas = opcionesEstado(facturasVenta, "venta");
  const opcionesCompras = opcionesEstado(facturasCompra, "compra");
  const verHistorial = () => setPestana("kardex");

  const pestanas: { valor: PestanaProducto; etiqueta: string; icono: ReactNode }[] = [
    { valor: "informacion", etiqueta: "Información general", icono: <Info className="size-4" /> },
    { valor: "facturas-venta", etiqueta: "Facturas de venta", icono: <ReceiptText className="size-4" /> },
    { valor: "facturas-proveedor", etiqueta: "Facturas de proveedor", icono: <ShoppingCart className="size-4" /> },
    { valor: "notas-credito", etiqueta: "Notas de crédito", icono: <FileMinus className="size-4" /> },
    { valor: "notas-debito", etiqueta: "Notas de débito", icono: <FilePlus className="size-4" /> },
    { valor: "cotizaciones", etiqueta: "Cotizaciones", icono: <FileText className="size-4" /> },
    { valor: "conduces", etiqueta: "Conduces", icono: <Truck className="size-4" /> },
    { valor: "ordenes-compra", etiqueta: "Órdenes de compra", icono: <ClipboardPen className="size-4" /> },
  ];
  if (producto.inventariable) {
    pestanas.push(
      { valor: "transferencias", etiqueta: "Transferencias", icono: <ArrowLeftRight className="size-4" /> },
      { valor: "kardex", etiqueta: "Kárdex", icono: <ClipboardList className="size-4" /> },
    );
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
        <EncabezadoProducto producto={producto} puedeEscribir={puedeEscribir} onVerHistorial={verHistorial} />

        <div className="px-5 pb-5">
          <GrillaKpis kpis={construirKpis(ficha)} />
        </div>

        <Tabs value={pestana} className="gap-0">
          <div className="border-border flex items-center justify-between gap-2 border-b px-2 sm:px-4">
            <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Secciones de la ficha">
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
            <div className={cn("flex shrink-0 items-center gap-2 py-1.5")}>
              {pestana === "facturas-venta" && opcionesVentas.length > 2 ? (
                <BotonFiltro valor={estadoVentas} opciones={opcionesVentas} onCambiar={setEstadoVentas} />
              ) : null}
              {pestana === "facturas-proveedor" && opcionesCompras.length > 2 ? (
                <BotonFiltro valor={estadoCompras} opciones={opcionesCompras} onCambiar={setEstadoCompras} />
              ) : null}
            </div>
          </div>

          <TabsContent value="informacion" className="p-4 sm:p-5">
            <InformacionGeneral ficha={ficha} onVerHistorial={verHistorial} />
          </TabsContent>

          <TabsContent value="facturas-venta" className="p-4 sm:p-5">
            <ListaBuscable filas={filtrarEstado(facturasVenta, estadoVentas)} unidad="facturas">
              {(visibles, filtrado) => (
                <TablaFacturas documentos={visibles} tipo="venta" filtrado={filtrado || estadoVentas !== "todos"} />
              )}
            </ListaBuscable>
          </TabsContent>

          <TabsContent value="facturas-proveedor" className="p-4 sm:p-5">
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

          {PENDIENTES.map((item) => (
            <TabsContent key={item.valor} value={item.valor} className="p-4 sm:p-5">
              <PendienteBackend
                icono={item.icono}
                titulo={`Aún no se muestran las ${item.titulo}`}
                descripcion={`Falta que el sistema envíe a esta ficha las ${item.titulo} donde aparece este producto.`}
              />
            </TabsContent>
          ))}

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
