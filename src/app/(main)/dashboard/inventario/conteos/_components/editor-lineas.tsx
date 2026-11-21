"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

import { cn } from "cn";

import { FORM_INPUT, FORM_INPUT_GROUP } from "@/components/formularios/formulario";
import { Loader2, Plus, Search, Trash2 } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoCantidad } from "@/lib/facturacion/formato";

import { buscarProductosConteo } from "./acciones-conteo";
import {
  claseDiferencia,
  decimalACentavos,
  diferenciaCentavos,
  type LineaConteoFormulario,
  type ProductoConteo,
  textoDiferencia,
  totalesConteo,
} from "./tipos-conteo";

interface Props {
  almacenId: string;
  lineas: LineaConteoFormulario[];
  onCambiar: Dispatch<SetStateAction<LineaConteoFormulario[]>>;
  deshabilitado: boolean;
  errores: Record<string, string>;
  onLimpiarError: (campo: string) => void;
  /** true = conteo aplicado o anulado: solo se muestran las líneas guardadas. */
  soloLectura?: boolean;
}

const RETARDO_BUSQUEDA = 320;

interface BuscadorProps {
  almacenId: string;
  ocupados: ReadonlySet<string>;
  deshabilitado: boolean;
  onAgregar: (producto: ProductoConteo) => void;
}

