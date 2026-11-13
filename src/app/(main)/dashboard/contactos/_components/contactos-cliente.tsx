"use client";

import { type FormEvent, useState, useTransition } from "react";

import { ChevronDown, Pencil, Plus, Search } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { actualizarContacto, crearContacto } from "@/lib/contactos/actions";
import {
  type Contacto,
  etiquetaTipoContacto,
  filtrarContactos,
  type PestanaContactos,
  TIPOS_CONTACTO,
} from "@/lib/contactos/contactos";
import { rutaContacto } from "@/lib/enlaces";

const OPCIONES_TIPO = TIPOS_CONTACTO.map((tipo) => ({ value: tipo.valor, label: tipo.etiqueta }));

function tieneOpcionales(contacto: Contacto | null) {
  if (contacto === null) return false;
  return Boolean(contacto.rnc_cedula ?? contacto.telefono ?? contacto.correo ?? contacto.direccion);
}

function FormularioContacto({
  contacto,
  onGuardado,
}: {
  readonly contacto: Contacto | null;
  readonly onGuardado: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

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
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="nombre">Nombre *</FieldLabel>
          <Input id="nombre" name="nombre" required maxLength={200} defaultValue={contacto?.nombre ?? ""} />
        </Field>

        <Field>
          <FieldLabel htmlFor="tipo">Tipo</FieldLabel>
          <Select name="tipo" defaultValue={contacto?.tipo ?? "cliente"} items={OPCIONES_TIPO}>
            <SelectTrigger id="tipo" className="w-full">
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
        </Field>

        <Collapsible className="rounded-lg border" defaultOpen={tieneOpcionales(contacto)}>
          <CollapsibleTrigger render={<Button type="button" variant="ghost" className="w-full justify-between" />}>
            Más opciones
            <ChevronDown className="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-4 border-t p-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rnc_cedula">RNC / Cédula</FieldLabel>
                <Input
                  id="rnc_cedula"
                  name="rnc_cedula"
                  inputMode="numeric"
                  placeholder="131123456"
                  defaultValue={contacto?.rnc_cedula ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="telefono">Teléfono</FieldLabel>
                <Input
                  id="telefono"
                  name="telefono"
                  inputMode="tel"
                  placeholder="809-555-1234"
                  defaultValue={contacto?.telefono ?? ""}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="correo">Correo</FieldLabel>
              <Input
                id="correo"
                name="correo"
                type="email"
                placeholder="correo@ejemplo.com"
                defaultValue={contacto?.correo ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="direccion">Dirección</FieldLabel>
              <Textarea id="direccion" name="direccion" defaultValue={contacto?.direccion ?? ""} />
            </Field>
          </CollapsibleContent>
        </Collapsible>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ContactosCliente({
  contactos,
  puedeEditar,
}: {
  readonly contactos: Contacto[];
  readonly puedeEditar: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [pestana, setPestana] = useState<PestanaContactos>("todos");
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [contactoEditando, setContactoEditando] = useState<Contacto | null>(null);

  const filtrados = filtrarContactos(contactos, pestana, busqueda);

  function abrirNuevo() {
    setContactoEditando(null);
    setDialogoAbierto(true);
  }

  function abrirEditar(contacto: Contacto) {
    setContactoEditando(contacto);
    setDialogoAbierto(true);
  }

  function cambiarDialogo(abierto: boolean) {
    setDialogoAbierto(abierto);
    if (!abierto) setContactoEditando(null);
  }

  function cerrarTrasGuardar() {
    setDialogoAbierto(false);
    setContactoEditando(null);
  }

  function cambiarPestana(valor: string | number) {
    if (valor === "clientes" || valor === "proveedores") {
      setPestana(valor);
      return;
    }
    setPestana("todos");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Contactos</h1>
          <p className="text-muted-foreground">Administra tus clientes y proveedores.</p>
        </div>
        {puedeEditar ? (
          <Button type="button" onClick={abrirNuevo}>
            <Plus />
            Nuevo contacto
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={pestana} onValueChange={cambiarPestana}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre, RNC o teléfono…"
            aria-label="Buscar contactos"
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>RNC / Cédula</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Tipo</TableHead>
              {puedeEditar ? (
                <TableHead className="w-10">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={puedeEditar ? 5 : 4}
                  className="text-muted-foreground h-24 text-center whitespace-normal"
                >
                  {busqueda.trim() ? "No se encontraron contactos con esa búsqueda." : "Todavía no hay contactos."}
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((contacto) => (
                <TableRow key={contacto.id}>
                  <TableCell className="font-medium">
                    <Enlace href={rutaContacto(contacto.id)}>{contacto.nombre}</Enlace>
                  </TableCell>
                  <TableCell className="tabular-nums">{contacto.rnc_cedula ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{contacto.telefono ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{etiquetaTipoContacto(contacto.tipo)}</Badge>
                  </TableCell>
                  {puedeEditar ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${contacto.nombre}`}
                        onClick={() => abrirEditar(contacto)}
                      >
                        <Pencil />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogoAbierto} onOpenChange={cambiarDialogo}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{contactoEditando ? "Editar contacto" : "Nuevo contacto"}</DialogTitle>
          </DialogHeader>
          <FormularioContacto
            key={contactoEditando?.id ?? "nuevo"}
            contacto={contactoEditando}
            onGuardado={cerrarTrasGuardar}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
