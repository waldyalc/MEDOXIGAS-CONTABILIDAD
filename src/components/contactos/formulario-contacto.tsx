"use client";

import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";

import { ChevronDown } from "lucide-react";

import {
  FORM_INPUT,
  FORM_INPUT_GROUP,
  FORM_SELECT,
  FORM_TEXTAREA,
  FormField,
} from "@/components/formularios/formulario";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { actualizarContacto, crearContacto } from "@/lib/contactos/actions";
import { type Contacto, type ContactoTipo, SIN_LISTA_PRECIO, TIPOS_CONTACTO } from "@/lib/contactos/contactos";
import { completarConDatosDgii } from "@/lib/dgii/completar";
import type { DatosContribuyenteDgii } from "@/lib/dgii/consulta";
import type { ListaPrecio } from "@/lib/inventario/tipos";

import { BotonAutocompletarDgii, MensajeDgii, tipoDocumentoDesde, useConsultaDgii } from "./consulta-dgii";

const OPCIONES_TIPO = TIPOS_CONTACTO.map((tipo) => ({ value: tipo.valor, label: tipo.etiqueta }));
const SIN_LISTA = SIN_LISTA_PRECIO;

function tieneOpcionales(contacto: Contacto | null) {
  if (contacto === null) return false;
  return Boolean(contacto.telefono ?? contacto.correo ?? contacto.direccion);
}

export function FormularioContacto({
  contacto,
  listasPrecios,
  onGuardado,
}: {
  readonly contacto: Contacto | null;
  readonly listasPrecios: ListaPrecio[];
  readonly onGuardado: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [nombre, setNombre] = useState(contacto?.nombre ?? "");
  const [rncCedula, setRncCedula] = useState(contacto?.rnc_cedula ?? "");
  const [tipo, setTipo] = useState<ContactoTipo>(contacto?.tipo ?? "cliente");
  const { cargando, mensaje, consultar, limpiar } = useConsultaDgii();
  const autoRellenado = useRef({ nombre: "" });
  const valores = useRef({ nombre: "" });

  useEffect(() => {
    valores.current = { nombre };
  }, [nombre]);

  const opcionesLista = [
    { value: SIN_LISTA, label: "Sin lista (precio del producto)" },
    ...listasPrecios.map((lista) => ({
      value: lista.id,
      label: `${lista.nombre}${lista.es_principal ? " (principal)" : ""}`,
    })),
  ];

  function completarConDgii(datos: DatosContribuyenteDgii): string {
    const { campos, mensaje: texto } = completarConDatosDgii(datos, valores.current, autoRellenado.current);
    if (campos.nombre !== undefined) setNombre(campos.nombre);
    Object.assign(valores.current, campos);
    Object.assign(autoRellenado.current, campos);
    return texto;
  }

  function consultarEnDgii(automatica: boolean) {
    if (contacto?.tipo_identificacion === "pasaporte") return;

    const digitos = rncCedula.replace(/\D/g, "");
    const tipo = tipoDocumentoDesde(digitos);
    if (automatica && tipo === null) return;

    void consultar(digitos, tipo ?? (digitos.length > 9 ? "cedula" : "rnc"), completarConDgii);
  }

  function cambiarTipo(valor: string | null) {
    if (valor === "cliente" || valor === "proveedor" || valor === "ambos") setTipo(valor);
  }

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const resultado = contacto ? await actualizarContacto(contacto.id, formData) : await crearContacto(formData);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onGuardado();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="tipo_identificacion" value={contacto?.tipo_identificacion ?? ""} />
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <FormField htmlFor="nombre" label="Nombre" required className="sm:col-span-2">
          <Input
            id="nombre"
            name="nombre"
            required
            maxLength={200}
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            className={FORM_INPUT}
          />
        </FormField>

        <FormField htmlFor="tipo" label="Tipo">
          <Select
            name="tipo"
            defaultValue={contacto?.tipo ?? "cliente"}
            items={OPCIONES_TIPO}
            onValueChange={cambiarTipo}
          >
            <SelectTrigger id="tipo" className={FORM_SELECT}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCIONES_TIPO.map((tipo) => (
                <SelectItem key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField htmlFor="rnc_cedula" label="RNC / Cédula">
          <Input
            id="rnc_cedula"
            name="rnc_cedula"
            inputMode="numeric"
            placeholder="131123456"
            value={rncCedula}
            onChange={(event) => {
              setRncCedula(event.target.value);
              limpiar();
            }}
            onBlur={() => consultarEnDgii(true)}
            className={FORM_INPUT}
          />
          <div className="mt-1">
            <BotonAutocompletarDgii
              onClick={() => consultarEnDgii(false)}
              cargando={cargando}
              disabled={contacto?.tipo_identificacion === "pasaporte"}
            />
          </div>
          <MensajeDgii mensaje={mensaje} />
        </FormField>

        {tipo === "cliente" || tipo === "ambos" ? (
          <FormField htmlFor="limite_credito" label="Límite de crédito">
            <InputGroup className={FORM_INPUT_GROUP}>
              <InputGroupAddon align="inline-start">RD$</InputGroupAddon>
              <InputGroupInput
                id="limite_credito"
                name="limite_credito"
                inputMode="decimal"
                placeholder="Sin límite"
                defaultValue={contacto?.limite_credito == null ? "" : String(contacto.limite_credito)}
                className="h-full min-w-0 pl-1 tabular-nums"
              />
            </InputGroup>
          </FormField>
        ) : null}

        <Collapsible
          className="rounded-xl border border-slate-200 sm:col-span-2"
          defaultOpen={tieneOpcionales(contacto)}
        >
          <CollapsibleTrigger render={<Button type="button" variant="ghost" className="w-full justify-between" />}>
            Más opciones
            <ChevronDown className="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="grid gap-x-8 gap-y-4 border-t border-slate-200 p-3 sm:grid-cols-2">
            <FormField htmlFor="telefono" label="Teléfono">
              <Input
                id="telefono"
                name="telefono"
                inputMode="tel"
                placeholder="809-555-1234"
                defaultValue={contacto?.telefono ?? ""}
                className={FORM_INPUT}
              />
            </FormField>
            <FormField htmlFor="correo" label="Correo">
              <Input
                id="correo"
                name="correo"
                type="email"
                placeholder="correo@ejemplo.com"
                defaultValue={contacto?.correo ?? ""}
                className={FORM_INPUT}
              />
            </FormField>
            <FormField htmlFor="lista_precio_id" label="Lista de precios por defecto">
              <Select
                name="lista_precio_id"
                defaultValue={contacto?.lista_precio_id ?? SIN_LISTA}
                items={opcionesLista}
              >
                <SelectTrigger id="lista_precio_id" className={FORM_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opcionesLista.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="direccion" label="Dirección" className="sm:col-span-2">
              <Textarea
                id="direccion"
                name="direccion"
                defaultValue={contacto?.direccion ?? ""}
                className={FORM_TEXTAREA}
              />
            </FormField>
          </CollapsibleContent>
        </Collapsible>

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
          {pendiente ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
