import type { ReactNode } from "react";

import { Wallet } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { rutaContacto, rutaFactura, rutaPagoRecibido } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { PagoLista } from "@/lib/pagos/tipos";

const METODOS: Record<PagoLista["metodo"], string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

function CeldaFactura({ pago }: { pago: PagoLista }) {
  if (pago.aplicaciones > 1) {
    return <span className="text-muted-foreground">Varias facturas ({pago.aplicaciones})</span>;
  }

  if (pago.factura_id) {
    return (
      <Enlace href={rutaFactura(pago.factura_id)}>
        #{pago.factura_numero} {pago.factura_ncf ? `· ${pago.factura_ncf}` : ""}
      </Enlace>
    );
  }

  return "—";
}

const columnas: readonly ColumnaLista<PagoLista>[] = [
  {
    clave: "numero",
    encabezado: "#",
    className: "w-16",
    celda: (pago) => <Enlace href={rutaPagoRecibido(pago.id)}>{pago.numero}</Enlace>,
  },
  {
    clave: "fecha",
    encabezado: "Fecha",
    celda: (pago) => formatoDia(pago.fecha),
  },
  {
    clave: "cliente",
    encabezado: "Cliente",
    celda: (pago) => <Enlace href={rutaContacto(pago.contacto_id)}>{pago.cliente_nombre}</Enlace>,
  },
  {
    clave: "factura",
    encabezado: "Factura",
    celda: (pago) => <CeldaFactura pago={pago} />,
  },
  {
    clave: "metodo",
    encabezado: "Método",
    celda: (pago) => METODOS[pago.metodo],
  },
  {
    clave: "monto",
    encabezado: "Monto",
    alineacion: "derecha",
    celda: (pago) => <span className="font-medium">{formatoMoneda(pago.monto)}</span>,
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (pago) => (
      <PillEstado tono={pago.estado === "anulado" ? "peligro" : "exito"}>
        {pago.estado === "anulado" ? "Anulado" : "Activo"}
      </PillEstado>
    ),
  },
];

export function PagosTabla({
  pagos,
  busqueda,
  accion,
}: {
  pagos: PagoLista[];
  busqueda?: string;
  /** CTA del vacío; la página solo la pasa si el rol puede crear. */
  accion?: ReactNode;
}) {
  return (
    <TablaLista
      columnas={columnas}
      filas={pagos}
      claveFila={(pago) => pago.id}
      filaHref={(pago) => rutaPagoRecibido(pago.id)}
      vacio={{
        filtrada: Boolean(busqueda),
        titulo: busqueda ? "Sin resultados" : "¡Aún no tienes pagos recibidos!",
        descripcion: busqueda
          ? "La búsqueda no arrojó pagos."
          : "Registra tu primer cobro de una factura de venta para empezar.",
        icono: <Wallet className="size-10" />,
        accion,
      }}
    />
  );
}
