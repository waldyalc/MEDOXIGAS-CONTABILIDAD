"use client";

import { type ReactNode, useState } from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  ArrowLeftRight,
  Barcode,
  Boxes,
  ClipboardList,
  ClipboardPen,
  EllipsisVertical,
  FileMinus,
  FilePlus,
  FileText,
  Hash,
  Info,
  Layers,
  Package,
  Percent,
  ReceiptText,
  Ruler,
  ShoppingCart,
  SquarePen,
  Star,
  Tag,
  Truck,
  Warehouse,
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
  Pildora,
} from "@/components/ficha/ficha-ui";
import { ContenedorDetalle } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { etiquetaEstadoDocumento } from "@/lib/contactos/ficha";
import { rutaEditarProducto } from "@/lib/enlaces";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import type { CodigoBarra, ComponenteCombo, UnidadMedida } from "@/lib/inventario/ferreteria/tipos";
import {
  type FichaProducto as DatosFichaProducto,
  type DocumentoFicha,
  precioConItbis,
  sumarCantidades,
} from "@/lib/productos/ficha";
import { etiquetaTasaItbis, etiquetaTipoProducto } from "@/lib/productos/productos";

import type { DatosFerreteriaProducto, ExistenciaFerreteria } from "../../_components/ferreteria-datos";
import { InformacionGeneral, TablaExistencias } from "./informacion-general";
import { ListaBuscable, PendienteBackend, TablaComerciales, TablaFacturas, TablaKardex } from "./tablas-producto";
import { TablaCodigos, TablaComponentesCombo, TablaUnidades } from "./tabs-ferreteria";

type PestanaProducto =
  | "datos"
  | "codigos"
  | "unidades"
  | "combo"
  | "existencias"
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

