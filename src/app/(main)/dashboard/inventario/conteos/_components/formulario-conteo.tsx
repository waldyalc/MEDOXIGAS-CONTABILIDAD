"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DatePicker } from "@/components/date-picker";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import {
  FORM_BUTTON,
  FORM_SELECT,
  FORM_TEXTAREA,
  FormActions,
  FormCard,
  FormDivider,
  FormSectionTitle,
} from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { Loader2 } from "@/components/icons";
import { SelectCampo } from "@/components/select-campo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { requerido } from "@/lib/formularios/validacion";
import { crearConteo } from "@/lib/inventario/ferreteria/acciones";
import type { Almacen } from "@/lib/inventario/tipos";

import { EditorLineas } from "./editor-lineas";
import { cantidadACentavos, centavosADecimal, type LineaConteoFormulario } from "./tipos-conteo";

export function FormularioConteo({
  almacenes,
  almacenPorDefecto,
  fechaHoy,
}: {
  almacenes: Almacen[];
  almacenPorDefecto: string;
  fechaHoy: string;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  const [almacenId, setAlmacenId] = useState(almacenPorDefecto);
  const [fecha, setFecha] = useState(fechaHoy);
  const [notas, setNotas] = useState("");
  const [lineas, setLineas] = useState<LineaConteoFormulario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const validacion = useValidacionFormulario();

  const opcionesAlmacen = almacenes.map((almacen) => ({
    value: almacen.id,
    label: almacen.es_principal ? `${almacen.nombre} (principal)` : almacen.nombre,
  }));

  // La cantidad del sistema es de un almacén concreto: si ya hay líneas, el
  // almacén se bloquea para no mezclar existencias de dos almacenes.
  const almacenBloqueado = pendiente || lineas.length > 0;

  function guardar() {
    setError(null);

    const reglas = [
      requerido("almacen", almacenId, "Selecciona el almacén del conteo."),
      requerido("fecha", fecha, "La fecha es requerida."),
      {
        campo: "conteo-lineas",
        invalido: lineas.length === 0,
        mensaje: "Agrega al menos un producto al conteo.",
      },
      ...lineas.map((linea) => ({
        campo: `conteo-contada-${linea.producto_id}`,
        invalido: cantidadACentavos(linea.contada) === null,
        mensaje: "Escribe una cantidad de hasta 2 decimales (sin negativos).",
      })),
    ];

    if (!validacion.validar(reglas)) return;

    iniciar(async () => {
      const resultado = await crearConteo({
        almacen_id: almacenId,
        fecha,
        ...(notas.trim() ? { notas: notas.trim() } : {}),
        lineas: lineas.map((linea) => ({
          producto_id: linea.producto_id,
          cantidad_contada: centavosADecimal(cantidadACentavos(linea.contada) ?? 0),
          ...(linea.nota.trim() ? { notas: linea.nota.trim() } : {}),
        })),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      toast.add({ type: "success", title: "Conteo creado en borrador" });
      router.push(`/dashboard/inventario/conteos/${resultado.id}`);
    });
  }

  return (
    <form
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar();
      }}
      className="flex w-full flex-col gap-6"
    >
      <FormCard>
        <section>
          <FormSectionTitle
            className="mb-4"
            descripcion="Elige el almacén y la fecha; después agrega los productos que vas a contar."
          >
            Datos del conteo
          </FormSectionTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <CampoFormulario htmlFor="almacen" label="Almacén" required error={validacion.errorDe("almacen")}>
              <SelectCampo
                id="almacen"
                opciones={opcionesAlmacen}
                valor={almacenId}
                onCambio={(valor) => {
                  setAlmacenId(valor);
                  validacion.limpiar("almacen");
                }}
                etiquetaVacia="Selecciona un almacén…"
                requerido
                deshabilitado={almacenBloqueado}
                className={FORM_SELECT}
                aria-label="Almacén del conteo"
              />
            </CampoFormulario>

            <CampoFormulario htmlFor="fecha" label="Fecha" required error={validacion.errorDe("fecha")}>
              <DatePicker
                id="fecha"
                value={fecha}
                onChange={(valor) => {
                  setFecha(valor);
                  validacion.limpiar("fecha");
                }}
                aria-invalid={Boolean(validacion.errorDe("fecha"))}
              />
            </CampoFormulario>

            <CampoFormulario htmlFor="notas" label="Notas" className="sm:col-span-2">
              <Textarea
                id="notas"
                placeholder="Ej. Conteo físico de cierre de mes en el almacén principal"
                value={notas}
                onChange={(evento) => setNotas(evento.target.value)}
                maxLength={2000}
                className={FORM_TEXTAREA}
              />
            </CampoFormulario>
          </div>

          {lineas.length > 0 ? (
            <p className="text-muted-foreground mt-3 text-xs">
              Para cambiar de almacén, quita las líneas del conteo: la cantidad del sistema es de un almacén a la vez.
            </p>
          ) : null}
        </section>

        <FormDivider />

        <section>
          <EditorLineas
            almacenId={almacenId}
            lineas={lineas}
            onCambiar={setLineas}
            deshabilitado={pendiente}
            errores={validacion.errores}
            onLimpiarError={validacion.limpiar}
          />
          {validacion.errorDe("conteo-lineas") ? (
            <p role="alert" className="text-destructive mt-2 text-xs">
              {validacion.errorDe("conteo-lineas")}
            </p>
          ) : null}
        </section>
      </FormCard>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormActions>
        <Button
          type="button"
          variant="outline"
          className={FORM_BUTTON}
          nativeButton={false}
          render={<Link href="/dashboard/inventario/conteos" />}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente || almacenes.length === 0} className={FORM_BUTTON}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar borrador
        </Button>
      </FormActions>

      {almacenes.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay almacenes activos. Crea uno en Inventario → Almacenes antes de hacer un conteo.
        </p>
      ) : null}
    </form>
  );
}
