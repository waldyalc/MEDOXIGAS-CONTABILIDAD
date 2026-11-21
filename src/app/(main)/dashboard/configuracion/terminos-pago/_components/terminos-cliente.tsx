"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FORM_INPUT } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { CalendarDays, Loader2, Plus } from "@/components/icons";
import { type ColumnaLista, PillEstado, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { crearTerminoPago } from "@/lib/configuracion/acciones";
import type { TerminoPago } from "@/lib/configuracion/tipos";
import { formatoEntero } from "@/lib/formato";
import { requerido } from "@/lib/formularios/validacion";

const columnas: readonly ColumnaLista<TerminoPago>[] = [
  {
    clave: "nombre",
    encabezado: "Nombre",
    celda: (termino) => <span className="font-medium">{termino.nombre}</span>,
  },
  {
    clave: "dias",
    encabezado: "Días",
    alineacion: "derecha",
    celda: (termino) => formatoEntero(termino.dias),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (termino) => (
      <PillEstado tono={termino.activo ? "exito" : "neutro"}>{termino.activo ? "Activo" : "Inactivo"}</PillEstado>
    ),
  },
];

function FormularioTermino({ onGuardado }: { readonly onGuardado: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const validacion = useValidacionFormulario();

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);

    if (
      !validacion.validar([
        requerido("nombre", datos.get("nombre"), "El nombre es requerido."),
        requerido("dias", datos.get("dias"), "Los días son requeridos."),
      ])
    ) {
      return;
    }

    iniciar(async () => {
      const resultado = await crearTerminoPago({
        nombre: String(datos.get("nombre") ?? ""),
        dias: String(datos.get("dias") ?? ""),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onGuardado();
    });
  }

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <CampoFormulario htmlFor="nombre" label="Nombre" required error={validacion.errorDe("nombre")}>
          <Input
            id="nombre"
            name="nombre"
            required
            maxLength={80}
            placeholder="Ej. 45 días"
            onChange={() => validacion.limpiar("nombre")}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="dias" label="Días" required error={validacion.errorDe("dias")}>
          <Input
            id="dias"
            name="dias"
            type="number"
            min={0}
            max={3650}
            step={1}
            required
            placeholder="0"
            onChange={() => validacion.limpiar("dias")}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" className="h-11 rounded-[12px] px-6" />}>
          Cancelar
        </DialogClose>
        <Button type="submit" disabled={pendiente} className="h-11 rounded-[12px] px-6">
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TerminosCliente({
  terminos,
  puedeCrear,
}: {
  readonly terminos: TerminoPago[];
  readonly puedeCrear: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  function cerrarTrasGuardar() {
    setAbierto(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">Los plazos que se podrán elegir en las facturas de venta.</p>
        {puedeCrear ? (
          <Button type="button" onClick={() => setAbierto(true)}>
            <Plus />
            Nuevo término
          </Button>
        ) : null}
      </div>

      <TarjetaLista data-lista="configuracion-terminos-pago">
        <TablaLista
          columnas={columnas}
          filas={terminos}
          claveFila={(termino) => termino.id}
          vacio={{
            titulo: "¡Aún no tienes términos de pago!",
            descripcion: "Crea el primero para elegir plazos en las facturas de venta.",
            icono: <CalendarDays className="size-10" />,
            accion: puedeCrear ? (
              <Button type="button" onClick={() => setAbierto(true)}>
                <Plus />
                Nuevo término
              </Button>
            ) : undefined,
          }}
        />
      </TarjetaLista>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo término de pago</DialogTitle>
          </DialogHeader>
          <FormularioTermino onGuardado={cerrarTrasGuardar} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
