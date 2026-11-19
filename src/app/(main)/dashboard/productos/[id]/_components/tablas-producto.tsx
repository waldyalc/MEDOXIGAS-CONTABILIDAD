"use client";

import { type ReactNode, useState } from "react";

import { Search } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { usePagina } from "@/components/ficha/ficha-ui";
import { PaginadorLocal } from "@/components/listas/paginador-local";
import { BarraLista, type ColumnaLista, PillEstado, TablaLista, type TonoPill } from "@/components/listas/tabla-lista";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { etiquetaEstadoDocumento } from "@/lib/contactos/ficha";
import { rutaCompra, rutaConduce, rutaContacto, rutaCotizacion, rutaFactura } from "@/lib/enlaces";
import { formatoCantidad, formatoMoneda, formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import {
  type DocumentoComercialFicha,
  type DocumentoFicha,
  type DocumentoNumerado,
  etiquetaEstadoComercial,
  filtrarPorNumero,
  saldoCentavos,
} from "@/lib/productos/ficha";
import type { FilaKardex } from "@/lib/productos/kardex";

const POR_PAGINA = 10;

function numeroDocumento(prefijo: string, numero: number): string {
  return `${prefijo}-${String(numero).padStart(4, "0")}`;
}

function tonoEstado(estado: string): TonoPill {
  if (estado === "anulada") return "peligro";
  if (estado === "pagada" || estado === "convertida") return "exito";
  return "pendiente";
}

function IdentificadorDocumento({
  ncf,
  id,
  ncfPrincipal,
}: {
  readonly ncf?: string | null;
  readonly id: string;
  readonly ncfPrincipal: boolean;
}) {
  if (ncfPrincipal) {
    return ncf ? (
      <span className="text-primary font-medium">{ncf}</span>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }

  return (
    <>
      <span className="text-primary font-medium">{id}</span>
      {ncf ? <span className="text-muted-foreground font-mono text-xs">{ncf}</span> : null}
    </>
  );
}

function CeldaDocumento({
  href,
  prefijo,
  numero,
  ncf,
  ncfPrincipal = false,
}: {
  readonly href: string;
  readonly prefijo: string;
  readonly numero: number;
  readonly ncf?: string | null;
  readonly ncfPrincipal?: boolean;
}) {
  const id = numeroDocumento(prefijo, numero);
  let ariaLabel = `Ver ${id}`;
  if (ncfPrincipal) ariaLabel = ncf ? `Ver factura ${ncf}` : "Ver factura de venta";

  return (
    <Enlace href={href} aria-label={ariaLabel} className="flex flex-col">
      <IdentificadorDocumento id={id} ncf={ncf} ncfPrincipal={ncfPrincipal} />
    </Enlace>
  );
}

function EnlaceTercero({ id, nombre }: { readonly id: string; readonly nombre: string }) {
  return (
    <Enlace href={rutaContacto(id)} className="text-foreground relative font-medium">
      {nombre}
    </Enlace>
  );
}

export function ListaBuscable<T extends DocumentoNumerado>({
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
      <BarraLista className="border-0 px-0">
        <div className="relative w-full max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por número o NCF…"
            aria-label={`Buscar ${unidad}`}
            className="h-8 pl-8"
          />
        </div>
      </BarraLista>
      {children(visibles, busqueda.trim() !== "")}
      <PaginadorLocal
        total={filtradas.length}
        porPagina={POR_PAGINA}
        pagina={pagina}
        setPagina={setPagina}
        etiqueta={unidad}
      />
    </div>
  );
}

export function TablaFacturas({
  documentos,
  tipo,
  filtrado,
}: {
  readonly documentos: readonly DocumentoFicha[];
  readonly tipo: "venta" | "compra";
  readonly filtrado: boolean;
}) {
  const esVenta = tipo === "venta";

  const columnas: readonly ColumnaLista<DocumentoFicha>[] = [
    {
      clave: "factura",
      encabezado: "Factura",
      celda: (documento) => (
        <CeldaDocumento
          href={esVenta ? rutaFactura(documento.id) : rutaCompra(documento.id)}
          prefijo={esVenta ? "FAC" : "COM"}
          numero={documento.numero}
          ncf={documento.ncf}
          ncfPrincipal={esVenta}
        />
      ),
    },
    {
      clave: "tercero",
      encabezado: esVenta ? "Cliente" : "Proveedor",
      celda: (documento) => <EnlaceTercero id={documento.contactoId} nombre={documento.contactoNombre} />,
    },
    {
      clave: "fecha",
      encabezado: "Fecha",
      celda: (documento) => <span className="text-muted-foreground">{formatoDia(documento.fecha)}</span>,
    },
    {
      clave: "vence",
      encabezado: "Vence",
      celda: (documento) => <span className="text-muted-foreground">{formatoDia(documento.vencimiento)}</span>,
    },
    {
      clave: "cantidad",
      encabezado: "Cantidad",
      alineacion: "derecha",
      celda: (documento) => formatoCantidad(documento.cantidad),
    },
    {
      clave: "total",
      encabezado: "Total",
      alineacion: "derecha",
      celda: (documento) => <span className="font-medium">{formatoMoneda(documento.total)}</span>,
    },
    {
      clave: "saldo",
      encabezado: esVenta ? "Por cobrar" : "Por pagar",
      alineacion: "derecha",
      celda: (documento) => formatoMonedaCentavos(saldoCentavos(documento.total, documento.pagado, documento.credito)),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (documento) => (
        <PillEstado tono={tonoEstado(documento.estado)}>{etiquetaEstadoDocumento(documento.estado, tipo)}</PillEstado>
      ),
    },
  ];

  return (
    <TablaLista
      columnas={columnas}
      filas={documentos}
      claveFila={(documento) => documento.id}
      filaHref={(documento) => (esVenta ? rutaFactura(documento.id) : rutaCompra(documento.id))}
      vacio={{
        filtrada: filtrado,
        titulo: filtrado ? "Sin resultados" : "Aún no hay facturas",
        descripcion: filtrado
          ? "La búsqueda no arrojó facturas."
          : `Este producto todavía no tiene facturas de ${esVenta ? "venta" : "compra"}.`,
      }}
    />
  );
}

export function TablaComerciales({
  documentos,
  tipo,
  filtrado,
}: {
  readonly documentos: readonly DocumentoComercialFicha[];
  readonly tipo: "cotizacion" | "conduce";
  readonly filtrado: boolean;
}) {
  const esCotizacion = tipo === "cotizacion";

  const columnas: readonly ColumnaLista<DocumentoComercialFicha>[] = [
    {
      clave: "documento",
      encabezado: esCotizacion ? "Cotización" : "Conduce",
      celda: (documento) => (
        <CeldaDocumento
          href={esCotizacion ? rutaCotizacion(documento.id) : rutaConduce(documento.id)}
          prefijo={esCotizacion ? "COT" : "CON"}
          numero={documento.numero}
        />
      ),
    },
    {
      clave: "fecha",
      encabezado: "Fecha",
      celda: (documento) => <span className="text-muted-foreground">{formatoDia(documento.fecha)}</span>,
    },
    {
      clave: "total",
      encabezado: "Total",
      alineacion: "derecha",
      celda: (documento) => <span className="font-medium">{formatoMoneda(documento.total)}</span>,
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (documento) => (
        <PillEstado tono={tonoEstado(documento.estado)}>{etiquetaEstadoComercial(documento.estado)}</PillEstado>
      ),
    },
  ];

  return (
    <TablaLista
      columnas={columnas}
      filas={documentos}
      claveFila={(documento) => documento.id}
      filaHref={(documento) => (esCotizacion ? rutaCotizacion(documento.id) : rutaConduce(documento.id))}
      vacio={{
        filtrada: filtrado,
        titulo: filtrado ? "Sin resultados" : "Aún no hay documentos",
        descripcion: filtrado
          ? "La búsqueda no arrojó documentos."
          : `Este producto todavía no tiene ${esCotizacion ? "cotizaciones" : "conduces"}.`,
      }}
    />
  );
}

export function TablaKardex({
  filas,
  filtrado,
}: {
  readonly filas: readonly FilaKardex[];
  readonly filtrado: boolean;
}) {
  const columnas: readonly ColumnaLista<FilaKardex>[] = [
    {
      clave: "documento",
      encabezado: "Documento",
      celda: (fila) => (
        <CeldaDocumento
          href={fila.tipo === "venta" ? rutaFactura(fila.documentoId) : rutaCompra(fila.documentoId)}
          prefijo={fila.tipo === "venta" ? "FAC" : "COM"}
          numero={fila.numero}
          ncf={fila.ncf}
          ncfPrincipal={fila.tipo === "venta"}
        />
      ),
    },
    {
      clave: "fecha",
      encabezado: "Fecha",
      celda: (fila) => <span className="text-muted-foreground">{formatoDia(fila.fecha)}</span>,
    },
    {
      clave: "tercero",
      encabezado: "Tercero",
      celda: (fila) => <EnlaceTercero id={fila.terceroId} nombre={fila.terceroNombre} />,
    },
    {
      clave: "entrada",
      encabezado: "Entrada",
      alineacion: "derecha",
      celda: (fila) =>
        fila.entrada > 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400">+{formatoCantidad(fila.entrada)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      clave: "salida",
      encabezado: "Salida",
      alineacion: "derecha",
      celda: (fila) =>
        fila.salida > 0 ? (
          <span className="text-red-500">-{formatoCantidad(fila.salida)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      clave: "costoUnitario",
      encabezado: "Costo unitario",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.costoUnitario),
    },
    {
      clave: "existencia",
      encabezado: "Existencia",
      alineacion: "derecha",
      celda: (fila) => <span className="font-medium">{formatoCantidad(fila.existencia)}</span>,
    },
  ];

  return (
    <TablaLista
      columnas={columnas}
      filas={filas}
      claveFila={(fila) => `${fila.tipo}:${fila.documentoId}`}
      filaHref={(fila) => (fila.tipo === "venta" ? rutaFactura(fila.documentoId) : rutaCompra(fila.documentoId))}
      vacio={{
        filtrada: filtrado,
        titulo: filtrado ? "Sin resultados" : "Aún no hay movimientos",
        descripcion: filtrado
          ? "La búsqueda no arrojó movimientos."
          : "Este producto todavía no tiene movimientos de inventario.",
      }}
    />
  );
}

export function PendienteBackend({
  icono,
  titulo,
  descripcion,
}: {
  readonly icono: ReactNode;
  readonly titulo: string;
  readonly descripcion: string;
}) {
  return (
    <Empty className="border border-dashed py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icono}</EmptyMedia>
        <EmptyTitle>{titulo}</EmptyTitle>
        <EmptyDescription>{descripcion}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
