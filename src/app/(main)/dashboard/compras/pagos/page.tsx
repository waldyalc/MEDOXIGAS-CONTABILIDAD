import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft, Plus, Wallet } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import {
  BarraLista,
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { aNumero } from "@/lib/compras/calculo";
import { listarPagosProveedor } from "@/lib/compras/consultas";
import { formatoMoneda } from "@/lib/compras/formato";
import type { MetodoPago, PagoLista } from "@/lib/compras/tipos";
import { rutaCompra, rutaContacto, rutaCuenta, rutaPagoProveedor } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { leerOpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";

const RUTA = "/dashboard/compras/pagos";

const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

function CeldaProveedor({ pago }: { pago: PagoLista }) {
  if (!pago.contactos) return "—";

  return <Enlace href={rutaContacto(pago.contacto_id)}>{pago.contactos.nombre}</Enlace>;
}

function CeldaCuenta({ pago }: { pago: PagoLista }) {
  if (!pago.cuentas) return "—";

  return <Enlace href={rutaCuenta(pago.cuenta_id)}>{pago.cuentas.nombre}</Enlace>;
}

function CeldaFacturaProveedor({ pago }: { pago: PagoLista }) {
  if (pago.aplicaciones > 1) {
    return <span>Varias facturas ({pago.aplicaciones})</span>;
  }

  if (pago.facturas_proveedor) {
    return (
      <Enlace href={rutaCompra(pago.facturas_proveedor.id)}>
        #{pago.facturas_proveedor.numero}
        {pago.facturas_proveedor.ncf ? ` · ${pago.facturas_proveedor.ncf}` : ""}
      </Enlace>
    );
  }

  return "—";
}

const columnas: readonly ColumnaLista<PagoLista>[] = [
  {
    clave: "numero",
    encabezado: "Número",
    celda: (pago) => <Enlace href={rutaPagoProveedor(pago.id)}>#{pago.numero}</Enlace>,
  },
  {
    clave: "proveedor",
    encabezado: "Proveedor",
    celda: (pago) => <CeldaProveedor pago={pago} />,
  },
  {
    clave: "factura",
    encabezado: "Factura",
    celda: (pago) => (
      <span className="text-muted-foreground">
        <CeldaFacturaProveedor pago={pago} />
      </span>
    ),
  },
  {
    clave: "fecha",
    encabezado: "Fecha",
    celda: (pago) => formatoDia(pago.fecha),
  },
  {
    clave: "metodo",
    encabezado: "Método",
    celda: (pago) => ETIQUETAS_METODO[pago.metodo],
  },
  {
    clave: "cuenta",
    encabezado: "Cuenta",
    celda: (pago) => <CeldaCuenta pago={pago} />,
  },
  {
    clave: "monto",
    encabezado: "Monto",
    alineacion: "derecha",
    celda: (pago) => <span className="font-medium">{formatoMoneda(aNumero(pago.monto))}</span>,
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

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const [rol, params] = await Promise.all([getRol(), searchParams]);
  if (rol == null) redirect("/unauthorized");

  const opciones = leerOpcionesLista(params);
  const { filas: pagos, resumen } = await listarPagosProveedor(opciones);
  const puedeCrear = rol !== "lector";

  return (
    <ContenedorLista>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Pagos a proveedores</h1>
          <p className="text-muted-foreground text-sm">
            Registra pagos contra facturas abiertas y consulta el historial.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/dashboard/compras" prefetch={false} />}>
            <ArrowLeft data-icon="inline-start" />
            Compras
          </Button>
          {puedeCrear ? (
            <Button render={<Link href="/dashboard/compras/pagos/nuevo" prefetch={false} />}>
              <Plus data-icon="inline-start" />
              Nuevo pago
            </Button>
          ) : null}
        </div>
      </div>

      <TarjetaLista data-lista="compras-pagos">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número, proveedor o factura…"
            ariaLabel="Buscar pagos a proveedores"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <TablaLista
          columnas={columnas}
          filas={pagos}
          claveFila={(pago) => pago.id}
          vacio={{
            filtrada: Boolean(opciones.q),
            titulo: opciones.q ? "Sin resultados" : "¡Aún no tienes pagos a proveedores!",
            descripcion: opciones.q
              ? "La búsqueda no arrojó pagos."
              : "Registra tu primer pago contra una factura de proveedor.",
            icono: <Wallet className="size-10" />,
            accion: puedeCrear ? (
              <Button render={<Link href="/dashboard/compras/pagos/nuevo" prefetch={false} />}>
                <Plus />
                Nuevo pago
              </Button>
            ) : undefined,
          }}
        />

        <PaginadorLista
          base={RUTA}
          params={params}
          resumen={resumen}
          etiqueta="Ítems por página"
          tamano={opciones.tamano}
          opciones={TAMANOS_PAGINA}
          mostrarEnVacio
          botonesExtremos={false}
          className="border-border h-14 border-t px-4 text-slate-700 dark:text-slate-300"
        />
      </TarjetaLista>
    </ContenedorLista>
  );
}
