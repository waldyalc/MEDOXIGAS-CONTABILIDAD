import type { ReactNode } from "react";

import { Enlace } from "@/components/enlace";
import { Receipt } from "@/components/icons";
import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { rutaContacto, rutaCuenta, rutaGasto } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { GastoLista } from "@/lib/gastos/tipos";

const columnas: readonly ColumnaLista<GastoLista>[] = [
  {
    clave: "numero",
    encabezado: "#",
    className: "w-16",
    celda: (gasto) => <Enlace href={rutaGasto(gasto.id)}>{gasto.numero}</Enlace>,
  },
  {
    clave: "comprobante",
    encabezado: "Comprobante",
    celda: (gasto) => <span className="text-muted-foreground">{gasto.ncf || "—"}</span>,
  },
  {
    clave: "fecha",
    encabezado: "Fecha",
    celda: (gasto) => formatoDia(gasto.fecha),
  },
  {
    clave: "descripcion",
    encabezado: "Descripción",
    celda: (gasto) => <span className="whitespace-normal">{gasto.descripcion}</span>,
  },
  {
    clave: "proveedor",
    encabezado: "Proveedor",
    celda: (gasto) =>
      gasto.contacto_id ? (
        <Enlace href={rutaContacto(gasto.contacto_id)}>{gasto.proveedor_nombre}</Enlace>
      ) : (
        gasto.proveedor_nombre
      ),
  },
  {
    clave: "cuenta",
    encabezado: "Cuenta",
    celda: (gasto) => <Enlace href={rutaCuenta(gasto.cuenta_gasto_id)}>{gasto.cuenta_nombre}</Enlace>,
  },
  {
    clave: "pagadoDesde",
    encabezado: "Pagado desde",
    celda: (gasto) => <Enlace href={rutaCuenta(gasto.cuenta_pago_id)}>{gasto.cuenta_pago_nombre}</Enlace>,
  },
  {
    clave: "subtotal",
    encabezado: "Subtotal",
    alineacion: "derecha",
    celda: (gasto) => formatoMoneda(gasto.subtotal),
  },
  {
    clave: "itbis",
    encabezado: "ITBIS",
    alineacion: "derecha",
    celda: (gasto) => formatoMoneda(gasto.itbis),
  },
  {
    clave: "total",
    encabezado: "Total",
    alineacion: "derecha",
    celda: (gasto) => <span className="font-medium">{formatoMoneda(gasto.total)}</span>,
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (gasto) => (
      <PillEstado tono={gasto.estado === "anulado" ? "peligro" : "exito"}>
        {gasto.estado === "anulado" ? "Anulado" : "Activo"}
      </PillEstado>
    ),
  },
];

export function GastosTabla({
  gastos,
  busqueda,
  accion,
}: {
  gastos: GastoLista[];
  busqueda?: string;
  /** CTA del vacío; la página solo la pasa si el rol puede crear. */
  accion?: ReactNode;
}) {
  return (
    <TablaLista
      columnas={columnas}
      filas={gastos}
      claveFila={(gasto) => gasto.id}
      filaHref={(gasto) => rutaGasto(gasto.id)}
      vacio={{
        filtrada: Boolean(busqueda),
        titulo: busqueda ? "Sin resultados" : "¡Aún no tienes gastos menores!",
        descripcion: busqueda
          ? "La búsqueda no arrojó gastos."
          : "Registra tu primer gasto de caja menor para empezar.",
        icono: <Receipt className="size-10" />,
        accion,
      }}
    />
  );
}
