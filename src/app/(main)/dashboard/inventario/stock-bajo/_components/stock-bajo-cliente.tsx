"use client";

import { useMemo, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { Download, Search, TriangleAlert } from "lucide-react";

import { PaginadorLocal } from "@/components/listas/paginador-local";
import { BarraLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { SelectCampo } from "@/components/select-campo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Almacen } from "@/lib/inventario/tipos";

import {
  csvStockBajo,
  type FilaStockBajo,
  fechaArchivoRd,
  filtrarStockBajo,
  nombreArchivoStockBajo,
  resumirStock,
} from "../_lib/stock-bajo";
import { TablaStockBajo } from "./tabla-stock-bajo";
import { TarjetasStockBajo } from "./tarjetas-stock-bajo";

const POR_PAGINA = 25;
const TAMANOS = [25, 50, 100] as const;

interface Props {
  readonly filas: readonly FilaStockBajo[];
  readonly almacenes: readonly Almacen[];
  readonly almacenId: string;
  readonly almacenNombre: string;
  readonly error: string | null;
}

export function StockBajoCliente({ filas, almacenes, almacenId, almacenNombre, error }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [busqueda, setBusqueda] = useState("");
  const [porPagina, setPorPagina] = useState<number>(POR_PAGINA);
  const [pagina, setPagina] = useState(0);

  const filtradas = useMemo(() => filtrarStockBajo(filas, busqueda), [filas, busqueda]);
  const resumen = useMemo(() => resumirStock(filtradas), [filtradas]);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = filtradas.slice(paginaActual * porPagina, (paginaActual + 1) * porPagina);
  const opcionesAlmacen = almacenes.map((almacen) => ({ value: almacen.id, label: almacen.nombre }));

  function cambiarAlmacen(valor: string) {
    if (valor === "" || valor === almacenId) return;
    router.replace(`${pathname}?almacen=${encodeURIComponent(valor)}`, { scroll: false });
  }

  function buscar(valor: string) {
    setBusqueda(valor);
    setPagina(0);
  }

  function exportar() {
    if (filtradas.length === 0) return;

    const archivo = new Blob([`\uFEFF${csvStockBajo(filtradas)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivoStockBajo(almacenNombre, fechaArchivoRd());
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <>
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="stock-bajo-almacen">Almacén</Label>
        <SelectCampo
          id="stock-bajo-almacen"
          opciones={opcionesAlmacen}
          valor={almacenId}
          onCambio={cambiarAlmacen}
          deshabilitado={opcionesAlmacen.length === 0}
          aria-label="Almacén del reporte"
        />
      </div>

      {error !== null ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo cargar el stock bajo</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <TarjetasStockBajo resumen={resumen} />

          <TarjetaLista data-lista="inventario-stock-bajo">
            <BarraLista className="h-auto flex-wrap gap-2 py-2 sm:h-14 sm:flex-nowrap">
              <div className="relative w-full sm:max-w-[320px]">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input
                  value={busqueda}
                  onChange={(evento) => buscar(evento.target.value)}
                  placeholder="Buscar por nombre, referencia o código…"
                  aria-label="Buscar productos con stock bajo"
                  className="pl-8"
                />
              </div>

              <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
                <Button variant="outline" onClick={exportar} disabled={filtradas.length === 0}>
                  <Download />
                  Exportar CSV
                </Button>
              </div>
            </BarraLista>

            <TablaStockBajo filas={visibles} buscando={busqueda.trim() !== ""} />

            <div className="border-border border-t px-4 py-3">
              <PaginadorLocal
                total={filtradas.length}
                pagina={paginaActual}
                setPagina={setPagina}
                porPagina={porPagina}
                etiqueta="productos"
                opciones={TAMANOS}
                onCambiarPorPagina={(tamano) => {
                  setPorPagina(tamano);
                  setPagina(0);
                }}
              />
            </div>
          </TarjetaLista>
        </>
      )}
    </>
  );
}
