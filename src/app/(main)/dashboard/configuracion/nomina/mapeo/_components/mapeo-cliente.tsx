"use client";

import { type ReactNode, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { FORM_COMBO, FormActions } from "@/components/formularios/formulario";
import { AlertTriangle, Loader2, Search } from "@/components/icons";
import { type ColumnaLista, EstadoVacioLista, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { type OpcionSelect, SelectCampo } from "@/components/select-campo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { guardarMapeoContable } from "@/lib/nomina/acciones";
import { mapeoContableSchema, mensajeValidacion } from "@/lib/nomina/esquemas";
import type { ClaseConcepto, MapeoContable, SegmentoContable } from "@/lib/nomina/tipos";

import { etiquetaClaseConcepto } from "../../_datos/concepto";

interface OpcionCuenta {
  value: string;
  label: string;
}

interface FilaEditable {
  concepto_id: string;
  concepto_codigo: string;
  concepto_nombre: string;
  clase: ClaseConcepto;
  cuenta_gasto_id: string;
  cuenta_pasivo_id: string;
}

type EstadoSegmentos = Record<SegmentoContable, FilaEditable[]>;

interface Original {
  gasto: string;
  pasivo: string;
}

const SEGMENTOS: readonly { value: SegmentoContable; label: string }[] = [
  { value: "administrativa", label: "Administrativa" },
  { value: "operativa", label: "Operativa" },
  { value: "ventas", label: "Ventas" },
];

const GRUPOS: readonly { clase: ClaseConcepto; titulo: string }[] = [
  { clase: "ingreso", titulo: "Ingresos" },
  { clase: "deduccion", titulo: "Deducciones" },
  { clase: "aporte_empleador", titulo: "Aportes patronales" },
  { clase: "provision", titulo: "Provisiones" },
];

const CLASES: readonly OpcionSelect[] = [
  { value: "todas", label: "Todas las clases" },
  { value: "ingreso", label: "Ingresos" },
  { value: "deduccion", label: "Deducciones" },
  { value: "aporte_empleador", label: "Aportes patronales" },
  { value: "provision", label: "Provisiones" },
];

function filasDelSegmento(mapeos: readonly MapeoContable[], segmento: SegmentoContable): FilaEditable[] {
  return mapeos
    .filter((mapeo) => mapeo.segmento === segmento)
    .map((mapeo) => ({
      concepto_id: mapeo.concepto_id,
      concepto_codigo: mapeo.concepto_codigo,
      concepto_nombre: mapeo.concepto_nombre,
      clase: mapeo.clase,
      cuenta_gasto_id: mapeo.cuenta_gasto_id ?? "",
      cuenta_pasivo_id: mapeo.cuenta_pasivo_id ?? "",
    }));
}

function estadoInicial(mapeos: readonly MapeoContable[]): EstadoSegmentos {
  return {
    administrativa: filasDelSegmento(mapeos, "administrativa"),
    operativa: filasDelSegmento(mapeos, "operativa"),
    ventas: filasDelSegmento(mapeos, "ventas"),
  };
}

function originalesIniciales(mapeos: readonly MapeoContable[]): Record<string, Original> {
  const mapa: Record<string, Original> = {};

  for (const mapeo of mapeos) {
    mapa[`${mapeo.segmento}:${mapeo.concepto_id}`] = {
      gasto: mapeo.cuenta_gasto_id ?? "",
      pasivo: mapeo.cuenta_pasivo_id ?? "",
    };
  }

  return mapa;
}

function filaCompleta(fila: FilaEditable): boolean {
  if (fila.clase === "ingreso") return fila.cuenta_gasto_id !== "";
  if (fila.clase === "deduccion") return fila.cuenta_pasivo_id !== "";
  return fila.cuenta_gasto_id !== "" && fila.cuenta_pasivo_id !== "";
}

function Seccion({ titulo, cantidad, children }: { titulo: string; cantidad: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold tracking-tight">
        {titulo} <span className="text-muted-foreground text-sm font-normal">({cantidad})</span>
      </h2>
      {children}
    </section>
  );
}

export function MapeoCliente({
  mapeos,
  cuentasGasto,
  cuentasPasivo,
  puedeEditar,
}: {
  readonly mapeos: readonly MapeoContable[];
  readonly cuentasGasto: readonly OpcionCuenta[];
  readonly cuentasPasivo: readonly OpcionCuenta[];
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [segmento, setSegmento] = useState<SegmentoContable>("administrativa");
  const [filas, setFilas] = useState<EstadoSegmentos>(() => estadoInicial(mapeos));
  const [originales, setOriginales] = useState<Record<string, Original>>(() => originalesIniciales(mapeos));
  const [busqueda, setBusqueda] = useState("");
  const [claseFiltro, setClaseFiltro] = useState("todas");
  const [soloIncompletos, setSoloIncompletos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const totalGeneral = Object.values(filas).reduce((suma, lista) => suma + lista.length, 0);
  const filasSegmento = filas[segmento];

  function estaCambiada(fila: FilaEditable): boolean {
    const original = originales[`${segmento}:${fila.concepto_id}`];
    if (!original) return false;
    return original.gasto !== fila.cuenta_gasto_id || original.pasivo !== fila.cuenta_pasivo_id;
  }

  const cambiadas = filasSegmento.filter(estaCambiada);

  function cambiarCuenta(conceptoId: string, campo: "cuenta_gasto_id" | "cuenta_pasivo_id", valor: string) {
    setFilas((previas) => ({
      ...previas,
      [segmento]: previas[segmento].map((fila) =>
        fila.concepto_id === conceptoId ? { ...fila, [campo]: valor } : fila,
      ),
    }));
    setError(null);
  }

  function guardar() {
    setError(null);

    const filasCambiadas = cambiadas.map((fila) => ({
      segmento,
      concepto_id: fila.concepto_id,
      clase: fila.clase,
      cuenta_gasto_id: fila.cuenta_gasto_id || null,
      cuenta_pasivo_id: fila.cuenta_pasivo_id || null,
    }));

    const validado = mapeoContableSchema.safeParse({ mapeos: filasCambiadas });
    if (!validado.success) {
      setError(mensajeValidacion(validado.error));
      return;
    }

    iniciar(async () => {
      const resultado = await guardarMapeoContable({ mapeos: filasCambiadas });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setOriginales((previos) => {
        const siguientes = { ...previos };
        for (const fila of cambiadas) {
          siguientes[`${segmento}:${fila.concepto_id}`] = {
            gasto: fila.cuenta_gasto_id,
            pasivo: fila.cuenta_pasivo_id,
          };
        }
        return siguientes;
      });

      toast.add({
        type: "success",
        title:
          resultado.guardados === cambiadas.length
            ? `Mapeo guardado: ${resultado.guardados} ${resultado.guardados === 1 ? "fila" : "filas"}.`
            : `Se guardaron ${resultado.guardados} filas.`,
      });
      router.refresh();
    });
  }

  const termino = busqueda.trim().toLowerCase();
  const visibles = filasSegmento.filter((fila) => {
    if (claseFiltro !== "todas" && fila.clase !== claseFiltro) return false;
    if (soloIncompletos && filaCompleta(fila)) return false;
    if (!termino) return true;
    return fila.concepto_nombre.toLowerCase().includes(termino) || fila.concepto_codigo.toLowerCase().includes(termino);
  });

  const columnas: readonly ColumnaLista<FilaEditable>[] = [
    {
      clave: "concepto",
      encabezado: "Concepto",
      className: "min-w-56",
      celda: (fila) => (
        <div className="flex items-start gap-2">
          {estaCambiada(fila) ? (
            <span className="mt-1.5 inline-flex shrink-0">
              <span className="bg-amber-500 size-2 rounded-full" aria-hidden="true" />
              <span className="sr-only">Cambio sin guardar</span>
            </span>
          ) : null}
          <div className="flex flex-col">
            <span className="font-medium">{fila.concepto_nombre}</span>
            <span className="text-muted-foreground font-mono text-xs">{fila.concepto_codigo}</span>
          </div>
        </div>
      ),
    },
    {
      clave: "clase",
      encabezado: "Clase",
      className: "w-36",
      celda: (fila) => <span className="text-muted-foreground">{etiquetaClaseConcepto(fila.clase)}</span>,
    },
    {
      clave: "gasto",
      encabezado: "Cuenta de gasto",
      className: "min-w-60",
      celda: (fila) => {
        if (fila.clase === "deduccion") {
          return <span className="text-muted-foreground">— / no aplica</span>;
        }
        return (
          <SelectCampo
            buscable
            opciones={cuentasGasto}
            valor={fila.cuenta_gasto_id}
            onCambio={(valor) => cambiarCuenta(fila.concepto_id, "cuenta_gasto_id", valor)}
            etiquetaVacia="Elegir cuenta"
            className={FORM_COMBO}
            deshabilitado={!puedeEditar}
            aria-label={`Cuenta de gasto de ${fila.concepto_nombre}`}
          />
        );
      },
    },
    {
      clave: "pasivo",
      encabezado: "Cuenta de pasivo",
      className: "min-w-60",
      celda: (fila) => {
        if (fila.clase === "ingreso") {
          return <span className="text-muted-foreground">— / no aplica</span>;
        }
        return (
          <SelectCampo
            buscable
            opciones={cuentasPasivo}
            valor={fila.cuenta_pasivo_id}
            onCambio={(valor) => cambiarCuenta(fila.concepto_id, "cuenta_pasivo_id", valor)}
            etiquetaVacia="Elegir cuenta"
            className={FORM_COMBO}
            deshabilitado={!puedeEditar}
            aria-label={`Cuenta de pasivo de ${fila.concepto_nombre}`}
          />
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {totalGeneral === 0 ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Faltan los conceptos de nómina.</AlertTitle>
          <AlertDescription>
            Revísalos en Configuración → Nómina →{" "}
            <a href="/dashboard/configuracion/nomina/conceptos" className="underline underline-offset-4">
              Conceptos
            </a>
            . Sin la semilla no hay mapeo que editar.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={segmento} onValueChange={(valor) => setSegmento(valor as SegmentoContable)}>
        <TabsList variant="line" className="h-auto w-full justify-start gap-1 overflow-x-auto border-b pb-0">
          {SEGMENTOS.map((opcion) => {
            const lista = filas[opcion.value];
            const completas = lista.filter(filaCompleta).length;
            return (
              <TabsTrigger key={opcion.value} value={opcion.value} className="h-9 shrink-0 px-3 after:bottom-0">
                {opcion.label}
                <span className="text-muted-foreground ml-1 text-xs tabular-nums">
                  {completas}/{lista.length}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[267px]">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por código o nombre…"
            aria-label="Buscar concepto en el mapeo"
            className="pl-8"
          />
        </div>
        <div className="w-full sm:w-56">
          <SelectCampo opciones={CLASES} valor={claseFiltro} onCambio={setClaseFiltro} aria-label="Filtrar por clase" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="mapeo-incompletos" checked={soloIncompletos} onCheckedChange={setSoloIncompletos} />
          <Label htmlFor="mapeo-incompletos" className="text-sm">
            Solo incompletos
          </Label>
        </div>
      </div>

      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Search className="size-3.5" aria-hidden="true" />
        {termino
          ? `${visibles.length} conceptos con “${busqueda.trim()}”`
          : `${visibles.length} conceptos en el segmento`}
      </div>

      <div className="flex flex-col gap-6">
        {GRUPOS.map((grupo) => {
          const delGrupo = visibles.filter((fila) => fila.clase === grupo.clase);
          if (delGrupo.length === 0) return null;

          return (
            <Seccion key={grupo.clase} titulo={grupo.titulo} cantidad={delGrupo.length}>
              <TarjetaLista>
                <TablaLista
                  columnas={columnas}
                  filas={delGrupo}
                  claveFila={(fila) => fila.concepto_id}
                  vacio={{ titulo: "Sin conceptos", filtrada: true }}
                />
              </TarjetaLista>
            </Seccion>
          );
        })}

        {visibles.length === 0 && totalGeneral > 0 ? (
          <EstadoVacioLista
            titulo="No hay conceptos con ese filtro."
            descripcion="Cambia la búsqueda o la clase para ver otros conceptos."
            filtrada
          />
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {puedeEditar ? (
        <FormActions className="border-border bg-background/95 sticky bottom-0 border-t py-3">
          <Button type="button" onClick={guardar} disabled={cambiadas.length === 0 || pendiente} className="h-11 px-6">
            {pendiente ? <Loader2 className="animate-spin" /> : null}
            {cambiadas.length === 0
              ? "Guardar cambios"
              : `Guardar ${cambiadas.length} ${cambiadas.length === 1 ? "cambio" : "cambios"}`}
          </Button>
        </FormActions>
      ) : null}
    </div>
  );
}
