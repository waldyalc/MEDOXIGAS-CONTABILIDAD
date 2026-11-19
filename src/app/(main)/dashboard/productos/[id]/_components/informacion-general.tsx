import type { ReactNode } from "react";

import { cn } from "cn";
import { Boxes, ClipboardList, TrendingDown } from "lucide-react";

import { SeccionAdjuntos } from "@/components/adjuntos/seccion-adjuntos";
import { Enlace } from "@/components/enlace";
import { ItemDato } from "@/components/ficha/ficha-ui";
import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { rutaCuenta } from "@/lib/enlaces";
import { centavosAValor } from "@/lib/facturacion/calculo";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import { precioSugeridoCentavos } from "@/lib/inventario/precios";
import type { ExistenciaAlmacen } from "@/lib/inventario/tipos";
import { type CuentaFicha, type FichaProducto, type PrecioListaFicha, precioConItbis } from "@/lib/productos/ficha";
import { etiquetaTasaItbis, etiquetaTipoProducto } from "@/lib/productos/productos";

const CLASE_SUBPANEL = "ring-foreground/10 rounded-lg ring-1";

function TituloSeccion({ children, accion }: { readonly children: ReactNode; readonly accion?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">{children}</h2>
      {accion}
    </div>
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

function Opcion({
  icono,
  etiqueta,
  activa,
}: {
  readonly icono: ReactNode;
  readonly etiqueta: string;
  readonly activa: boolean | null;
}) {
  let estado = "—";
  if (activa !== null) estado = activa ? "Activado" : "Desactivado";
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icono}</span>
      <div className="flex flex-col">
        <span className="text-muted-foreground text-xs">{etiqueta}</span>
        <span className={cn("text-sm font-medium", activa ? "text-primary" : "text-muted-foreground")}>{estado}</span>
      </div>
    </div>
  );
}

function DatosProducto({ producto }: { readonly producto: FichaProducto["producto"] }) {
  const esServicio = producto.tipo === "servicio";

  return (
    <section className="flex flex-col gap-4">
      <TituloSeccion>Datos del {esServicio ? "servicio" : "producto"}</TituloSeccion>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <ItemDato etiqueta="Nombre">{producto.nombre}</ItemDato>
        <ItemDato etiqueta="Referencia">{producto.referencia?.trim() || "—"}</ItemDato>
        <ItemDato etiqueta="Categoría">{producto.categoriaNombre ?? "Sin categoría"}</ItemDato>
        <ItemDato etiqueta="Tipo">{etiquetaTipoProducto(producto.tipo)}</ItemDato>
        <ItemDato etiqueta="Unidad de medida">{producto.unidadMedida || "Unidad"}</ItemDato>
        <ItemDato etiqueta="Estado">{producto.activo ? "Activo" : "Inactivo"}</ItemDato>
        <div className="sm:col-span-2">
          <ItemDato etiqueta="Descripción">
            <span className="whitespace-pre-line">{producto.descripcion?.trim() || "—"}</span>
          </ItemDato>
        </div>
      </dl>
      <div className="flex flex-wrap gap-x-10 gap-y-3 pt-1">
        <Opcion
          icono={<Boxes className="size-4" />}
          etiqueta="Producto inventariable"
          activa={producto.inventariable}
        />
        <Opcion
          icono={<TrendingDown className="size-4" />}
          etiqueta="Venta en negativo"
          activa={producto.vendeNegativo}
        />
      </div>
    </section>
  );
}

function TarjetaPrecio({ producto }: { readonly producto: FichaProducto["producto"] }) {
  return (
    <aside className={cn(CLASE_SUBPANEL, "bg-muted/30 flex flex-col gap-4 p-4")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-xs">Precio total</span>
        <span className="text-muted-foreground text-xs">DOP</span>
      </div>
      <span className="-mt-3 text-2xl font-semibold tracking-tight tabular-nums">
        {formatoMoneda(precioConItbis(producto.precio, producto.itbis_tasa))}
      </span>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <ItemDato etiqueta="Precio sin ITBIS">
          <span className="tabular-nums">{formatoMoneda(producto.precio)}</span>
        </ItemDato>
        <ItemDato etiqueta="Impuesto">ITBIS ({etiquetaTasaItbis(producto.itbis_tasa)})</ItemDato>
        <ItemDato etiqueta="Costo por unidad">
          <span className="tabular-nums">{formatoMoneda(producto.costo)}</span>
        </ItemDato>
      </dl>
    </aside>
  );
}

/**
 * La ficha no trae lo comprometido en conduces por almacén (los conduces no
 * guardan almacén); esa columna se queda en guiones.
 */
const columnasExistencias: readonly ColumnaLista<ExistenciaAlmacen>[] = [
  {
    clave: "almacen",
    encabezado: "Almacén",
    celda: (existencia) => (
      <span className="inline-flex items-center gap-2 font-medium">
        {existencia.almacen_nombre}
        {existencia.es_principal ? <PillEstado tono="info">Principal</PillEstado> : null}
      </span>
    ),
  },
  {
    clave: "inicial",
    encabezado: "Cant. inicial",
    alineacion: "derecha",
    celda: (existencia) => <span className="tabular-nums">{formatoCantidad(existencia.cantidad_inicial)}</span>,
  },
  {
    clave: "actual",
    encabezado: "Cant. actual",
    alineacion: "derecha",
    celda: (existencia) => <span className="font-medium tabular-nums">{formatoCantidad(existencia.cantidad)}</span>,
  },
  {
    clave: "minimo",
    encabezado: "Mín.",
    alineacion: "derecha",
    celda: (existencia) => <span className="tabular-nums">{formatoCantidad(existencia.minimo)}</span>,
  },
  {
    clave: "maximo",
    encabezado: "Máx.",
    alineacion: "derecha",
    celda: (existencia) =>
      existencia.maximo === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="tabular-nums">{formatoCantidad(existencia.maximo)}</span>
      ),
  },
  {
    clave: "conduces",
    encabezado: "En conduces",
    alineacion: "derecha",
    // TODO backend: los conduces no guardan almacén, no se puede repartir lo comprometido.
    celda: () => <span className="text-muted-foreground">—</span>,
  },
];