function EncabezadoProducto({
  producto,
  puedeEscribir,
  datosFerreteria,
}: {
  readonly producto: DatosFichaProducto["producto"];
  readonly puedeEscribir: boolean;
  readonly datosFerreteria: DatosFerreteriaProducto | null;
}) {
  const Icono = producto.tipo === "servicio" ? Wrench : Package;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3.5">
        <div className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg">
          {producto.imagenUrl ? (
            // biome-ignore lint/performance/noImgElement: imagen del producto guardada en Storage
            <img src={producto.imagenUrl} alt={producto.nombre} className="size-full object-cover" />
          ) : (
            <Icono className="size-6" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Pildora className="bg-primary/10 text-primary">{etiquetaTipoProducto(producto.tipo)}</Pildora>
            {producto.inventariable ? (
              <Pildora className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Inventariable
              </Pildora>
            ) : null}
            {producto.vendeNegativo ? (
              <Pildora className="bg-amber-500/10 text-amber-700 dark:text-amber-400">Venta en negativo</Pildora>
            ) : null}
            {datosFerreteria?.favorito_pos ? (
              <Pildora className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <Star className="size-3" />
                Favorito POS
              </Pildora>
            ) : null}
            {!puedeEscribir ? (
              <Pildora className="bg-slate-500/10 text-slate-600 dark:text-slate-300">Solo lectura</Pildora>
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
            <MetaItem icono={<Boxes className="size-3.5" />} texto={`Unidad: ${producto.unidadMedida}`} />
            {datosFerreteria?.marca?.trim() ? (
              <MetaItem icono={<Tag className="size-3.5" />} texto={`Marca: ${datosFerreteria.marca}`} />
            ) : null}
            {datosFerreteria?.ubicacion?.trim() ? (
              <MetaItem icono={<Warehouse className="size-3.5" />} texto={`Ubicación: ${datosFerreteria.ubicacion}`} />
            ) : null}
            {producto.inventariable ? (
              <MetaItem
                icono={<Boxes className="size-3.5" />}
                texto={`Existencia: ${formatoCantidad(producto.cantidad)}`}
              />
            ) : null}
          </div>
        </div>
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

function subtituloProducto(
  producto: DatosFichaProducto["producto"],
  datosFerreteria: DatosFerreteriaProducto | null,
): string {
  const partes = [etiquetaTipoProducto(producto.tipo)];
  if (producto.referencia?.trim()) partes.push(`Ref. ${producto.referencia}`);
  if (datosFerreteria?.marca?.trim()) partes.push(datosFerreteria.marca);
  return partes.join(" · ");
}

export function FichaProducto({
  ficha,
  puedeEscribir,
  datosFerreteria,
  existencias,
  codigosBarra,
  unidadesMedida,
  componentesCombo,
}: {
  readonly ficha: DatosFichaProducto;
  readonly puedeEscribir: boolean;
  readonly datosFerreteria: DatosFerreteriaProducto | null;
  readonly existencias: readonly ExistenciaFerreteria[];
  readonly codigosBarra: readonly CodigoBarra[];
  readonly unidadesMedida: readonly UnidadMedida[];
  readonly componentesCombo: readonly ComponenteCombo[];
}) {
  const { producto, facturasVenta, facturasCompra, cotizaciones, conduces, kardex } = ficha;
  const [pestana, setPestana] = useState<PestanaProducto>("datos");
  const [estadoVentas, setEstadoVentas] = useState("todos");
  const [estadoCompras, setEstadoCompras] = useState("todos");

  const opcionesVentas = opcionesEstado(facturasVenta, "venta");
  const opcionesCompras = opcionesEstado(facturasCompra, "compra");
  const verHistorial = () => setPestana("kardex");

  const pestanas: { valor: PestanaProducto; etiqueta: string; icono: ReactNode }[] = [
    { valor: "datos", etiqueta: "Datos", icono: <Info className="size-4" /> },
    { valor: "codigos", etiqueta: "Códigos", icono: <Barcode className="size-4" /> },
    { valor: "unidades", etiqueta: "Unidades", icono: <Ruler className="size-4" /> },
  ];
  if (producto.tipo === "combo") {
    pestanas.push({ valor: "combo", etiqueta: "Combo", icono: <Layers className="size-4" /> });
  }
  if (producto.inventariable) {
    pestanas.push({ valor: "existencias", etiqueta: "Existencias", icono: <Warehouse className="size-4" /> });
  }
  pestanas.push(
    { valor: "facturas-venta", etiqueta: "Facturas de venta", icono: <ReceiptText className="size-4" /> },
    { valor: "facturas-proveedor", etiqueta: "Facturas de proveedor", icono: <ShoppingCart className="size-4" /> },
    { valor: "notas-credito", etiqueta: "Notas de crédito", icono: <FileMinus className="size-4" /> },
    { valor: "notas-debito", etiqueta: "Notas de débito", icono: <FilePlus className="size-4" /> },
    { valor: "cotizaciones", etiqueta: "Cotizaciones", icono: <FileText className="size-4" /> },
    { valor: "conduces", etiqueta: "Conduces", icono: <Truck className="size-4" /> },
    { valor: "ordenes-compra", etiqueta: "Órdenes de compra", icono: <ClipboardPen className="size-4" /> },
  );
  if (producto.inventariable) {
    pestanas.push(
      { valor: "transferencias", etiqueta: "Transferencias", icono: <ArrowLeftRight className="size-4" /> },
      { valor: "kardex", etiqueta: "Kárdex", icono: <ClipboardList className="size-4" /> },
    );
  }

  const hrefEditar = puedeEscribir ? rutaEditarProducto(producto.id) : null;

  return (
    <ContenedorDetalle>
      <EncabezadoPagina
        titulo={producto.nombre}
        subtitulo={subtituloProducto(producto, datosFerreteria)}
        migas={[{ etiqueta: "Productos", href: "/dashboard/productos" }, { etiqueta: producto.nombre }]}
        acciones={
          <>
            {hrefEditar ? (
              <Button nativeButton={false} render={<Link href={hrefEditar} prefetch={false} />}>
                <SquarePen data-icon="inline-start" />
                Editar producto
              </Button>
            ) : null}
            {puedeEscribir ? (
              <>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link
                      href={`/dashboard/facturacion/nueva?producto=${encodeURIComponent(producto.id)}`}
                      prefetch={false}
                    />
                  }
                >
                  <ReceiptText data-icon="inline-start" />
                  Facturar
                </Button>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link
                      href={`/dashboard/compras/nueva?producto=${encodeURIComponent(producto.id)}`}
                      prefetch={false}
                    />
                  }
                >
                  <ShoppingCart data-icon="inline-start" />
                  Comprar
                </Button>
              </>
            ) : null}
            {producto.inventariable ? (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Más acciones" />}>
                  <EllipsisVertical />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={verHistorial}>
                    <ClipboardList />
                    Historial de operaciones
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      />

      <div className={CLASE_PANEL_FICHA}>
        <EncabezadoProducto producto={producto} puedeEscribir={puedeEscribir} datosFerreteria={datosFerreteria} />

        <div className="px-5 pb-5">
          <GrillaKpis kpis={construirKpis(ficha)} />
        </div>

        <Tabs value={pestana} className="gap-0">
          <div className="border-border flex items-center justify-between gap-2 border-b px-2 sm:px-4">
            <nav
              className="flex min-w-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto overscroll-x-contain scroll-smooth [&::-webkit-scrollbar]:hidden"
              aria-label="Secciones de la ficha"
            >
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

          <TabsContent value="datos" className="p-4 sm:p-5">
            <InformacionGeneral
              ficha={ficha}
              puedeEscribir={puedeEscribir}
              datosFerreteria={datosFerreteria}
              onVerExistencias={() => setPestana("existencias")}
            />
          </TabsContent>

          <TabsContent value="codigos" className="p-4 sm:p-5">
            <TablaCodigos codigos={codigosBarra} unidades={unidadesMedida} />
          </TabsContent>

          <TabsContent value="unidades" className="p-4 sm:p-5">
            <TablaUnidades unidades={unidadesMedida} />
          </TabsContent>

          {producto.tipo === "combo" ? (
            <TabsContent value="combo" className="p-4 sm:p-5">
              <TablaComponentesCombo componentes={componentesCombo} />
            </TabsContent>
          ) : null}

          {producto.inventariable ? (
            <TabsContent value="existencias" className="p-4 sm:p-5">
              <TablaExistencias existencias={existencias} />
            </TabsContent>
          ) : null}

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
    </ContenedorDetalle>
  );
}
