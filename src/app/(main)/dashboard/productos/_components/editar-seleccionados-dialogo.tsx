"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FORM_INPUT_GROUP, FORM_SELECT } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CategoriaProducto } from "@/lib/inventario/tipos";
import { actualizarProducto } from "@/lib/productos/actions";
import { type CambiosEdicionMasiva, calcularEdicionMasiva, parsearPorcentaje } from "@/lib/productos/importar";
import { type Producto, parsearMonto, SIN_CATEGORIA, TASAS_ITBIS } from "@/lib/productos/productos";

import { formDataProducto } from "./form-data-producto";

const OPCIONES_PRECIO = [
  { value: "sin_cambio", label: "Sin cambio" },
  { value: "fijo", label: "Fijar un precio" },
  { value: "porcentaje", label: "Ajustar por porcentaje" },
];

const OPCIONES_ITBIS = [
  { value: "", label: "Sin cambio" },
  ...TASAS_ITBIS.map((tasa) => ({ value: String(tasa.valor), label: tasa.etiqueta })),
];

const OPCIONES_ESTADO = [
  { value: "", label: "Sin cambio" },
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

interface ResumenEdicion {
  actualizados: number;
  fallos: { nombre: string; error: string }[];
}

export function EditarSeleccionadosDialogo({
  abierto,
  productos,
  categorias,
  onCambiarAbierto,
  onTerminado,
}: {
  readonly abierto: boolean;
  readonly productos: Producto[];
  readonly categorias: CategoriaProducto[];
  readonly onCambiarAbierto: (abierto: boolean) => void;
  readonly onTerminado: () => void;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [precioModo, setPrecioModo] = useState<CambiosEdicionMasiva["precioModo"]>("sin_cambio");
  const [precioFijo, setPrecioFijo] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [itbisTasa, setItbisTasa] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [activo, setActivo] = useState<CambiosEdicionMasiva["activo"]>("");
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenEdicion | null>(null);
  const validacion = useValidacionFormulario();

  const opcionesCategoria = [
    { value: "", label: "Sin cambio" },
    { value: SIN_CATEGORIA, label: "Sin categoría" },
    ...categorias.map((categoria) => ({ value: categoria.id, label: categoria.nombre })),
  ];

  function reiniciar() {
    setPrecioModo("sin_cambio");
    setPrecioFijo("");
    setPorcentaje("");
    setItbisTasa("");
    setCategoriaId("");
    setActivo("");
    setError(null);
    setResumen(null);
    validacion.limpiarTodo();
  }

  function cambiarAbierto(valor: boolean) {
    onCambiarAbierto(valor);
    if (!valor) reiniciar();
  }

  function aplicar() {
    setError(null);

    if (
      !validacion.validar([
        {
          campo: "precio-fijo",
          invalido: precioModo === "fijo" && parsearMonto(precioFijo) === null,
          mensaje: "Escribe un precio fijo válido.",
        },
        {
          campo: "porcentaje",
          invalido: precioModo === "porcentaje" && parsearPorcentaje(porcentaje) === null,
          mensaje: "Escribe un porcentaje válido (puede ser negativo).",
        },
      ])
    ) {
      return;
    }

    const calculo = calcularEdicionMasiva(productos, {
      precioModo,
      precioFijo,
      porcentaje,
      itbisTasa,
      categoriaId,
      activo,
    });

    if (calculo.error !== null) {
      setError(calculo.error);
      return;
    }

    startTransition(async () => {
      let actualizados = 0;
      const fallos: { nombre: string; error: string }[] = [];

      for (const fila of calculo.filas) {
        const respuesta = await actualizarProducto(fila.producto.id, formDataProducto(fila.datos));
        if (respuesta.ok) {
          actualizados++;
        } else {
          fallos.push({ nombre: fila.producto.nombre, error: respuesta.error });
        }
      }

      setResumen({ actualizados, fallos });
      router.refresh();

      if (fallos.length === 0) onTerminado();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar seleccionados</DialogTitle>
          <DialogDescription>
            Se aplicarán los cambios a {productos.length} {productos.length === 1 ? "producto" : "productos"}. Deja en
            «Sin cambio» lo que no quieras modificar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <CampoFormulario htmlFor="precio-modo" label="Precio">
            <Select
              value={precioModo}
              onValueChange={(valor) => setPrecioModo((valor as CambiosEdicionMasiva["precioModo"]) ?? "sin_cambio")}
              items={OPCIONES_PRECIO}
            >
              <SelectTrigger id="precio-modo" className={FORM_SELECT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCIONES_PRECIO.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CampoFormulario>

          {precioModo === "fijo" ? (
            <CampoFormulario htmlFor="precio-fijo" label="Precio fijo" error={validacion.errorDe("precio-fijo")}>
              <InputGroup className={FORM_INPUT_GROUP}>
                <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                  RD$
                </InputGroupAddon>
                <InputGroupInput
                  id="precio-fijo"
                  inputMode="decimal"
                  value={precioFijo}
                  onChange={(evento) => {
                    setPrecioFijo(evento.target.value);
                    validacion.limpiar("precio-fijo");
                  }}
                  placeholder="0"
                />
              </InputGroup>
            </CampoFormulario>
          ) : null}

          {precioModo === "porcentaje" ? (
            <CampoFormulario htmlFor="porcentaje" label="Ajuste" error={validacion.errorDe("porcentaje")}>
              <InputGroup className={FORM_INPUT_GROUP}>
                <InputGroupInput
                  id="porcentaje"
                  inputMode="decimal"
                  value={porcentaje}
                  onChange={(evento) => {
                    setPorcentaje(evento.target.value);
                    validacion.limpiar("porcentaje");
                  }}
                  placeholder="Ej. -10 o +15"
                />
                <InputGroupAddon align="inline-end" className="pr-2 pl-0 text-sm text-slate-500">
                  %
                </InputGroupAddon>
              </InputGroup>
            </CampoFormulario>
          ) : null}

          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <CampoFormulario htmlFor="itbis-masivo" label="ITBIS">
              <Select value={itbisTasa} onValueChange={(valor) => setItbisTasa(valor ?? "")} items={OPCIONES_ITBIS}>
                <SelectTrigger id="itbis-masivo" className={FORM_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCIONES_ITBIS.map((opcion) => (
                    <SelectItem key={opcion.value || "sin-cambio"} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CampoFormulario>

            <CampoFormulario htmlFor="estado-masivo" label="Estado">
              <Select
                value={activo}
                onValueChange={(valor) => setActivo((valor as CambiosEdicionMasiva["activo"]) ?? "")}
                items={OPCIONES_ESTADO}
              >
                <SelectTrigger id="estado-masivo" className={FORM_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCIONES_ESTADO.map((opcion) => (
                    <SelectItem key={opcion.value || "sin-cambio"} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CampoFormulario>
          </div>

          <CampoFormulario htmlFor="categoria-masiva" label="Categoría">
            <Select
              value={categoriaId}
              onValueChange={(valor) => setCategoriaId(valor ?? "")}
              items={opcionesCategoria}
            >
              <SelectTrigger id="categoria-masiva" className={FORM_SELECT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opcionesCategoria.map((opcion) => (
                  <SelectItem key={opcion.value || "sin-cambio"} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CampoFormulario>

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          {resumen ? (
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-medium">
                {resumen.actualizados > 0
                  ? `Se actualizaron ${resumen.actualizados} productos.`
                  : "No se pudo actualizar ningún producto."}
              </p>
              {resumen.fallos.length > 0 ? (
                <ul className="text-destructive list-inside list-disc text-xs">
                  {resumen.fallos.map((fallo) => (
                    <li key={fallo.nombre}>
                      {fallo.nombre}: {fallo.error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => cambiarAbierto(false)}
            className="h-11 rounded-[12px] px-6"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={aplicar}
            disabled={pendiente || productos.length === 0 || resumen !== null}
            className="h-11 rounded-[12px] px-6"
          >
            {pendiente ? "Aplicando..." : "Aplicar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