function Inventario({ ficha, onVerHistorial }: { readonly ficha: FichaProducto; readonly onVerHistorial: () => void }) {
  const { producto, existencias, kardex } = ficha;
  return (
    <section className="flex flex-col gap-4">
      <TituloSeccion
        accion={
          <Button variant="outline" size="sm" onClick={onVerHistorial}>
            <ClipboardList data-icon="inline-start" />
            Historial de operaciones
          </Button>
        }
      >
        Inventario
      </TituloSeccion>
      <div className="-mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-muted-foreground">Total en inventario: </span>
          <span className="text-primary font-medium tabular-nums">{formatoCantidad(producto.cantidad)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Valor del inventario: </span>
          <span className="font-medium tabular-nums">{formatoMoneda(producto.cantidad * producto.costo)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Existencia inicial: </span>
          <span className="font-medium tabular-nums">{formatoCantidad(kardex.existenciaInicial)}</span>
        </span>
      </div>
      <div className={cn(CLASE_SUBPANEL, "overflow-hidden")}>
        <TablaLista
          columnas={columnasExistencias}
          filas={existencias}
          claveFila={(existencia) => existencia.almacen_id}
          vacio={{
            titulo: "Sin existencias registradas por almacén",
          }}
          pie={
            existencias.length > 1 ? (
              <TableRow>
                <TableCell className="pl-4 font-semibold">Total</TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatoCantidad(producto.cantidad)}
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            ) : undefined
          }
        />
      </div>
    </section>
  );
}

function precioDeLista(producto: FichaProducto["producto"], lista: PrecioListaFicha): number {
  const precios = lista.precio === null ? [] : [{ lista_id: lista.listaId, precio: lista.precio }];
  const centavos = precioSugeridoCentavos(
    producto.precio,
    [{ id: lista.listaId, tipo: lista.tipo }],
    precios,
    lista.listaId,
  );
  return centavosAValor(centavos);
}

function ListasPrecios({ producto }: { readonly producto: FichaProducto["producto"] }) {
  return (
    <section className={cn(CLASE_SUBPANEL, "flex flex-col gap-3 p-4")}>
      <TituloSeccion>Listas de precios</TituloSeccion>
      <dl className="divide-border flex flex-col divide-y text-sm">
        {producto.precios.map((lista) => (
          <div key={lista.listaId} className="flex items-center justify-between gap-4 py-2">
            <dt className="inline-flex items-center gap-2">
              {lista.nombre}
              {lista.esPrincipal ? <PillEstado tono="info">Principal</PillEstado> : null}
            </dt>
            <dd className="font-medium tabular-nums">{formatoMoneda(precioDeLista(producto, lista))}</dd>
          </div>
        ))}
        {producto.precios.length === 0 ? (
          <span className="text-muted-foreground text-sm">Sin listas de precios activas.</span>
        ) : null}
      </dl>
    </section>
  );
}

function ArchivosAdjuntos({
  ficha,
  puedeEscribir,
}: {
  readonly ficha: FichaProducto;
  readonly puedeEscribir: boolean;
}) {
  return (
    <section className={cn(CLASE_SUBPANEL, "flex flex-col gap-3 p-4")}>
      <TituloSeccion>Archivos adjuntos</TituloSeccion>
      <SeccionAdjuntos
        adjuntos={ficha.adjuntos}
        entidadTipo="producto"
        entidadId={ficha.producto.id}
        puedeEscribir={puedeEscribir}
      />
    </section>
  );
}

function Contabilidad({ ficha }: { readonly ficha: FichaProducto }) {
  const { producto, cuentas } = ficha;
  return (
    <section className="flex flex-col gap-4">
      <TituloSeccion>Contabilidad</TituloSeccion>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <ItemDato etiqueta="Cuenta de ventas">
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
  );
}

export function InformacionGeneral({
  ficha,
  puedeEscribir,
  onVerHistorial,
}: {
  readonly ficha: FichaProducto;
  readonly puedeEscribir: boolean;
  readonly onVerHistorial: () => void;
}) {
  const { producto } = ficha;
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <DatosProducto producto={producto} />
        <TarjetaPrecio producto={producto} />
      </div>
      {producto.inventariable ? <Inventario ficha={ficha} onVerHistorial={onVerHistorial} /> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <ListasPrecios producto={producto} />
        <ArchivosAdjuntos ficha={ficha} puedeEscribir={puedeEscribir} />
      </div>
      <Contabilidad ficha={ficha} />
    </div>
  );
}
