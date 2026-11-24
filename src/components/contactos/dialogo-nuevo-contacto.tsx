"use client";

import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";

import { FORM_INPUT, FORM_SELECT, FormField } from "@/components/formularios/formulario";
import { ArrowUpRight, Check, Loader2 } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearContacto } from "@/lib/contactos/actions";
import { buscarContactoDuplicado } from "@/lib/contactos/buscar-duplicado";
import {
  errorIdentificacion,
  normalizarIdentificacion,
  TIPOS_IDENTIFICACION,
  type TipoIdentificacion,
  tipoContactoDesde,
} from "@/lib/contactos/contacto-rapido";
import { normalizarNombre } from "@/lib/contactos/contactos";
import type { DuplicadoContacto } from "@/lib/contactos/duplicados";
import { completarConDatosDgii } from "@/lib/dgii/completar";
import type { DatosContribuyenteDgii } from "@/lib/dgii/consulta";

import { BotonAutocompletarDgii, MensajeDgii, useConsultaDgii } from "./consulta-dgii";

export interface ContactoCreado {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
  /** Datos extra que el POS necesita para pintar y guardar el cliente sin volver al servidor. */
  direccion?: string | null;
  telefono?: string | null;
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
  const [duplicado, setDuplicado] = useState<DuplicadoContacto | null>(null);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const estabaAbierto = useRef(false);
  const enVuelo = useRef<boolean>(false);
  const { cargando, mensaje, consultar, limpiar } = useConsultaDgii();
  const autoRellenado = useRef({ nombre: "" });
  const valores = useRef({ nombre: "" });

  const hayCambios =
    esCliente !== (tipoInicial === "cliente") ||
    esProveedor !== (tipoInicial === "proveedor") ||
    tipoIdentificacion !== "rnc" ||
    numero.trim() !== "" ||
    normalizarNombre(nombre) !== normalizarNombre(nombreInicial) ||
    municipio.trim() !== "" ||
    direccion.trim() !== "" ||
    correo.trim() !== "" ||
    telefono.trim() !== "";

