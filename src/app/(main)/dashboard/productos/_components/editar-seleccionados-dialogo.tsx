"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { FORM_INPUT_GROUP, FORM_SELECT, FormField } from "@/components/formularios/formulario";
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
import { type CambiosEdicionMasiva, calcularEdicionMasiva } from "@/lib/productos/importar";
import { type Producto, SIN_CATEGORIA, TASAS_ITBIS } from "@/lib/productos/productos";

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
  }

  function cambiarAbierto(valor: boolean) {
    onCambiarAbierto(valor);
    if (!valor) reiniciar();
  }

  function aplicar() {
    setError(null);

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
          <FormField htmlFor="precio-modo" label="Precio">
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
          </FormField>

          {precioModo === "fijo" ? (
            <FormField htmlFor="precio-fijo" label="Precio fijo">
              <InputGroup className={FORM_INPUT_GROUP}>
                <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                  RD$
                </InputGroupAddon>
                <InputGroupInput
                  id="precio-fijo"
                  inputMode="decimal"
                  value={precioFijo}
                  onChange={(evento) => setPrecioFijo(evento.target.value)}
                  placeholder="0"
                />
              </InputGroup>
            </FormField>
          ) : null}

          {precioModo === "porcentaje" ? (
            <FormField htmlFor="porcentaje" label="Ajuste">
              <InputGroup className={FORM_INPUT_GROUP}>
                <InputGroupInput
                  id="porcentaje"
                  inputMode="decimal"
                  value={porcentaje}
                  onChange={(evento) => setPorcentaje(evento.target.value)}
                  placeholder="Ej. -10 o +15"
                />
                <InputGroupAddon align="inline-end" className="pr-2 pl-0 text-sm text-slate-500">
                  %
                </InputGroupAddon>
              </InputGroup>
            </FormField>
          ) : null}

          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <FormField htmlFor="itbis-masivo" label="ITBIS">
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
            </FormField>

            <FormField htmlFor="estado-masivo" label="Estado">
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
            </FormField>
          </div>

          <FormField htmlFor="categoria-masiva" label="Categoría">
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
          </FormField>

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
