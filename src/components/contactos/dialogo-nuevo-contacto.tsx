"use client";

import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";

import { ArrowUpRight, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearContacto } from "@/lib/contactos/actions";
import {
  errorIdentificacion,
  normalizarIdentificacion,
  TIPOS_IDENTIFICACION,
  type TipoIdentificacion,
  tipoContactoDesde,
} from "@/lib/contactos/contacto-rapido";
import { normalizarNombre } from "@/lib/contactos/contactos";

export interface ContactoCreado {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
}

interface Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  tipoInicial: "cliente" | "proveedor";
  nombreInicial?: string;
  onCreado: (contacto: ContactoCreado) => void;
}

const OPCIONES_IDENTIFICACION = TIPOS_IDENTIFICACION.map((tipo) => ({
  value: tipo.valor,
  label: tipo.etiqueta,
}));

export function DialogoNuevoContacto({ abierto, onOpenChange, tipoInicial, nombreInicial = "", onCreado }: Props) {
  const [esCliente, setEsCliente] = useState(tipoInicial === "cliente");
  const [esProveedor, setEsProveedor] = useState(tipoInicial === "proveedor");
  const [tipoIdentificacion, setTipoIdentificacion] = useState<TipoIdentificacion>("rnc");
  const [numero, setNumero] = useState("");
  const [nombre, setNombre] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [direccion, setDireccion] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const estabaAbierto = useRef(false);

  useEffect(() => {
    if (abierto && !estabaAbierto.current) {
      setEsCliente(tipoInicial === "cliente");
      setEsProveedor(tipoInicial === "proveedor");
      setTipoIdentificacion("rnc");
      setNumero("");
      setNombre(nombreInicial);
      setMunicipio("");
      setDireccion("");
      setCorreo("");
      setTelefono("");
      setError(null);
    }
    estabaAbierto.current = abierto;
  }, [abierto, nombreInicial, tipoInicial]);

  function alternarCliente() {
    if (esCliente && !esProveedor) return;
    setEsCliente((actual) => !actual);
  }

  function alternarProveedor() {
    if (esProveedor && !esCliente) return;
    setEsProveedor((actual) => !actual);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    if (normalizarNombre(nombre) === "") {
      setError("El nombre o la razón social es obligatorio.");
      return;
    }

    const errorNumero = errorIdentificacion(tipoIdentificacion, numero);
    if (errorNumero) {
      setError(errorNumero);
      return;
    }

    const tipo = tipoContactoDesde(esCliente, esProveedor);
    if (!tipo) {
      setError("Marca Cliente o Proveedor.");
      return;
    }

    const formData = new FormData();
    formData.set("tipo", tipo);
    formData.set("tipo_identificacion", tipoIdentificacion);
    formData.set("rnc_cedula", numero);
    formData.set("nombre", nombre);
    formData.set("municipio_provincia", municipio);
    formData.set("direccion", direccion);
    formData.set("correo", correo);
    formData.set("telefono", telefono);

    iniciar(async () => {
      const resultado = await crearContacto(formData);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      if (!resultado.id) {
        setError("El contacto se creó, pero no se pudo seleccionar. Búscalo en la lista.");
        return;
      }

      onCreado({
        id: resultado.id,
        nombre: normalizarNombre(nombre),
        rnc_cedula: normalizarIdentificacion(tipoIdentificacion, numero) || null,
      });
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Nuevo contacto</DialogTitle>
        </DialogHeader>

        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant={esCliente ? "default" : "outline"}
              aria-pressed={esCliente}
              onClick={alternarCliente}
              className="justify-center gap-2"
            >
              {esCliente ? <Check /> : null}
              Cliente
            </Button>
            <Button
              type="button"
              variant={esProveedor ? "default" : "outline"}
              aria-pressed={esProveedor}
              onClick={alternarProveedor}
              className="justify-center gap-2"
            >
              {esProveedor ? <Check /> : null}
              Proveedor
            </Button>
          </div>

          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="contacto-tipo-identificacion">Tipo de identificación *</FieldLabel>
              <Select
                items={OPCIONES_IDENTIFICACION}
                value={tipoIdentificacion}
                onValueChange={(valor: string | null) => {
                  if (valor === "rnc" || valor === "cedula" || valor === "pasaporte") setTipoIdentificacion(valor);
                }}
              >
                <SelectTrigger id="contacto-tipo-identificacion" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {OPCIONES_IDENTIFICACION.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="contacto-numero">Número</FieldLabel>
              <Input
                id="contacto-numero"
                inputMode={tipoIdentificacion === "pasaporte" ? "text" : "numeric"}
                value={numero}
                onChange={(evento) => setNumero(evento.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="contacto-nombre">Nombre o Razón social *</FieldLabel>
              <Input
                id="contacto-nombre"
                required
                maxLength={200}
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="contacto-municipio">Municipio / Provincia</FieldLabel>
                <Input
                  id="contacto-municipio"
                  placeholder="Ej. Santiago de los Caballeros"
                  value={municipio}
                  onChange={(evento) => setMunicipio(evento.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="contacto-direccion">Dirección</FieldLabel>
                <Input
                  id="contacto-direccion"
                  placeholder="Calle, número, sector"
                  value={direccion}
                  onChange={(evento) => setDireccion(evento.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="contacto-correo">Correo electrónico</FieldLabel>
                <Input
                  id="contacto-correo"
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={correo}
                  onChange={(evento) => setCorreo(evento.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="contacto-telefono">Teléfono</FieldLabel>
                <Input
                  id="contacto-telefono"
                  inputMode="tel"
                  placeholder="809-555-1234"
                  value={telefono}
                  onChange={(evento) => setTelefono(evento.target.value)}
                />
              </Field>
            </div>
          </FieldGroup>

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              render={<a href="/dashboard/contactos#nuevo" target="_blank" rel="noreferrer" />}
            >
              <ArrowUpRight />
              Formulario avanzado
            </Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              Crear contacto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
