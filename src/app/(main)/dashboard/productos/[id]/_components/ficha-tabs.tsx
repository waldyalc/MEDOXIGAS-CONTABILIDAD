"use client";

import { useState } from "react";

import Link from "next/link";

import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rutaCompra, rutaContacto, rutaFactura } from "@/lib/enlaces";
import { formatoCantidad, formatoMoneda, formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { type DocumentoFicha, filtrarPorNumero, saldoCentavos } from "@/lib/productos/ficha";
import type { FilaKardex, ResultadoKardex } from "@/lib/productos/kardex";

const ETIQUETAS_ESTADO: Record<string, string> = {
  abierta: "Abierta",
  pagada: "Pagada",
  anulada: "Anulada",
};

function EstadoBadge({ estado }: { readonly estado: string }) {
  const etiqueta = ETIQUETAS_ESTADO[estado] ?? estado;

  if (estado === "anulada") return <Badge variant="destructive">{etiqueta}</Badge>;
  if (estado === "pagada") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      >
        {etiqueta}
      </Badge>
    );
  }

  return <Badge variant="outline">{etiqueta}</Badge>;
}

function FiltroNumero({ valor, onCambio }: { readonly valor: string; readonly onCambio: (valor: string) => void }) {
  return (
    <div className="relative max-w-sm">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={valor}
        onChange={(event) => onCambio(event.target.value)}
        placeholder="Filtrar por número o NCF…"
        aria-label="Filtrar por número o NCF"
        className="pl-8"
      />
    </div>
  );
}

function DocumentoEnlace({
  documento,
  tipo,
}: {
  readonly documento: DocumentoFicha;
  readonly tipo: "venta" | "compra";
}) {
  return (
    <div className="flex flex-col">
      <Link
        href={tipo === "venta" ? rutaFactura(documento.id) : rutaCompra(documento.id)}
        prefetch={false}
        className="font-medium hover:underline"
      >
        #{documento.numero}
      </Link>
      <span className="text-muted-foreground font-mono text-xs">{documento.ncf ?? "—"}</span>
    </div>
  );
}

function TablaDocumentos({
  documentos,
  tipo,
  filtro,
}: {
  readonly documentos: DocumentoFicha[];
  readonly tipo: "venta" | "compra";
  readonly filtro: string;
}) {
  const esVenta = tipo === "venta";
  const vacio = esVenta
    ? "Este producto todavía no tiene facturas de venta."
    : "Este producto todavía no tiene facturas de compra.";

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número/NCF</TableHead>
            <TableHead>{esVenta ? "Cliente" : "Proveedor"}</TableHead>
            <TableHead>Creación</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">{esVenta ? "Cobrado" : "Pagado"}</TableHead>
            <TableHead className="text-right">{esVenta ? "Por cobrar" : "Por pagar"}</TableHead>
            {esVenta ? <TableHead>Estado</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {documentos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={esVenta ? 9 : 8} className="text-muted-foreground h-24 text-center whitespace-normal">
                {filtro.trim() ? "No se encontraron documentos con ese filtro." : vacio}
              </TableCell>
            </TableRow>
          ) : (
            documentos.map((documento) => (
              <TableRow key={documento.id}>
                <TableCell>
                  <DocumentoEnlace documento={documento} tipo={tipo} />
                </TableCell>
                <TableCell>
                  <Link href={rutaContacto(documento.contactoId)} prefetch={false} className="hover:underline">
                    {documento.contactoNombre}
                  </Link>
                </TableCell>
                <TableCell>{formatoDia(documento.fecha)}</TableCell>
                <TableCell>{formatoDia(documento.vencimiento)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoCantidad(documento.cantidad)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoMoneda(documento.total)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoMoneda(documento.pagado)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatoMonedaCentavos(saldoCentavos(documento.total, documento.pagado))}
                </TableCell>
                {esVenta ? (
                  <TableCell>
                    <EstadoBadge estado={documento.estado} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function TablaKardex({ filas, filtro }: { readonly filas: FilaKardex[]; readonly filtro: string }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Documento</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Tercero</TableHead>
            <TableHead className="text-right">Entrada</TableHead>
            <TableHead className="text-right">Salida</TableHead>
            <TableHead className="text-right">Costo unitario</TableHead>
            <TableHead className="text-right">Existencia después</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground h-24 text-center whitespace-normal">
                {filtro.trim()
                  ? "No se encontraron movimientos con ese filtro."
                  : "Este producto todavía no tiene movimientos de inventario."}
              </TableCell>
            </TableRow>
          ) : (
            filas.map((fila) => (
              <TableRow key={`${fila.tipo}:${fila.documentoId}`}>
                <TableCell>
                  <div className="flex flex-col">
                    <Link
                      href={fila.tipo === "venta" ? rutaFactura(fila.documentoId) : rutaCompra(fila.documentoId)}
                      prefetch={false}
                      className="font-medium hover:underline"
                    >
                      #{fila.numero}
                    </Link>
                    <span className="text-muted-foreground font-mono text-xs">{fila.ncf ?? "—"}</span>
                  </div>
                </TableCell>
                <TableCell>{formatoDia(fila.fecha)}</TableCell>
                <TableCell>
                  <Link href={rutaContacto(fila.terceroId)} prefetch={false} className="hover:underline">
                    {fila.terceroNombre}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatoCantidad(fila.entrada)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoCantidad(fila.salida)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoMoneda(fila.costoUnitario)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoCantidad(fila.existencia)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function FichaTabs({
  facturasVenta,
  facturasCompra,
  kardex,
}: {
  readonly facturasVenta: DocumentoFicha[];
  readonly facturasCompra: DocumentoFicha[];
  readonly kardex: ResultadoKardex;
}) {
  const [filtroVentas, setFiltroVentas] = useState("");
  const [filtroCompras, setFiltroCompras] = useState("");
  const [filtroKardex, setFiltroKardex] = useState("");

  const ventasFiltradas = filtrarPorNumero(facturasVenta, filtroVentas);
  const comprasFiltradas = filtrarPorNumero(facturasCompra, filtroCompras);
  const kardexFiltrado = filtrarPorNumero(kardex.filas, filtroKardex);

  return (
    <Tabs defaultValue="ventas" className="gap-4">
      <TabsList variant="line">
        <TabsTrigger value="ventas">Facturas de venta</TabsTrigger>
        <TabsTrigger value="compras">Facturas de compra</TabsTrigger>
        <TabsTrigger value="kardex">Kárdex</TabsTrigger>
      </TabsList>

      <TabsContent value="ventas" className="flex flex-col gap-4">
        <FiltroNumero valor={filtroVentas} onCambio={setFiltroVentas} />
        <TablaDocumentos documentos={ventasFiltradas} tipo="venta" filtro={filtroVentas} />
      </TabsContent>

      <TabsContent value="compras" className="flex flex-col gap-4">
        <FiltroNumero valor={filtroCompras} onCambio={setFiltroCompras} />
        <TablaDocumentos documentos={comprasFiltradas} tipo="compra" filtro={filtroCompras} />
      </TabsContent>

      <TabsContent value="kardex" className="flex flex-col gap-4">
        <FiltroNumero valor={filtroKardex} onCambio={setFiltroKardex} />
        <TablaKardex filas={kardexFiltrado} filtro={filtroKardex} />
      </TabsContent>
    </Tabs>
  );
}