  useEffect(() => {
    valores.current = { nombre };
  }, [nombre]);

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
      setDuplicado(null);
      setConfirmarDescarte(false);
      enVuelo.current = false;
      autoRellenado.current = { nombre: "" };
      limpiar();
    } else if (!abierto && estabaAbierto.current) {
      limpiar();
    }
    estabaAbierto.current = abierto;
  }, [abierto, nombreInicial, tipoInicial, limpiar]);

  function completarConDgii(datos: DatosContribuyenteDgii): string {
    const { campos, mensaje: texto } = completarConDatosDgii(datos, valores.current, autoRellenado.current);
    if (campos.nombre !== undefined) setNombre(campos.nombre);
    setDuplicado(null);
    Object.assign(valores.current, campos);
    Object.assign(autoRellenado.current, campos);
    return texto;
  }

  function consultarEnDgii(automatica: boolean) {
    if (tipoIdentificacion === "pasaporte") return;

    const digitos = normalizarIdentificacion(tipoIdentificacion, numero);
    const esperado = tipoIdentificacion === "rnc" ? 9 : 11;
    if (automatica && digitos.length !== esperado) return;

    void consultar(digitos, tipoIdentificacion, completarConDgii);
  }

  function alternarCliente() {
    if (esCliente && !esProveedor) return;
    setDuplicado(null);
    setEsCliente((actual) => !actual);
  }

  function alternarProveedor() {
    if (esProveedor && !esCliente) return;
    setDuplicado(null);
    setEsProveedor((actual) => !actual);
  }

  async function avisarDuplicado(datos: { nombre: string; rnc_cedula: string | null }) {
    try {
      const existente = await buscarContactoDuplicado(datos);
      if (existente === null) return false;
      setDuplicado(existente);
      return true;
    } catch {
      setError("No se pudo verificar si el contacto ya existe. Intenta de nuevo.");
      return true;
    }
  }

  function guardar(tipo: "cliente" | "proveedor" | "ambos", permitirDuplicado: boolean) {
    if (enVuelo.current) return;
    enVuelo.current = true;

    const identificacion = normalizarIdentificacion(tipoIdentificacion, numero);
    const datos = {
      nombre: normalizarNombre(nombre),
      rnc_cedula: identificacion === "" ? null : identificacion,
    };

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
      try {
        if (!permitirDuplicado && (await avisarDuplicado(datos))) return;

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
          nombre: datos.nombre,
          rnc_cedula: datos.rnc_cedula,
          direccion: direccion.trim() || null,
          telefono: telefono.trim() || null,
        });
      } catch {
        setError("No se pudo guardar el contacto. Intenta de nuevo.");
      } finally {
        enVuelo.current = false;
      }
    });
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enVuelo.current) return;
    setError(null);
    setDuplicado(null);

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

    guardar(tipo, false);
  }

  function crearDeTodasFormas() {
    const tipo = tipoContactoDesde(esCliente, esProveedor);
    if (!tipo) return;
    setDuplicado(null);
    guardar(tipo, true);
  }

  function cambiarApertura(nuevo: boolean) {
    if (nuevo) {
      onOpenChange(true);
      return;
    }
    if (pendiente) return;
    if (hayCambios) {
      setConfirmarDescarte(true);
      return;
    }
    onOpenChange(false);
  }

  function descartarCambios() {
    setConfirmarDescarte(false);
    onOpenChange(false);
  }

  const motivo = duplicado?.motivo === "rnc" ? "RNC o cédula" : "nombre";

  return (
    <>
      <Dialog open={abierto} onOpenChange={cambiarApertura}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[560px]">
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

            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <FormField htmlFor="contacto-tipo-identificacion" label="Tipo de identificación" required>
                <Select
                  items={OPCIONES_IDENTIFICACION}
                  value={tipoIdentificacion}
                  onValueChange={(valor: string | null) => {
                    if (valor === "rnc" || valor === "cedula" || valor === "pasaporte") {
                      setTipoIdentificacion(valor);
                      setDuplicado(null);
                      limpiar();
                    }
                  }}
                >
                  <SelectTrigger id="contacto-tipo-identificacion" className={FORM_SELECT}>
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
              </FormField>

              <FormField htmlFor="contacto-numero" label="Número">
                <Input
                  id="contacto-numero"
                  inputMode={tipoIdentificacion === "pasaporte" ? "text" : "numeric"}
                  value={numero}
                  onChange={(evento) => {
                    setNumero(evento.target.value);
                    setDuplicado(null);
                    limpiar();
                  }}
                  onBlur={() => consultarEnDgii(true)}
                  className={FORM_INPUT}
                />
                <div className="mt-1">
                  <BotonAutocompletarDgii
                    onClick={() => consultarEnDgii(false)}
                    cargando={cargando}
                    disabled={tipoIdentificacion === "pasaporte"}
                  />
                </div>
                <MensajeDgii mensaje={mensaje} />
              </FormField>

              <FormField htmlFor="contacto-nombre" label="Nombre o Razón social" required className="sm:col-span-2">
                <Input
                  id="contacto-nombre"
                  required
                  maxLength={200}
                  value={nombre}
                  onChange={(evento) => {
                    setNombre(evento.target.value);
                    setDuplicado(null);
                  }}
                  className={FORM_INPUT}
                />
              </FormField>

              <FormField htmlFor="contacto-municipio" label="Municipio / Provincia">
                <Input
                  id="contacto-municipio"
                  placeholder="Ej. Santiago de los Caballeros"
                  value={municipio}
                  onChange={(evento) => {
                    setMunicipio(evento.target.value);
                    setDuplicado(null);
                  }}
                  className={FORM_INPUT}
                />
              </FormField>

              <FormField htmlFor="contacto-direccion" label="Dirección">
                <Input
                  id="contacto-direccion"
                  placeholder="Calle, número, sector"
                  value={direccion}
                  onChange={(evento) => {
                    setDireccion(evento.target.value);
                    setDuplicado(null);
                  }}
                  className={FORM_INPUT}
                />
              </FormField>

              <FormField htmlFor="contacto-correo" label="Correo electrónico">
                <Input
                  id="contacto-correo"
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={correo}
                  onChange={(evento) => {
                    setCorreo(evento.target.value);
                    setDuplicado(null);
                  }}
                  className={FORM_INPUT}
                />
              </FormField>

              <FormField htmlFor="contacto-telefono" label="Teléfono">
                <Input
                  id="contacto-telefono"
                  inputMode="tel"
                  placeholder="809-555-1234"
                  value={telefono}
                  onChange={(evento) => {
                    setTelefono(evento.target.value);
                    setDuplicado(null);
                  }}
                  className={FORM_INPUT}
                />
              </FormField>
            </div>

            {duplicado ? (
              <Alert variant="destructive">
                <AlertTitle>Ya existe un contacto con este {motivo}</AlertTitle>
                <AlertDescription>
                  <p className="text-foreground font-medium">{duplicado.contacto.nombre}</p>
                  {duplicado.contacto.rnc_cedula ? (
                    <p className="tabular-nums">{duplicado.contacto.rnc_cedula}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={
                        <a href={`/dashboard/contactos/${duplicado.contacto.id}`} target="_blank" rel="noreferrer" />
                      }
                    >
                      <ArrowUpRight />
                      Ver el existente
                    </Button>
                    <Button type="button" size="sm" onClick={crearDeTodasFormas}>
                      Crear de todas formas
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                nativeButton={false}
                className="h-11 rounded-[12px] px-6"
                render={<a href="/dashboard/contactos#nuevo" target="_blank" rel="noreferrer" />}
              >
                <ArrowUpRight />
                Formulario avanzado
              </Button>
              <Button type="submit" disabled={pendiente} className="h-11 rounded-[12px] px-6">
                {pendiente ? <Loader2 className="animate-spin" /> : null}
                Crear contacto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarDescarte} onOpenChange={setConfirmarDescarte}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar los cambios sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>
              Si cierras ahora, se perderán los datos que escribiste en el contacto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={descartarCambios}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
