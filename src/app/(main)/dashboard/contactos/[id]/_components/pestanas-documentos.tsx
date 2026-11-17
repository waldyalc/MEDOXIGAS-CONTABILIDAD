"use client";

import { type ReactNode, useState } from "react";

import { cn } from "cn";
import { Search } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { PiePagina, TH, usePagina } from "@/components/ficha/ficha-ui";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  type AsientoFicha,
  aCentavos,
  type DocumentoComercialFicha,
  type DocumentoFicha,
  etiquetaEstadoComercial,
  etiquetaEstadoDocumento,
  etiquetaEstadoPago,
  type NotaFicha,
  type PagoFicha,
  saldoDocumento,
} from "@/lib/contactos/ficha";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

const FILAS_POR_PAGINA = 10;

export type ClaseEstado = "venta" | "compra" | "comercial" | "pago";

export function EstadoBadge({ estado, clase }: { readonly estado: string; readonly clase: ClaseEstado }) {
  let etiqueta: string;
  if (clase === "venta" || clase === "compra") etiqueta = etiquetaEstadoDocumento(estado, clase);
  else if (clase === "comercial") etiqueta = etiquetaEstadoComercial(estado);
  else etiqueta = etiquetaEstadoPago(estado);

  if (estado === "anulada" || estado === "anulado") return <Badge variant="destructive">{etiqueta}</Badge>;
  if (estado === "pagada" || estado === "convertida") {
    return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{etiqueta}</Badge>;
  }
  return <Badge variant="secondary">{etiqueta}</Badge>;
}

interface Columna<T> {
  readonly titulo: string;
  readonly derecha?: boolean;
  readonly celda: (fila: T) => ReactNode;
}

interface Fila {
  readonly id: string;
  readonly numero: number;
  readonly ncf?: string | null;
}

