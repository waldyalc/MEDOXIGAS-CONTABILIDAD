"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Coins, Loader2, Pencil, Plus } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FORM_INPUT, FORM_SELECT } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { type ColumnaLista, PillEstado, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hoyRD } from "@/lib/facturacion/formato";
import { requerido } from "@/lib/formularios/validacion";
import { guardarTasaCambio } from "@/lib/monedas/acciones";
import type { MonedaConTasa, TasaCambio } from "@/lib/monedas/tipos";

const formatoTasa = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 6 });

const formatoFecha = new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "2-digit", year: "numeric" });

function fechaVisible(fecha: string): string {
  return formatoFecha.format(new Date(`${fecha}T12:00:00`));
}

const columnasMonedas: readonly ColumnaLista<MonedaConTasa>[] = [
  {
    clave: "codigo",
    encabezado: "Código",
    celda: (moneda) => <span className="font-mono text-sm">{moneda.codigo}</span>,
  },
  {
    clave: "nombre",
    encabezado: "Nombre",
    celda: (moneda) => (
      <span className="inline-flex items-center gap-2 font-medium">
        {moneda.nombre}
        {moneda.es_base ? <PillEstado tono="neutro">Base</PillEstado> : null}
      </span>
    ),
  },
  {
    clave: "simbolo",
    encabezado: "Símbolo",
    celda: (moneda) => <span className="text-muted-foreground">{moneda.simbolo}</span>,
  },
  {
    clave: "ultimaTasa",
    encabezado: "Última tasa",
    alineacion: "derecha",
    celda: (moneda) => (moneda.ultimaTasa == null ? "—" : formatoTasa.format(moneda.ultimaTasa)),
  },
  {
    clave: "fechaTasa",
    encabezado: "Fecha de la tasa",
    celda: (moneda) => (
      <span className="text-muted-foreground">{moneda.ultimaFecha ? fechaVisible(moneda.ultimaFecha) : "—"}</span>
    ),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (moneda) => (
      <PillEstado tono={moneda.activo ? "exito" : "neutro"}>{moneda.activo ? "Activa" : "Inactiva"}</PillEstado>
    ),
  },
];

export function MonedasCliente({
  monedas,
  tasas,
  puedeEditar,
}: {
  readonly monedas: MonedaConTasa[];
  readonly tasas: TasaCambio[];
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [monedaCodigo, setMonedaCodigo] = useState("");
  const [fecha, setFecha] = useState(hoyRD());
  const [tasa, setTasa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const validacion = useValidacionFormulario();

  const editables = monedas.filter((moneda) => !moneda.es_base && moneda.activo);
  const opciones = editables.map((moneda) => ({
    value: moneda.codigo,
    label: `${moneda.codigo} · ${moneda.nombre}`,
  }));
  const nombres = new Map(monedas.map((moneda) => [moneda.codigo, moneda.nombre]));

  const columnasTasas: readonly ColumnaLista<TasaCambio>[] = [
    {
      clave: "moneda",
      encabezado: "Moneda",
      celda: (item) => (
        <span className="font-medium">
          {item.moneda_codigo} · {nombres.get(item.moneda_codigo) ?? ""}
        </span>
      ),
    },
    {
      clave: "fecha",
      encabezado: "Fecha",
      celda: (item) => fechaVisible(item.fecha),
    },
    {
      clave: "tasa",
      encabezado: "Tasa",
      alineacion: "derecha",
      celda: (item) => formatoTasa.format(item.tasa),
    },
  ];

  function abrirNueva() {
    setMonedaCodigo(editables[0]?.codigo ?? "");
    setFecha(hoyRD());
    setTasa("");
    setError(null);
    validacion.limpiarTodo();
    setAbierto(true);
  }

  function abrirEdicion(item: TasaCambio) {
    setMonedaCodigo(item.moneda_codigo);
    setFecha(item.fecha);
    setTasa(String(item.tasa));
    setError(null);
    validacion.limpiarTodo();
    setAbierto(true);
  }

  function enviar() {
    setError(null);

    if (
      !validacion.validar([
        requerido("tasa-moneda", monedaCodigo, "La moneda es requerida."),
        requerido("tasa-fecha", fecha, "La fecha es requerida."),
        requerido("tasa-valor", tasa, "La tasa es requerida."),
        {
          campo: "tasa-valor",
          invalido: !Number.isNaN(Number(tasa)) && tasa.trim() !== "" && Number(tasa) <= 0,
          mensaje: "La tasa debe ser mayor que cero.",
        },
      ])
    ) {
      return;
    }

    iniciar(async () => {
      const resultado = await guardarTasaCambio({ moneda_codigo: monedaCodigo, fecha, tasa });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          La moneda base es DOP. Las demás llevan una tasa editable por fecha; si repites la fecha, se corrige.
        </p>
        {puedeEditar ? (
          <Button type="button" onClick={abrirNueva}>
            <Plus />
            Registrar tasa
          </Button>
        ) : null}
      </div>

      <TarjetaLista data-lista="configuracion-monedas">
        <TablaLista
          columnas={columnasMonedas}
          filas={monedas}
          claveFila={(moneda) => moneda.codigo}
          vacio={{
            titulo: "Sin monedas",
            descripcion: "No hay monedas configuradas.",
            icono: <Coins className="size-10" />,
          }}
        />
      </TarjetaLista>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Historial de tasas</h2>
        <TarjetaLista data-lista="configuracion-tasas">
          <TablaLista
            columnas={columnasTasas}
            filas={tasas}
            claveFila={(item) => item.id}
            acciones={
              puedeEditar
                ? (item) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar tasa de ${item.moneda_codigo} del ${fechaVisible(item.fecha)}`}
                      onClick={() => abrirEdicion(item)}
                    >
                      <Pencil />
                    </Button>
                  )
                : undefined
            }
            vacio={{
              titulo: "Sin tasas de cambio",
              descripcion: "Todavía no hay tasas registradas.",
            }}
          />
        </TarjetaLista>
      </section>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar tasa de cambio</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <CampoFormulario htmlFor="tasa-moneda" label="Moneda" required error={validacion.errorDe("tasa-moneda")}>
              <Select
                items={opciones}
                value={monedaCodigo}
                onValueChange={(valor: string | null) => {
                  setMonedaCodigo(valor ?? "");
                  validacion.limpiar("tasa-moneda");
                }}
              >
                <SelectTrigger id="tasa-moneda" className={FORM_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {opciones.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CampoFormulario>
            <CampoFormulario htmlFor="tasa-fecha" label="Fecha" required error={validacion.errorDe("tasa-fecha")}>
              <DatePicker
                id="tasa-fecha"
                value={fecha}
                onChange={(valor) => {
                  setFecha(valor);
                  validacion.limpiar("tasa-fecha");
                }}
              />
            </CampoFormulario>
            <CampoFormulario htmlFor="tasa-valor" label="Tasa en DOP" required error={validacion.errorDe("tasa-valor")}>
              <Input
                id="tasa-valor"
                inputMode="decimal"
                value={tasa}
                onChange={(evento) => {
                  setTasa(evento.target.value);
                  validacion.limpiar("tasa-valor");
                }}
                placeholder="Ej. 58.50"
                disabled={pendiente}
                className={FORM_INPUT}
              />
            </CampoFormulario>

            {error ? (
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
              <Button type="button" onClick={enviar} disabled={pendiente} className="h-11 rounded-[12px] px-6">
                {pendiente ? <Loader2 className="animate-spin" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
