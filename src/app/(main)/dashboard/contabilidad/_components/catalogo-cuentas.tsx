"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { cn } from "cn";
import { BookOpen, ChevronRight, Info, Pencil, Plus, Search } from "lucide-react";

import { EditarCuenta, NuevaCuenta } from "@/components/contabilidad/cuenta-formulario";
import { BarraLista, type ColumnaLista, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsLg } from "@/hooks/use-lg";
import {
  alternarExpandido,
  aplanarArbol,
  construirArbolCatalogo,
  ETIQUETAS_CONFIG,
  expandidosIniciales,
  expandirTodo,
  type FilaCatalogo,
  filtrarArbol,
  indexarNodos,
  usoDeCuenta,
} from "@/lib/contabilidad/catalogo";
import {
  type CuentaEditable,
  type CuentaOpcion,
  etiquetaNaturalezaCuenta,
  etiquetaTipoCuenta,
} from "@/lib/contabilidad/validacion";
import { rutaCuenta } from "@/lib/enlaces";
import type { NodoCuenta } from "@/lib/reportes/contabilidad";
import { formatearRd } from "@/lib/reportes/dinero";
import type { CuentaContable, FilaConfigContable } from "@/lib/reportes/tipos";

const COLOR_TIPO: Record<string, string> = {
  activo: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
  pasivo: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  capital: "border-transparent bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300",
  ingreso: "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
  costo: "border-transparent bg-orange-100 text-orange-800 dark:bg-orange-400/15 dark:text-orange-300",
  gasto: "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300",
};

const INDENTACION = 24;

function aEditable(cuenta: CuentaContable): CuentaEditable {
  return {
    id: cuenta.id,
    codigo: cuenta.codigo,
    nombre: cuenta.nombre,
    tipo: cuenta.tipo,
    naturaleza: cuenta.naturaleza,
    padre_id: cuenta.padre_id,
    acepta_movimientos: cuenta.acepta_movimientos,
    es_caja_banco: cuenta.es_caja_banco ?? false,
    activa: cuenta.activa,
  };
}

function DetalleCuenta({ nodo, uso }: { nodo: NodoCuenta; uso: string | null }) {
  const cuenta = nodo.cuenta;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Código</dt>
        <dd className="tabular-nums">{cuenta.codigo}</dd>

        <dt className="text-muted-foreground">Nombre</dt>
        <dd className="break-words">{cuenta.nombre}</dd>

        <dt className="text-muted-foreground">Tipo de cuenta</dt>
        <dd>{etiquetaTipoCuenta(cuenta.tipo)}</dd>

        <dt className="text-muted-foreground">Naturaleza</dt>
        <dd>{etiquetaNaturalezaCuenta(cuenta.naturaleza)}</dd>

        <dt className="text-muted-foreground">Uso de cuenta</dt>
        <dd>{uso ?? "—"}</dd>

        <dt className="text-muted-foreground">Descripción</dt>
        <dd className="break-words">{cuenta.descripcion?.trim() || "—"}</dd>

        <dt className="text-muted-foreground">Saldo</dt>
        <dd className={cn("font-medium tabular-nums", nodo.saldo < 0 && "text-destructive")}>
          {formatearRd(nodo.saldo)}
        </dd>
      </dl>

      <Button variant="outline" size="sm" className="w-fit" render={<Link href={rutaCuenta(cuenta.id)} />}>
        <BookOpen data-icon="inline-start" />
        Ver movimientos
      </Button>
    </div>
  );
}

const PANEL_VACIO = "Selecciona una cuenta para ver su código, tipo, naturaleza, uso y saldo.";

interface AccionesCuentaProps {
  cuenta: CuentaContable;
  cuentas: readonly CuentaOpcion[];
  puedeEditar: boolean;
}