function IdentificadorFicha({
  fila,
  numero,
  ncfPrincipal,
}: {
  readonly fila: Fila;
  readonly numero: string;
  readonly ncfPrincipal: boolean;
}) {
  if (ncfPrincipal) {
    return fila.ncf ? (
      <span className="text-primary font-medium">{fila.ncf}</span>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }

  return (
    <>
      <span className="text-primary font-medium">{numero}</span>
      {fila.ncf ? <span className="text-muted-foreground font-mono text-xs">{fila.ncf}</span> : null}
    </>
  );
}

function etiquetaEnlace(numero: string, ncfPrincipal: boolean, ncf?: string | null): string {
  if (!ncfPrincipal) return `Ver ${numero}`;
  return ncf ? `Ver factura ${ncf}` : "Ver factura de venta";
}

function NumeroEnlace({
  href,
  prefijo,
  fila,
  ncfPrincipal = false,
}: {
  readonly href: string;
  readonly prefijo: string;
  readonly fila: Fila;
  readonly ncfPrincipal?: boolean;
}) {
  const numero = `${prefijo}-${String(fila.numero).padStart(4, "0")}`;

  return (
    <>
      <Enlace className="absolute inset-0" href={href} aria-label={etiquetaEnlace(numero, ncfPrincipal, fila.ncf)} />
      <span className="pointer-events-none relative flex flex-col">
        <IdentificadorFicha fila={fila} numero={numero} ncfPrincipal={ncfPrincipal} />
      </span>
    </>
  );
}

function Monto({ centavos }: { readonly centavos: number }) {
  return <span className="font-medium tabular-nums">{formatoMonedaCentavos(centavos)}</span>;
}

function Fecha({ fecha }: { readonly fecha: string }) {
  return <span className="text-muted-foreground">{formatoDia(fecha)}</span>;
}

function TablaFicha<T extends Fila>({
  filas,
  columnas,
  unidad,
  prefijo,
  ruta,
  ncfPrincipal = false,
}: {
  readonly filas: readonly T[];
  readonly columnas: readonly Columna<T>[];
  readonly unidad: string;
  readonly prefijo: (fila: T) => string;
  readonly ruta: (fila: T) => string;
  readonly ncfPrincipal?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const texto = busqueda.trim().toLowerCase();
  const filtradas = filas.filter(
    (fila) =>
      texto === "" ||
      `${prefijo(fila)}-${fila.numero}`.toLowerCase().includes(texto) ||
      String(fila.numero).includes(texto) ||
      (fila.ncf ?? "").toLowerCase().includes(texto),
  );
  const { pagina, setPagina } = usePagina(filtradas.length, FILAS_POR_PAGINA);
  const visibles = filtradas.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative w-full max-w-xs">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder={`Buscar ${unidad}…`}
          aria-label={`Buscar ${unidad}`}
          className="pl-8"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={TH}>Número</TableHead>
            {columnas.map((columna) => (
              <TableHead key={columna.titulo} className={cn(TH, columna.derecha && "text-right")}>
                {columna.titulo}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnas.length + 1} className="text-muted-foreground py-10 text-center">
                No hay {unidad}.
              </TableCell>
            </TableRow>
          ) : (
            visibles.map((fila) => (
              <TableRow key={fila.id} className="relative cursor-pointer">
                <TableCell>
                  <NumeroEnlace href={ruta(fila)} prefijo={prefijo(fila)} fila={fila} ncfPrincipal={ncfPrincipal} />
                </TableCell>
                {columnas.map((columna) => (
                  <TableCell key={columna.titulo} className={cn(columna.derecha && "text-right")}>
                    {columna.celda(fila)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <PiePagina
        total={filtradas.length}
        porPagina={FILAS_POR_PAGINA}
        pagina={pagina}
        setPagina={setPagina}
        unidad={unidad}
      />
    </div>
  );
}

export function PestanaFacturas({
  facturas,
  esVenta,
  ruta,
}: {
  readonly facturas: readonly DocumentoFicha[];
  readonly esVenta: boolean;
  readonly ruta: (id: string) => string;
}) {
  const columnas: Columna<DocumentoFicha>[] = [
    { titulo: "Creación", celda: (f) => <Fecha fecha={f.fecha} /> },
    { titulo: "Vencimiento", celda: (f) => <Fecha fecha={f.vencimiento} /> },
    { titulo: "Total", derecha: true, celda: (f) => <Monto centavos={aCentavos(f.total)} /> },
    { titulo: esVenta ? "Cobrado" : "Pagado", derecha: true, celda: (f) => <Monto centavos={aCentavos(f.pagado)} /> },
    {
      titulo: esVenta ? "Por cobrar" : "Por pagar",
      derecha: true,
      celda: (f) => <Monto centavos={f.estado === "anulada" ? 0 : saldoDocumento(f.total, f.pagado, f.credito)} />,
    },
    { titulo: "Estado", celda: (f) => <EstadoBadge estado={f.estado} clase={esVenta ? "venta" : "compra"} /> },
  ];
  return (
    <TablaFicha
      filas={facturas}
      columnas={columnas}
      unidad={esVenta ? "facturas de venta" : "facturas de proveedor"}
      prefijo={() => (esVenta ? "FAC" : "COM")}
      ruta={(f) => ruta(f.id)}
      ncfPrincipal={esVenta}
    />
  );
}

export function PestanaComerciales({
  filas,
  prefijo,
  unidad,
  ruta,
}: {
  readonly filas: readonly DocumentoComercialFicha[];
  readonly prefijo: string;
  readonly unidad: string;
  readonly ruta: (id: string) => string;
}) {
  const columnas: Columna<DocumentoComercialFicha>[] = [
    { titulo: "Fecha", celda: (f) => <Fecha fecha={f.fecha} /> },
    { titulo: "Total", derecha: true, celda: (f) => <Monto centavos={aCentavos(f.total)} /> },
    { titulo: "Estado", celda: (f) => <EstadoBadge estado={f.estado} clase="comercial" /> },
  ];
  return (
    <TablaFicha filas={filas} columnas={columnas} unidad={unidad} prefijo={() => prefijo} ruta={(f) => ruta(f.id)} />
  );
}

const DETALLE_NOTA: Record<NotaFicha["tipo"], string> = {
  credito: "Nota de crédito",
  debito: "Nota de débito",
  credito_compra: "Nota de crédito de compra",
};

export function PestanaNotas({
  notas,
  unidad,
  prefijo,
  ruta,
}: {
  readonly notas: readonly NotaFicha[];
  readonly unidad: string;
  readonly prefijo: (nota: NotaFicha) => string;
  readonly ruta: (nota: NotaFicha) => string;
}) {
  const columnas: Columna<NotaFicha>[] = [
    { titulo: "Tipo", celda: (n) => DETALLE_NOTA[n.tipo] },
    { titulo: "Fecha", celda: (n) => <Fecha fecha={n.fecha} /> },
    { titulo: "Total", derecha: true, celda: (n) => <Monto centavos={aCentavos(n.total)} /> },
    { titulo: "Estado", celda: (n) => <EstadoBadge estado={n.estado} clase="pago" /> },
  ];
  return <TablaFicha filas={notas} columnas={columnas} unidad={unidad} prefijo={prefijo} ruta={ruta} />;
}

export function PestanaPagos({
  pagos,
  unidad,
  ruta,
}: {
  readonly pagos: readonly PagoFicha[];
  readonly unidad: string;
  readonly ruta: (id: string) => string;
}) {
  const columnas: Columna<PagoFicha>[] = [
    { titulo: "Fecha", celda: (p) => <Fecha fecha={p.fecha} /> },
    { titulo: "Factura", celda: (p) => (p.factura_numero == null ? "Anticipo" : `#${p.factura_numero}`) },
    { titulo: "Monto", derecha: true, celda: (p) => <Monto centavos={aCentavos(p.monto)} /> },
    { titulo: "Estado", celda: (p) => <EstadoBadge estado={p.estado} clase="pago" /> },
  ];
  return (
    <TablaFicha filas={pagos} columnas={columnas} unidad={unidad} prefijo={() => "PAG"} ruta={(p) => ruta(p.id)} />
  );
}

export function PestanaAsientos({
  asientos,
  ruta,
}: {
  readonly asientos: readonly AsientoFicha[];
  readonly ruta: (id: string) => string;
}) {
  const columnas: Columna<AsientoFicha>[] = [
    { titulo: "Fecha", celda: (a) => <Fecha fecha={a.fecha} /> },
    { titulo: "Descripción", celda: (a) => <span className="whitespace-normal">{a.descripcion}</span> },
    { titulo: "Débito", derecha: true, celda: (a) => <Monto centavos={a.debitoCentavos} /> },
    { titulo: "Crédito", derecha: true, celda: (a) => <Monto centavos={a.creditoCentavos} /> },
  ];
  return (
    <TablaFicha filas={asientos} columnas={columnas} unidad="asientos" prefijo={() => "ASI"} ruta={(a) => ruta(a.id)} />
  );
}
