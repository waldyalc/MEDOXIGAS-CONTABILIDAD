"use client";

import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";

import { Loader2 } from "lucide-react";

import { FORM_INPUT, FORM_INPUT_GROUP, FORM_SELECT, FormField } from "@/components/formularios/formulario";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearProducto } from "@/lib/productos/actions";
import { normalizarNombre, type ProductoTipo, parsearMonto } from "@/lib/productos/productos";

export interface ProductoSeleccionable {
  id: string;
  nombre: string;
  referencia?: string | null;
  precio: number;
  costo?: number;
  itbis_tasa: number;
  impuesto_id?: string | null;
  precios?: { lista_id: string; precio: number }[];
}

interface Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  nombreInicial?: string;
  onCreado: (producto: ProductoSeleccionable) => void;
}

const OPCIONES_ITBIS = [
  { value: "18", label: "ITBIS 18 %" },
  { value: "16", label: "ITBIS 16 %" },
  { value: "0", label: "ITBIS 0 %" },
];

const OPCIONES_TIPO = [
  { value: "producto", label: "Producto" },
  { value: "servicio", label: "Servicio" },
];

export function DialogoNuevoProducto({ abierto, onOpenChange, nombreInicial = "", onCreado }: Props) {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("0.00");
  const [itbisTasa, setItbisTasa] = useState("18");
  const [tipo, setTipo] = useState<ProductoTipo>("producto");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const estabaAbierto = useRef(false);

  useEffect(() => {
    if (abierto && !estabaAbierto.current) {
      setNombre(nombreInicial);
      setPrecio("0.00");
      setItbisTasa("18");
      setTipo("producto");
      setError(null);
    }
    estabaAbierto.current = abierto;
  }, [abierto, nombreInicial]);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    if (normalizarNombre(nombre) === "") {
      setError("El nombre del producto es obligatorio.");
      return;
    }

    const precioNumero = parsearMonto(precio);
    if (precioNumero === null) {
      setError("El precio no es válido.");
      return;
    }

    const formData = new FormData();
    formData.set("nombre", nombre);
    formData.set("precio", precio);
    formData.set("itbis_tasa", itbisTasa);
    formData.set("tipo", tipo);

    iniciar(async () => {
      const resultado = await crearProducto(formData);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      if (!resultado.id) {
        setError("El producto se creó, pero no se pudo seleccionar. Búscalo en la lista.");
        return;
      }

      onCreado({
        id: resultado.id,
        nombre: normalizarNombre(nombre),
        referencia: null,
        precio: precioNumero,
        itbis_tasa: Number(itbisTasa),
        precios: [],
      });
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nuevo producto</DialogTitle>
        </DialogHeader>

        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <FormField htmlFor="producto-rapido-nombre" label="Nombre" required>
              <Input
                id="producto-rapido-nombre"
                required
                maxLength={200}
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                className={FORM_INPUT}
              />
            </FormField>

            <FormField htmlFor="producto-rapido-precio" label="Precio" required>
              <InputGroup className={FORM_INPUT_GROUP}>
                <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                  RD$
                </InputGroupAddon>
                <InputGroupInput
                  id="producto-rapido-precio"
                  inputMode="decimal"
                  value={precio}
                  onChange={(evento) => setPrecio(evento.target.value)}
                  className="pl-1"
                />
              </InputGroup>
            </FormField>

            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <FormField htmlFor="producto-rapido-itbis" label="ITBIS">
                <Select
                  items={OPCIONES_ITBIS}
                  value={itbisTasa}
                  onValueChange={(valor: string | null) => setItbisTasa(valor ?? "18")}
                >
                  <SelectTrigger id="producto-rapido-itbis" className={FORM_SELECT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {OPCIONES_ITBIS.map((opcion) => (
                      <SelectItem key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField htmlFor="producto-rapido-tipo" label="Tipo">
                <Select
                  items={OPCIONES_TIPO}
                  value={tipo}
                  onValueChange={(valor: string | null) => {
                    if (valor === "producto" || valor === "servicio") setTipo(valor);
                  }}
                >
                  <SelectTrigger id="producto-rapido-tipo" className={FORM_SELECT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {OPCIONES_TIPO.map((opcion) => (
                      <SelectItem key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-[12px] px-6"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente} className="h-11 rounded-[12px] px-6">
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              Crear producto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
