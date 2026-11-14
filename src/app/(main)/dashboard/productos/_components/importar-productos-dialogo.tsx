"use client";

import { type ChangeEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Download, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CategoriaProducto } from "@/lib/inventario/tipos";
import { crearProducto } from "@/lib/productos/actions";
import { parsearCsv, plantillaCsv, type ResultadoImportacion, validarFilasImportacion } from "@/lib/productos/importar";

import { formDataProducto } from "./form-data-producto";

interface ResumenImportacion {
  creados: number;
  fallos: { numero: number; error: string }[];
}

async function leerFilas(archivo: File): Promise<unknown[][]> {
  const nombre = archivo.name.toLowerCase();

  if (nombre.endsWith(".csv")) {
    return parsearCsv(await archivo.text());
  }

  if (!nombre.endsWith(".xlsx")) {
    throw new Error("Formato no soportado");
  }

  const { Workbook } = await import("exceljs");
  const libro = new Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());

  const hoja = libro.worksheets[0];
  if (!hoja) throw new Error("El archivo no tiene hojas");

  const filas: unknown[][] = [];
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    const valores = fila.values;
    if (Array.isArray(valores)) filas.push(valores.slice(1));
  });

  return filas;
}

function TablaVistaPrevia({
  resultado,
  validas,
  conErrores,
}: {
  readonly resultado: ResultadoImportacion;
  readonly validas: number;
  readonly conErrores: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Vista previa</span>
        <Badge variant="outline">{validas} listas para importar</Badge>
        {conErrores > 0 ? <Badge variant="destructive">{conErrores} con errores</Badge> : null}
      </div>

      <div className="max-h-72 overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-background sticky top-0">
            <TableRow>
              <TableHead className="w-12 text-right">Fila</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">ITBIS</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resultado.filas.map((fila) => (
              <TableRow key={fila.numero} className={fila.errores.length > 0 ? "bg-destructive/5" : undefined}>
                <TableCell className="text-right tabular-nums">{fila.numero}</TableCell>
                <TableCell className="font-medium">{fila.valores.nombre || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{fila.valores.referencia || "—"}</TableCell>
                <TableCell>{fila.valores.tipo || "Producto"}</TableCell>
                <TableCell className="text-right tabular-nums">{fila.valores.precio || "—"}</TableCell>
                <TableCell className="text-right">{fila.valores.itbis || "18"}</TableCell>
                <TableCell className="whitespace-normal">
                  {fila.errores.length > 0 ? (
                    <span className="text-destructive text-xs">{fila.errores.join(" ")}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Lista</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ResumenImportacionTexto({ resumen }: { readonly resumen: ResumenImportacion }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="font-medium">
        {resumen.creados > 0 ? `Se importaron ${resumen.creados} productos.` : "No se pudo importar ningún producto."}
      </p>
      {resumen.fallos.length > 0 ? (
        <ul className="text-destructive list-inside list-disc text-xs">
          {resumen.fallos.map((fallo) => (
            <li key={fallo.numero}>
              Fila {fallo.numero}: {fallo.error}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ImportarProductosDialogo({
  abierto,
  categorias,
  onCambiarAbierto,
}: {
  readonly abierto: boolean;
  readonly categorias: CategoriaProducto[];
  readonly onCambiarAbierto: (abierto: boolean) => void;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);

  const validas = resultado?.filas.filter((fila) => fila.datos !== null) ?? [];
  const conErrores = (resultado?.filas.length ?? 0) - validas.length;

  function cambiarAbierto(valor: boolean) {
    onCambiarAbierto(valor);
    if (valor) return;
    setNombreArchivo(null);
    setResultado(null);
    setErrorArchivo(null);
    setResumen(null);
  }

  function descargarPlantilla() {
    const blob = new Blob([plantillaCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "plantilla-productos.csv";
    enlace.click();
    URL.revokeObjectURL(url);
  }

  function cambiarArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.currentTarget.files?.[0];
    evento.currentTarget.value = "";
    if (!archivo) return;

    setNombreArchivo(archivo.name);
    setResultado(null);
    setErrorArchivo(null);
    setResumen(null);

    startTransition(async () => {
      try {
        const filas = await leerFilas(archivo);
        setResultado(validarFilasImportacion(filas, categorias));
      } catch {
        setErrorArchivo("No se pudo leer el archivo. Usa la plantilla en CSV o un Excel .xlsx válido.");
      }
    });
  }

  function importar() {
    if (validas.length === 0) return;

    startTransition(async () => {
      let creados = 0;
      const fallos: { numero: number; error: string }[] = [];

      for (const fila of validas) {
        if (fila.datos === null) continue;
        const respuesta = await crearProducto(formDataProducto(fila.datos));
        if (respuesta.ok) {
          creados++;
        } else {
          fallos.push({ numero: fila.numero, error: respuesta.error });
        }
      }

      setResumen({ creados, fallos });
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar productos</DialogTitle>
          <DialogDescription>
            Descarga la plantilla, complétala y súbela. Revisa la vista previa antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={descargarPlantilla}>
            <Download />
            Descargar plantilla CSV
          </Button>
          <span className="text-muted-foreground text-xs">
            Columnas: nombre, referencia, tipo, precio, ITBIS, costo inicial, unidad, categoría y descripción. Tipo:
            Producto o Servicio. ITBIS: 18, 16 o 0. La categoría debe existir.
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="archivo-productos" className="text-sm font-medium">
            Archivo CSV o Excel (.xlsx)
          </label>
          <Input
            id="archivo-productos"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={cambiarArchivo}
            disabled={pendiente}
          />
          {nombreArchivo ? <p className="text-muted-foreground text-xs">{nombreArchivo}</p> : null}
        </div>

        {errorArchivo ? (
          <p role="alert" className="text-destructive text-sm">
            {errorArchivo}
          </p>
        ) : null}

        {resultado?.errorGeneral ? (
          <p role="alert" className="text-destructive text-sm">
            {resultado.errorGeneral}
          </p>
        ) : null}

        {resultado && resultado.filas.length > 0 ? (
          <TablaVistaPrevia resultado={resultado} validas={validas.length} conErrores={conErrores} />
        ) : null}

        {resumen ? <ResumenImportacionTexto resumen={resumen} /> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => cambiarAbierto(false)}>
            Cerrar
          </Button>
          <Button type="button" onClick={importar} disabled={pendiente || validas.length === 0 || resumen !== null}>
            <Upload />
            {pendiente ? "Importando..." : `Importar ${validas.length > 0 ? validas.length : ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