function AccionesCuenta({ cuenta, cuentas, puedeEditar }: AccionesCuentaProps) {
  return (
    <div className="flex items-center justify-end gap-0.5 opacity-100 transition-opacity focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
      {puedeEditar ? (
        <NuevaCuenta
          cuentas={cuentas}
          padreIdInicial={cuenta.id}
          tipoInicial={cuenta.tipo}
          trigger={
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Crear subcuenta de ${cuenta.nombre}`}>
              <Plus />
            </Button>
          }
        />
      ) : null}

      {puedeEditar ? (
        <EditarCuenta
          cuenta={aEditable(cuenta)}
          cuentas={cuentas}
          bloquearCodigoTipoNaturaleza={false}
          trigger={
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${cuenta.nombre}`}>
              <Pencil />
            </Button>
          }
        />
      ) : null}

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Ver movimientos de ${cuenta.nombre}`}
        render={<Link href={rutaCuenta(cuenta.id)} />}
      >
        <BookOpen />
      </Button>
    </div>
  );
}

function columnasCatalogo({
  uso,
  seleccionadaId,
  onSeleccionar,
  onAlternar,
}: {
  readonly uso: (cuenta: CuentaContable) => string | null;
  readonly seleccionadaId: string | null;
  readonly onSeleccionar: (id: string) => void;
  readonly onAlternar: (id: string) => void;
}): readonly ColumnaLista<FilaCatalogo>[] {
  return [
    {
      clave: "nombre",
      encabezado: "Nombre de la cuenta",
      className: "whitespace-normal",
      celda: (fila) => (
        <ContenidoNombreCuenta
          fila={fila}
          seleccionada={fila.nodo.cuenta.id === seleccionadaId}
          onSeleccionar={onSeleccionar}
          onAlternar={onAlternar}
        />
      ),
    },
    {
      clave: "codigo",
      encabezado: "Código",
      className: "w-20",
      celda: (fila) => <span className="text-muted-foreground tabular-nums">{fila.nodo.cuenta.codigo}</span>,
    },
    {
      clave: "uso",
      encabezado: (
        <span className="inline-flex items-center gap-1">
          Uso de cuenta
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label="Qué es el uso de cuenta"
                  className="text-muted-foreground hover:text-foreground inline-flex transition-colors"
                >
                  <Info className="size-3.5" />
                </button>
              }
            />
            <TooltipContent className="max-w-64 whitespace-normal">
              Cuenta especial que usa el motor contable: caja, banco, cuentas por cobrar o pagar, inventario, impuestos,
              ventas, costos o gastos generales.
            </TooltipContent>
          </Tooltip>
        </span>
      ),
      className: "hidden w-44 md:table-cell",
      celda: (fila) => (
        <span className="text-muted-foreground block max-w-44 truncate">{uso(fila.nodo.cuenta) ?? "—"}</span>
      ),
    },
    {
      clave: "descripcion",
      encabezado: "Descripción",
      className: "hidden max-w-72 xl:table-cell",
      celda: (fila) => <DescripcionCuenta descripcion={fila.nodo.cuenta.descripcion} />,
    },
    {
      clave: "saldo",
      encabezado: "Saldo",
      alineacion: "derecha",
      celda: (fila) => (
        <span className={cn(fila.nodo.saldo < 0 && "text-destructive")}>{formatearRd(fila.nodo.saldo)}</span>
      ),
    },
  ];
}

function DescripcionCuenta({ descripcion }: { readonly descripcion: string | null | undefined }) {
  const texto = descripcion?.trim() ?? "";
  if (texto === "") return <span className="text-muted-foreground">—</span>;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="block max-w-72 cursor-default truncate" />}>{texto}</TooltipTrigger>
      <TooltipContent className="max-w-sm whitespace-normal">{texto}</TooltipContent>
    </Tooltip>
  );
}

function ContenidoNombreCuenta({
  fila,
  seleccionada,
  onSeleccionar,
  onAlternar,
}: {
  readonly fila: FilaCatalogo;
  readonly seleccionada: boolean;
  readonly onSeleccionar: (id: string) => void;
  readonly onAlternar: (id: string) => void;
}) {
  const cuenta = fila.nodo.cuenta;
  const tieneHijos = fila.nodo.hijos.length > 0;
  const guias = Array.from({ length: fila.nivel }, (_, indice) => indice * INDENTACION + INDENTACION / 2);

  return (
    <div className="relative flex items-center gap-1.5" style={{ paddingLeft: `${fila.nivel * INDENTACION}px` }}>
      {guias.map((izquierda) => (
        <span
          key={`guia-${cuenta.id}-${izquierda}`}
          aria-hidden="true"
          className="bg-border/70 pointer-events-none absolute -top-2 -bottom-2 w-px"
          style={{ left: `${izquierda}px` }}
        />
      ))}

      {tieneHijos ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0"
          aria-label={fila.abierta ? `Contraer ${cuenta.nombre}` : `Expandir ${cuenta.nombre}`}
          aria-expanded={fila.abierta}
          onClick={() => onAlternar(cuenta.id)}
        >
          <ChevronRight className={cn("transition-transform", fila.abierta && "rotate-90")} />
        </Button>
      ) : (
        <span aria-hidden="true" className="size-6 shrink-0" />
      )}

      <button
        type="button"
        onClick={() => onSeleccionar(cuenta.id)}
        aria-pressed={seleccionada}
        className={cn(
          "min-w-0 truncate text-left hover:underline",
          !cuenta.acepta_movimientos && "font-medium",
          seleccionada && "text-primary",
        )}
      >
        {cuenta.nombre}
      </button>

      {fila.esRaiz ? (
        <Badge className={cn("shrink-0", COLOR_TIPO[cuenta.tipo] ?? "bg-muted text-muted-foreground")}>
          {etiquetaTipoCuenta(cuenta.tipo)}
        </Badge>
      ) : null}

      {cuenta.activa ? null : (
        <Badge variant="outline" className="text-muted-foreground shrink-0">
          Inactiva
        </Badge>
      )}
    </div>
  );
}

interface CatalogoCuentasProps {
  cuentas: readonly CuentaContable[];
  saldos: Record<string, number>;
  configuracion: readonly FilaConfigContable[];
  puedeEditar: boolean;
}

export function CatalogoCuentas({ cuentas, saldos, configuracion, puedeEditar }: CatalogoCuentasProps) {
  const arbol = useMemo(() => construirArbolCatalogo(cuentas, saldos), [cuentas, saldos]);
  const [expandidos, setExpandidos] = useState<Set<string>>(() => expandidosIniciales(arbol));
  const [busqueda, setBusqueda] = useState("");
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const esLg = useIsLg();

  const filtro = useMemo(() => (busqueda.trim() === "" ? null : filtrarArbol(arbol, busqueda)), [arbol, busqueda]);
  const filas = useMemo(() => aplanarArbol(filtro ? filtro.nodos : arbol, expandidos), [arbol, filtro, expandidos]);
  const nodosPorId = useMemo(() => indexarNodos(arbol), [arbol]);
  const seleccionada = seleccionadaId == null ? null : (nodosPorId.get(seleccionadaId) ?? null);

  const usoPorCuenta = useMemo(() => {
    const mapa = new Map<string, string>();

    for (const fila of configuracion) {
      const etiqueta = ETIQUETAS_CONFIG[fila.clave];
      if (etiqueta != null && !mapa.has(fila.cuenta_id)) mapa.set(fila.cuenta_id, etiqueta);
    }

    return mapa;
  }, [configuracion]);

  function uso(cuenta: CuentaContable): string | null {
    return usoDeCuenta(cuenta, usoPorCuenta.get(cuenta.id));
  }

  function seleccionar(id: string) {
    setSeleccionadaId(id);
    if (!esLg) setSheetAbierto(true);
  }

  function buscar(valor: string) {
    setBusqueda(valor);
    if (valor.trim() !== "") setExpandidos(filtrarArbol(arbol, valor).expandidos);
  }

  function expandir() {
    setBusqueda("");
    setExpandidos(expandirTodo(arbol));
  }

  function contraer() {
    setBusqueda("");
    setExpandidos(new Set());
  }

  const usoSeleccionada = seleccionada == null ? null : uso(seleccionada.cuenta);

  return (
    <div className={cn("grid items-start gap-6", seleccionada != null && "lg:grid-cols-[minmax(0,1fr)_18rem]")}>
      <TarjetaLista data-lista="contabilidad-catalogo">
        <BarraLista>
          <div className="relative w-full sm:max-w-[267px]">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              value={busqueda}
              onChange={(event) => buscar(event.target.value)}
              placeholder="Buscar por nombre o código…"
              aria-label="Buscar cuentas"
              className="h-8 pl-8"
            />
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={expandir}>
              Expandir todo
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={contraer}>
              Contraer todo
            </Button>
          </div>
        </BarraLista>

        <TablaLista
          columnas={columnasCatalogo({
            uso,
            seleccionadaId,
            onSeleccionar: seleccionar,
            onAlternar: (id) => setExpandidos((actual) => alternarExpandido(actual, id)),
          })}
          filas={filas}
          claveFila={(fila) => fila.nodo.cuenta.id}
          acciones={(fila) => <AccionesCuenta cuenta={fila.nodo.cuenta} cuentas={cuentas} puedeEditar={puedeEditar} />}
          vacio={{
            filtrada: busqueda.trim() !== "",
            titulo: busqueda.trim() === "" ? "Sin cuentas" : "Sin resultados",
            descripcion:
              busqueda.trim() === ""
                ? "No hay cuentas contables registradas."
                : "Ninguna cuenta coincide con la búsqueda.",
          }}
        />
      </TarjetaLista>

      {seleccionada == null ? null : (
        <aside className="hidden lg:block">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Información de la cuenta</CardTitle>
            </CardHeader>
            <CardContent>
              <DetalleCuenta nodo={seleccionada} uso={usoSeleccionada} />
            </CardContent>
          </Card>
        </aside>
      )}

      {esLg ? null : (
        <Sheet open={sheetAbierto} onOpenChange={setSheetAbierto}>
          <SheetContent className="w-full">
            <SheetHeader>
              <SheetTitle>Información de la cuenta</SheetTitle>
              <SheetDescription>
                {seleccionada == null ? PANEL_VACIO : `${seleccionada.cuenta.codigo} · ${seleccionada.cuenta.nombre}`}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {seleccionada == null ? null : <DetalleCuenta nodo={seleccionada} uso={usoSeleccionada} />}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
