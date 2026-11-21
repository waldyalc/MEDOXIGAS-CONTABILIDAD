"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FORM_INPUT } from "@/components/formularios/formulario";
import { Check, InfoIcon, Loader2, Minus, Pencil, Plus, Search, ShieldAlert } from "@/components/icons";
import { type ColumnaLista, PillEstado, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { type OpcionSelect, SelectCampo } from "@/components/select-campo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import type { ClaseConcepto, ConceptoNomina } from "@/lib/nomina/tipos";

import { actualizarConcepto, crearConcepto } from "../../_datos/acciones-conceptos";
import { conceptoSchema, etiquetaClaseConcepto } from "../../_datos/concepto";

const CLASES: readonly OpcionSelect[] = [
  { value: "ingreso", label: "Ingreso" },
  { value: "deduccion", label: "Deducción" },
  { value: "aporte_empleador", label: "Aporte patronal" },
  { value: "provision", label: "Provisión" },
];

const FILTROS: readonly { value: ClaseConcepto | "todas"; label: string }[] = [
  { value: "todas", label: "Todos" },
  { value: "ingreso", label: "Ingresos" },
  { value: "deduccion", label: "Deducciones" },
  { value: "aporte_empleador", label: "Aportes" },
  { value: "provision", label: "Provisiones" },
];

interface FormularioConcepto {
  codigo: string;
  nombre: string;
  clase: ClaseConcepto;
  grava_tss: boolean;
  grava_isr: boolean;
  grava_infotep: boolean;
  orden: string;
  activo: boolean;
}

function formularioNuevo(): FormularioConcepto {
  return {
    codigo: "",
    nombre: "",
    clase: "ingreso",
    grava_tss: false,
    grava_isr: false,
    grava_infotep: false,
    orden: "100",
    activo: true,
  };
}

function formularioDesde(concepto: ConceptoNomina): FormularioConcepto {
  return {
    codigo: concepto.codigo,
    nombre: concepto.nombre,
    clase: concepto.clase,
    grava_tss: concepto.grava_tss,
    grava_isr: concepto.grava_isr,
    grava_infotep: concepto.grava_infotep,
    orden: String(concepto.orden),
    activo: concepto.activo,
  };
}

function Marca({ activo, etiqueta }: { activo: boolean; etiqueta: string }) {
  return (
    <span className="inline-flex justify-center">
      {activo ? (
        <Check className="text-primary size-4" aria-hidden="true" />
      ) : (
        <Minus className="text-muted-foreground size-4" aria-hidden="true" />
      )}
      <span className="sr-only">{`${etiqueta}: ${activo ? "sí" : "no"}`}</span>
    </span>
  );
}

export function ConceptosCliente({
  conceptos,
  puedeEditar,
}: {
  readonly conceptos: readonly ConceptoNomina[];
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<ClaseConcepto | "todas">("todas");
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<ConceptoNomina | null>(null);
  const [formulario, setFormulario] = useState<FormularioConcepto>(() => formularioNuevo());
  const [error, setError] = useState<string | null>(null);
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function abrirNuevo() {
    setEditando(null);
    setFormulario(formularioNuevo());
    setError(null);
    setErrorCampo(null);
    setAbierto(true);
  }

  function abrirEditar(concepto: ConceptoNomina) {
    setEditando(concepto);
    setFormulario(formularioDesde(concepto));
    setError(null);
    setErrorCampo(null);
    setAbierto(true);
  }

  function cambiarAbierto(abrir: boolean) {
    setAbierto(abrir);
    if (!abrir) {
      setEditando(null);
      setError(null);
      setErrorCampo(null);
    }
  }

  function cambiar<K extends keyof FormularioConcepto>(campo: K, valor: FormularioConcepto[K]) {
    setFormulario((previo) => {
      const siguiente = { ...previo, [campo]: valor };
      if (campo === "clase" && valor !== "ingreso") {
        siguiente.grava_tss = false;
        siguiente.grava_isr = false;
        siguiente.grava_infotep = false;
      }
      return siguiente;
    });
    if (errorCampo === campo) {
      setErrorCampo(null);
      setError(null);
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setErrorCampo(null);

    const entrada = {
      codigo: formulario.codigo,
      nombre: formulario.nombre,
      clase: formulario.clase,
      grava_tss: formulario.clase === "ingreso" ? formulario.grava_tss : false,
      grava_isr: formulario.clase === "ingreso" ? formulario.grava_isr : false,
      grava_infotep: formulario.clase === "ingreso" ? formulario.grava_infotep : false,
      orden: formulario.orden,
      activo: formulario.activo,
    };

    const validado = conceptoSchema.safeParse(entrada);
    if (!validado.success) {
      const problema = validado.error.issues[0];
      const campo = problema?.path[0];
      setError(problema?.message ?? "Revisa los datos del concepto.");
      setErrorCampo(campo === "codigo" || campo === "nombre" || campo === "orden" ? campo : null);
      return;
    }

    iniciar(async () => {
      const resultado = editando ? await actualizarConcepto(editando.id, entrada) : await crearConcepto(entrada);

      if (!resultado.ok) {
        setError(resultado.error ?? "No se pudo guardar el concepto.");
        setErrorCampo(resultado.campo ?? null);
        return;
      }

      setAbierto(false);
      setEditando(null);
      toast.add({
        type: "success",
        title: editando ? "Concepto actualizado." : "Concepto creado.",
        description: formulario.nombre.trim(),
      });
      router.refresh();
    });
  }

  const esSistema = editando?.es_sistema ?? false;
  const termino = busqueda.trim().toLowerCase();
  const visibles = conceptos.filter((concepto) => {
    if (filtro !== "todas" && concepto.clase !== filtro) return false;
    if (!termino) return true;
    return concepto.codigo.toLowerCase().includes(termino) || concepto.nombre.toLowerCase().includes(termino);
  });

  const hayFiltro = filtro !== "todas" || termino !== "";

  const columnas: readonly ColumnaLista<ConceptoNomina>[] = [
    {
      clave: "codigo",
      encabezado: "Código",
      celda: (concepto) => <span className="font-mono text-sm">{concepto.codigo}</span>,
    },
    {
      clave: "nombre",
      encabezado: "Nombre",
      celda: (concepto) => <span className="font-medium">{concepto.nombre}</span>,
    },
    {
      clave: "clase",
      encabezado: "Clase",
      className: "hidden lg:table-cell",
      celda: (concepto) => etiquetaClaseConcepto(concepto.clase),
    },
    {
      clave: "tss",
      encabezado: "TSS",
      alineacion: "centro",
      celda: (concepto) => <Marca activo={concepto.grava_tss} etiqueta="Grava TSS" />,
    },
    {
      clave: "isr",
      encabezado: "ISR",
      alineacion: "centro",
      celda: (concepto) => <Marca activo={concepto.grava_isr} etiqueta="Grava ISR" />,
    },
    {
      clave: "infotep",
      encabezado: "INFOTEP",
      alineacion: "centro",
      celda: (concepto) => <Marca activo={concepto.grava_infotep} etiqueta="Grava INFOTEP" />,
    },
    {
      clave: "origen",
      encabezado: "Origen",
      celda: (concepto) => (
        <PillEstado tono={concepto.es_sistema ? "neutro" : "info"}>
          {concepto.es_sistema ? "Sistema" : "Personalizado"}
        </PillEstado>
      ),
    },
    {
      clave: "orden",
      encabezado: "Orden",
      alineacion: "derecha",
      className: "hidden sm:table-cell",
      celda: (concepto) => <span className="tabular-nums">{concepto.orden}</span>,
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (concepto) => (
        <PillEstado tono={concepto.activo ? "exito" : "neutro"}>{concepto.activo ? "Activo" : "Inactivo"}</PillEstado>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="relative w-full sm:w-[267px]">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por código o nombre…"
            aria-label="Buscar concepto"
            className="pl-8"
          />
        </div>
        {puedeEditar ? (
          <Button type="button" onClick={abrirNuevo}>
            <Plus />
            Nuevo concepto
          </Button>
        ) : null}
      </div>

      <Tabs value={filtro} onValueChange={(valor) => setFiltro(valor as ClaseConcepto | "todas")}>
        <TabsList variant="line" className="h-auto w-full justify-start gap-1 overflow-x-auto border-b pb-0">
          {FILTROS.map((opcion) => {
            const cantidad =
              opcion.value === "todas"
                ? conceptos.length
                : conceptos.filter((concepto) => concepto.clase === opcion.value).length;
            return (
              <TabsTrigger key={opcion.value} value={opcion.value} className="h-9 shrink-0 px-3 after:bottom-0">
                {opcion.label}
                <span className="text-muted-foreground ml-1 text-xs tabular-nums">{cantidad}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <TarjetaLista data-lista="nomina-conceptos">
        <TablaLista
          columnas={columnas}
          filas={visibles}
          claveFila={(concepto) => concepto.id}
          acciones={
            puedeEditar
              ? (concepto) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${concepto.nombre}`}
                    onClick={() => abrirEditar(concepto)}
                  >
                    <Pencil />
                  </Button>
                )
              : undefined
          }
          vacio={
            hayFiltro
              ? {
                  titulo: "No hay conceptos que coincidan.",
                  descripcion: "Cambia la búsqueda o la clase para ver otros conceptos.",
                  filtrada: true,
                }
              : {
                  titulo: "Aún no hay conceptos de nómina.",
                  descripcion: "Crea el primero para usarlo en el mapeo contable.",
                  icono: <ShieldAlert className="size-10" />,
                  accion: puedeEditar ? (
                    <Button type="button" onClick={abrirNuevo}>
                      <Plus />
                      Nuevo concepto
                    </Button>
                  ) : undefined,
                }
          }
        />
      </TarjetaLista>

      <Dialog open={abierto} onOpenChange={cambiarAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar concepto" : "Nuevo concepto"}</DialogTitle>
          </DialogHeader>

          <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
            {esSistema ? (
              <Alert>
                <InfoIcon aria-hidden="true" />
                <AlertDescription>Concepto del sistema: solo puedes cambiar el nombre y el orden.</AlertDescription>
              </Alert>
            ) : null}

            <CampoFormulario
              htmlFor="concepto-codigo"
              label="Código"
              required
              error={errorCampo === "codigo" ? (error ?? undefined) : undefined}
            >
              <Input
                id="concepto-codigo"
                value={formulario.codigo}
                onChange={(evento) => cambiar("codigo", evento.target.value.toUpperCase())}
                maxLength={40}
                autoComplete="off"
                disabled={pendiente || editando !== null}
                required
                className={FORM_INPUT}
                placeholder="Ej. BONO_VENTAS"
              />
              <p className="text-muted-foreground text-xs">Mayúsculas, sin espacios. No se puede cambiar después.</p>
            </CampoFormulario>

            <CampoFormulario
              htmlFor="concepto-nombre"
              label="Nombre"
              required
              error={errorCampo === "nombre" ? (error ?? undefined) : undefined}
            >
              <Input
                id="concepto-nombre"
                value={formulario.nombre}
                onChange={(evento) => cambiar("nombre", evento.target.value)}
                maxLength={120}
                disabled={pendiente}
                required
                className={FORM_INPUT}
                placeholder="Ej. Bono de ventas"
              />
            </CampoFormulario>

            <CampoFormulario htmlFor="concepto-clase" label="Clase" required>
              <SelectCampo
                id="concepto-clase"
                opciones={CLASES}
                valor={formulario.clase}
                onCambio={(valor) => cambiar("clase", valor as ClaseConcepto)}
                deshabilitado={pendiente || esSistema}
              />
            </CampoFormulario>

            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Bases de ley</p>
              <p className="text-muted-foreground text-xs">Solo un ingreso puede entrar en las bases.</p>
              {(
                [
                  { campo: "grava_tss", etiqueta: "Grava TSS", valor: formulario.grava_tss },
                  { campo: "grava_isr", etiqueta: "Grava ISR", valor: formulario.grava_isr },
                  { campo: "grava_infotep", etiqueta: "Grava INFOTEP", valor: formulario.grava_infotep },
                ] as const
              ).map((opcion) => (
                <div key={opcion.campo} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`concepto-${opcion.campo}`}>{opcion.etiqueta}</Label>
                  <Switch
                    id={`concepto-${opcion.campo}`}
                    checked={opcion.valor}
                    onCheckedChange={(valor) => cambiar(opcion.campo, valor)}
                    disabled={pendiente || esSistema || formulario.clase !== "ingreso"}
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CampoFormulario
                htmlFor="concepto-orden"
                label="Orden"
                error={errorCampo === "orden" ? (error ?? undefined) : undefined}
              >
                <Input
                  id="concepto-orden"
                  value={formulario.orden}
                  onChange={(evento) => cambiar("orden", evento.target.value)}
                  inputMode="numeric"
                  disabled={pendiente}
                  className={FORM_INPUT}
                />
              </CampoFormulario>

              <div className="flex items-center justify-between gap-3 self-end pb-2">
                <Label htmlFor="concepto-activo">Activo</Label>
                <Switch
                  id="concepto-activo"
                  checked={formulario.activo}
                  onCheckedChange={(valor) => cambiar("activo", valor)}
                  disabled={pendiente || esSistema}
                />
              </div>
            </div>

            {error && errorCampo == null ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline" disabled={pendiente} className="h-11 rounded-[12px] px-6" />
                }
              >
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={pendiente} className="h-11 rounded-[12px] px-6">
                {pendiente ? <Loader2 className="animate-spin" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