function ResultadosBusqueda({
  texto,
  buscando,
  error,
  resultados,
  ocupados,
  onAgregar,
}: {
  texto: string;
  buscando: boolean;
  error: string | null;
  resultados: readonly ProductoConteo[];
  ocupados: ReadonlySet<string>;
  onAgregar: (producto: ProductoConteo) => void;
}) {
  const vacio = !buscando && error === null && resultados.length === 0;

  return (
    <div className="bg-popover border-border absolute top-full right-0 left-0 z-20 mt-1 max-h-80 overflow-auto rounded-xl border p-1 shadow-lg">
      {buscando && resultados.length === 0 ? (
        <p className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Buscando…
        </p>
      ) : null}

      {error ? (
        <p className="text-destructive px-3 py-2 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {vacio ? (
        <p className="text-muted-foreground px-3 py-2 text-sm">
          {texto.trim() === ""
            ? "No hay productos con control de inventario en este almacén."
            : "No encontramos productos con ese nombre o código."}
        </p>
      ) : null}

      {resultados.map((producto) => {
        const yaEsta = ocupados.has(producto.id);

        return (
          <button
            key={producto.id}
            type="button"
            onClick={() => onAgregar(producto)}
            disabled={yaEsta}
            className="hover:bg-muted focus-visible:bg-muted flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:opacity-50"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-foreground truncate font-medium">{producto.nombre}</span>
              <span className="text-muted-foreground truncate text-xs">
                {producto.referencia?.trim() || "Sin código"}
              </span>
            </span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {yaEsta ? "En el conteo" : `Sistema: ${formatoCantidad(producto.stock)}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function BuscadorProducto({ almacenId, ocupados, deshabilitado, onAgregar }: BuscadorProps) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ProductoConteo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || almacenId === "") {
      setResultados([]);
      setBuscando(false);
      return;
    }

    let vigente = true;
    setBuscando(true);
    setError(null);

    const temporizador = setTimeout(async () => {
      const respuesta = await buscarProductosConteo(almacenId, texto.trim());
      if (!vigente) return;

      setBuscando(false);
      if (!respuesta.ok) {
        setError(respuesta.error);
        setResultados([]);
        return;
      }

      setResultados(respuesta.productos);
    }, RETARDO_BUSQUEDA);

    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [texto, abierto, almacenId]);

  function agregar(producto: ProductoConteo) {
    if (ocupados.has(producto.id)) {
      setAviso("Ese producto ya está en el conteo.");
      return;
    }

    onAgregar(producto);
    setAviso(null);
    setTexto("");
    setResultados([]);
    setAbierto(false);
  }

  return (
    <search
      aria-label="Buscar productos para el conteo"
      className="relative flex flex-col gap-1.5"
      onBlur={(evento) => {
        const siguiente = evento.relatedTarget;
        if (!(siguiente instanceof Node) || !evento.currentTarget.contains(siguiente)) setAbierto(false);
      }}
    >
      <label htmlFor="conteo-buscador" className="text-sm leading-5 font-medium text-slate-700">
        Buscar producto
      </label>
      <InputGroup className={cn(FORM_INPUT_GROUP, "h-10")}>
        <InputGroupAddon align="inline-start" className="pl-2">
          <Search className="text-muted-foreground size-4" aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id="conteo-buscador"
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setAbierto(true);
            setAviso(null);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={(evento) => {
            if (evento.key === "Escape") setAbierto(false);
            // Enter no debe enviar el formulario: el buscador no guarda nada.
            if (evento.key === "Enter") evento.preventDefault();
          }}
          placeholder="Nombre, referencia o código de barra"
          autoComplete="off"
          disabled={deshabilitado || almacenId === ""}
        />
        <InputGroupAddon align="inline-end" className="pr-2">
          {buscando ? <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden="true" /> : null}
        </InputGroupAddon>
      </InputGroup>
      {almacenId === "" ? (
        <p className="text-muted-foreground text-xs">Selecciona el almacén para buscar sus productos.</p>
      ) : null}
      {abierto && almacenId !== "" ? (
        <ResultadosBusqueda
          texto={texto}
          buscando={buscando}
          error={error}
          resultados={resultados}
          ocupados={ocupados}
          onAgregar={agregar}
        />
      ) : null}
      {aviso ? (
        <p className="text-muted-foreground text-xs" role="status">
          {aviso}
        </p>
      ) : null}
    </search>
  );
}

interface FilaProps {
  linea: LineaConteoFormulario;
  soloLectura: boolean;
  deshabilitado: boolean;
  error?: string;
  onContada: (productoId: string, valor: string) => void;
  onNota: (productoId: string, valor: string) => void;
  onQuitar: (productoId: string) => void;
}

function FilaLinea({ linea, soloLectura, deshabilitado, error, onContada, onNota, onQuitar }: FilaProps) {
  const diferencia = diferenciaCentavos(linea);
  const campo = `conteo-contada-${linea.producto_id}`;

  return (
    <TableRow>
      <TableCell className="py-2 text-sm font-medium whitespace-normal">
        <span className="flex flex-col">
          <span>{linea.nombre}</span>
          <span className="text-muted-foreground text-xs font-normal md:hidden">
            {linea.referencia?.trim() || "Sin código"}
          </span>
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground hidden py-2 text-sm md:table-cell">
        {linea.referencia?.trim() || "—"}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">{formatoCantidad(linea.sistema)}</TableCell>
      <TableCell className="py-2">
        {soloLectura ? (
          <p className="text-right text-sm tabular-nums">{formatoCantidad(linea.contada)}</p>
        ) : (
          <div className="flex flex-col gap-1">
            <Input
              id={campo}
              inputMode="decimal"
              value={linea.contada}
              onChange={(evento) => onContada(linea.producto_id, evento.target.value)}
              aria-label={`Cantidad contada de ${linea.nombre}`}
              aria-invalid={Boolean(error)}
              disabled={deshabilitado}
              className={cn(FORM_INPUT, "text-right")}
            />
            {error ? (
              <p role="alert" className="text-destructive text-xs">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </TableCell>
      <TableCell className={cn("text-right text-sm font-medium tabular-nums", claseDiferencia(diferencia))}>
        {diferencia === null ? "—" : textoDiferencia(diferencia)}
      </TableCell>
      <TableCell className="py-2">
        {soloLectura ? (
          <span className="text-muted-foreground text-sm whitespace-normal">{linea.nota.trim() || "—"}</span>
        ) : (
          <Input
            value={linea.nota}
            onChange={(evento) => onNota(linea.producto_id, evento.target.value)}
            aria-label={`Nota de ${linea.nombre}`}
            placeholder="Opcional"
            maxLength={500}
            disabled={deshabilitado}
            className={FORM_INPUT}
          />
        )}
      </TableCell>
      {soloLectura ? null : (
        <TableCell className="py-2 text-right">
          <button
            type="button"
            onClick={() => onQuitar(linea.producto_id)}
            disabled={deshabilitado}
            aria-label={`Quitar ${linea.nombre} del conteo`}
            className="text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </TableCell>
      )}
    </TableRow>
  );
}

function FilaVacia({ columnas }: { columnas: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={columnas} className="px-6 py-12">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <Plus className="size-8 text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <p className="text-base font-semibold">Todavía no hay productos en el conteo</p>
          <p className="text-muted-foreground text-sm">
            Busca un producto por nombre o código y agrégalo para empezar a contar.
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ResumenTotales({ lineas }: { lineas: readonly LineaConteoFormulario[] }) {
  const totales = totalesConteo(lineas);

  return (
    <div className="text-muted-foreground flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm tabular-nums">
      <span>
        Con diferencia:{" "}
        <strong className="text-foreground font-medium">{formatoCantidad(totales.conDiferencia)}</strong>
      </span>
      <span>
        Entradas:{" "}
        <strong className="font-medium text-green-700 dark:text-green-400">
          {textoDiferencia(totales.entradasCentavos)}
        </strong>
      </span>
      <span>
        Salidas:{" "}
        <strong className="font-medium text-red-700 dark:text-red-400">
          {totales.salidasCentavos === 0 ? "0" : textoDiferencia(totales.salidasCentavos)}
        </strong>
      </span>
      <span className="text-foreground">
        Diferencia total: <strong className="font-semibold">{textoDiferencia(totales.diferenciaCentavos)}</strong>
      </span>
    </div>
  );
}

export function EditorLineas({
  almacenId,
  lineas,
  onCambiar,
  deshabilitado,
  errores,
  onLimpiarError,
  soloLectura = false,
}: Props) {
  const ocupados = new Set(lineas.map((linea) => linea.producto_id));

  function agregarProducto(producto: ProductoConteo) {
    const contada = decimalACentavos(producto.stock) < 0 ? "0.00" : producto.stock;

    onCambiar((actuales) => [
      ...actuales,
      {
        producto_id: producto.id,
        nombre: producto.nombre,
        referencia: producto.referencia,
        sistema: producto.stock,
        contada,
        nota: "",
      },
    ]);
  }

  function cambiarContada(productoId: string, valor: string) {
    onCambiar((actuales) =>
      actuales.map((linea) => (linea.producto_id === productoId ? { ...linea, contada: valor } : linea)),
    );
    onLimpiarError(`conteo-contada-${productoId}`);
  }

  function cambiarNota(productoId: string, valor: string) {
    onCambiar((actuales) =>
      actuales.map((linea) => (linea.producto_id === productoId ? { ...linea, nota: valor } : linea)),
    );
  }

  function quitar(productoId: string) {
    onCambiar((actuales) => actuales.filter((linea) => linea.producto_id !== productoId));
    onLimpiarError(`conteo-contada-${productoId}`);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground text-base leading-6 font-semibold">Productos contados</h2>
          <p className="text-muted-foreground text-sm">
            La cantidad del sistema es solo de referencia: se vuelve a leer de existencias al guardar y al aplicar. La
            contada viene precargada; corrígela con lo que cuentes.
          </p>
        </div>
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatoCantidad(lineas.length)} {lineas.length === 1 ? "línea" : "líneas"}
        </span>
      </div>

      {soloLectura ? null : (
        <BuscadorProducto
          almacenId={almacenId}
          ocupados={ocupados}
          deshabilitado={deshabilitado}
          onAgregar={agregarProducto}
        />
      )}

      <div className="border-border overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-12 min-w-[240px]">Producto</TableHead>
              <TableHead className="hidden h-12 min-w-[120px] md:table-cell">Código</TableHead>
              <TableHead className="h-12 min-w-[110px] text-right">Sistema</TableHead>
              <TableHead className="h-12 min-w-[130px] text-right">Contada</TableHead>
              <TableHead className="h-12 min-w-[120px] text-right">Diferencia</TableHead>
              <TableHead className="h-12 min-w-[180px]">Nota</TableHead>
              {soloLectura ? null : (
                <TableHead className="h-12 w-10">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineas.length === 0 ? (
              <FilaVacia columnas={soloLectura ? 6 : 7} />
            ) : (
              lineas.map((linea) => (
                <FilaLinea
                  key={linea.producto_id}
                  linea={linea}
                  soloLectura={soloLectura}
                  deshabilitado={deshabilitado}
                  error={errores[`conteo-contada-${linea.producto_id}`]}
                  onContada={cambiarContada}
                  onNota={cambiarNota}
                  onQuitar={quitar}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ResumenTotales lineas={lineas} />
    </section>
  );
}
