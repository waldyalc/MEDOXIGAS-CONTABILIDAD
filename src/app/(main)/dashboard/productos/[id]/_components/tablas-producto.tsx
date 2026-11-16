"use client";

import { type ReactNode, useState } from "react";

import { cn } from "cn";
import { Search } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { PiePagina, TH, usePagina } from "@/components/ficha/ficha-ui";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export function TablaKardex({
  filas,
  filtrado,
}: {
  readonly filas: readonly FilaKardex[];
  readonly filtrado: boolean;
}) {
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
