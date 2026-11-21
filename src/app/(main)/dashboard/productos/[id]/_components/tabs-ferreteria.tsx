import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import type { CodigoBarra, ComponenteCombo, UnidadMedida } from "@/lib/inventario/ferreteria/tipos";

function unidadDelCodigo(codigo: CodigoBarra, unidades: readonly UnidadMedida[]): string {
  if (codigo.unidad_id === null) return "Unidad base";
  return unidades.find((unidad) => unidad.id === codigo.unidad_id)?.nombre ?? "Unidad no disponible";
}

export function TablaCodigos({
  codigos,
  unidades,
}: {
  readonly codigos: readonly CodigoBarra[];
  readonly unidades: readonly UnidadMedida[];
}) {
  const columnas: readonly ColumnaLista<CodigoBarra>[] = [
    {
      clave: "codigo",
      encabezado: "Código",
      celda: (codigo) => <span className="font-mono font-medium">{codigo.codigo}</span>,
    },
    {
      clave: "unidad",
      encabezado: "Unidad",
      celda: (codigo) => <span className="text-muted-foreground">{unidadDelCodigo(codigo, unidades)}</span>,
    },
    {
      clave: "principal",
      encabezado: "Principal",
      alineacion: "centro",
      celda: (codigo) =>
        codigo.principal ? (
          <PillEstado tono="info">Principal</PillEstado>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <TablaLista
      columnas={columnas}
      filas={codigos}
      claveFila={(codigo) => codigo.id}
      vacio={{
        titulo: "Sin códigos de barra",
        descripcion: "Edita el producto para agregar el EAN/UPC del fabricante o un código interno.",
      }}
    />
  );
}

export function TablaUnidades({ unidades }: { readonly unidades: readonly UnidadMedida[] }) {
  const columnas: readonly ColumnaLista<UnidadMedida>[] = [
    {
      clave: "nombre",
      encabezado: "Presentación",
      celda: (unidad) => <span className="font-medium">{unidad.nombre}</span>,
    },
    {
      clave: "factor",
      encabezado: "Factor base",
      alineacion: "derecha",
      celda: (unidad) => formatoCantidad(unidad.factor_base),
    },
    {
      clave: "precio",
      encabezado: "Precio",
      alineacion: "derecha",
      celda: (unidad) =>
        unidad.precio === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="font-medium">{formatoMoneda(unidad.precio)}</span>
        ),
    },
    {
      clave: "compra",
      encabezado: "Compra",
      alineacion: "centro",
      celda: (unidad) =>
        unidad.es_compra ? <PillEstado tono="exito">Sí</PillEstado> : <span className="text-muted-foreground">—</span>,
    },
    {
      clave: "venta",
      encabezado: "Venta",
      alineacion: "centro",
      celda: (unidad) =>
        unidad.es_venta ? <PillEstado tono="exito">Sí</PillEstado> : <span className="text-muted-foreground">—</span>,
    },
    {
      clave: "activa",
      encabezado: "Estado",
      alineacion: "centro",
      celda: (unidad) => (
        <PillEstado tono={unidad.activa ? "info" : "neutro"}>{unidad.activa ? "Activa" : "Inactiva"}</PillEstado>
      ),
    },
  ];

  return (
    <TablaLista
      columnas={columnas}
      filas={unidades}
      claveFila={(unidad) => unidad.id}
      vacio={{
        titulo: "Sin presentaciones",
        descripcion: "Este producto se vende en su unidad base; no tiene cajas, rollos ni otras presentaciones.",
      }}
    />
  );
}

export function TablaComponentesCombo({ componentes }: { readonly componentes: readonly ComponenteCombo[] }) {
  const columnas: readonly ColumnaLista<ComponenteCombo>[] = [
    {
      clave: "componente",
      encabezado: "Componente",
      celda: (componente) => (
        <span className="inline-flex items-center gap-2 font-medium">
          {componente.componente_nombre}
          {componente.inventariable ? (
            <PillEstado tono="info">Inventariable</PillEstado>
          ) : (
            <PillEstado tono="neutro">No inventariable</PillEstado>
          )}
        </span>
      ),
    },
    {
      clave: "cantidad",
      encabezado: "Cantidad por combo",
      alineacion: "derecha",
      celda: (componente) => formatoCantidad(componente.cantidad),
    },
  ];

  return (
    <TablaLista
      columnas={columnas}
      filas={componentes}
      claveFila={(componente) => componente.id}
      vacio={{
        titulo: "Sin componentes",
        descripcion: "Este combo todavía no tiene componentes; se puede guardar, pero no se puede vender.",
      }}
    />
  );
}
