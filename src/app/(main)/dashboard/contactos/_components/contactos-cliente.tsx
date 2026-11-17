"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ChevronDown, Pencil, Plus } from "lucide-react";

import { AvatarInicial } from "@/components/avatar-inicial";
import { Enlace } from "@/components/enlace";
import { FORM_INPUT, FORM_SELECT, FORM_TEXTAREA, FormField } from "@/components/formularios/formulario";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import {
  BarraLista,
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { actualizarContacto, crearContacto } from "@/lib/contactos/actions";
import {
  type Contacto,
  etiquetaTipoContacto,
  type PestanaContactos,
  SIN_LISTA_PRECIO,
  TIPOS_CONTACTO,
} from "@/lib/contactos/contactos";
import { rutaContacto } from "@/lib/enlaces";
import type { ListaPrecio } from "@/lib/inventario/tipos";
import {
  type OpcionesLista,
  type ParametrosLista,
  type ResumenPagina,
  TAMANOS_PAGINA,
  urlLista,
} from "@/lib/listas/parametros";

const OPCIONES_TIPO = TIPOS_CONTACTO.map((tipo) => ({ value: tipo.valor, label: tipo.etiqueta }));
const SIN_LISTA = SIN_LISTA_PRECIO;

function tieneOpcionales(contacto: Contacto | null) {
  if (contacto === null) return false;
  return Boolean(contacto.rnc_cedula ?? contacto.telefono ?? contacto.correo ?? contacto.direccion);
}

function FormularioContacto({
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

  const opcionesLista = [
    { value: SIN_LISTA, label: "Sin lista (precio del producto)" },
    ...listasPrecios.map((lista) => ({
      value: lista.id,
      label: `${lista.nombre}${lista.es_principal ? " (principal)" : ""}`,
    })),
  ];

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
            defaultValue={contacto?.nombre ?? ""}
            className={FORM_INPUT}
          />
        </FormField>

        <FormField htmlFor="tipo" label="Tipo">
          <Select name="tipo" defaultValue={contacto?.tipo ?? "cliente"} items={OPCIONES_TIPO}>
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

        <Collapsible
          className="rounded-xl border border-slate-200 sm:col-span-2"
          defaultOpen={tieneOpcionales(contacto)}
        >
          <CollapsibleTrigger render={<Button type="button" variant="ghost" className="w-full justify-between" />}>
            Más opciones
            <ChevronDown className="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="grid gap-x-8 gap-y-4 border-t border-slate-200 p-3 sm:grid-cols-2">
            <FormField htmlFor="rnc_cedula" label="RNC / Cédula">
              <Input
                id="rnc_cedula"
                name="rnc_cedula"
                inputMode="numeric"
                placeholder="131123456"
                defaultValue={contacto?.rnc_cedula ?? ""}
                className={FORM_INPUT}
              />
            </FormField>
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

function mensajeVacio(q: string, pestana: PestanaContactos): string {
  if (q) return "La búsqueda no arrojó contactos.";
  if (pestana !== "todos") return "No hay contactos en esta pestaña.";
  return "Todavía no hay contactos.";
}

const columnasContactos: readonly ColumnaLista<Contacto>[] = [
  {
    clave: "nombre",
    encabezado: "Nombre",
    celda: (contacto) => (
      <Enlace href={rutaContacto(contacto.id)} className="flex items-center gap-2.5 font-medium">
        <AvatarInicial nombre={contacto.nombre} correo={contacto.correo} size="sm" />
        {contacto.nombre}
      </Enlace>
    ),
  },
  {
    clave: "rnc",
    encabezado: "RNC / Cédula",
    celda: (contacto) => <span className="tabular-nums">{contacto.rnc_cedula ?? "—"}</span>,
  },
  {
    clave: "telefono",
    encabezado: "Teléfono",
    celda: (contacto) => <span className="tabular-nums">{contacto.telefono ?? "—"}</span>,
  },
  {
    clave: "tipo",
    encabezado: "Tipo",
    celda: (contacto) => <PillEstado tono="info">{etiquetaTipoContacto(contacto.tipo)}</PillEstado>,
  },
];

export function ContactosCliente({
  contactos,
  resumen,
  params,
  opciones,
  pestana,
  listasPrecios,
  puedeEditar,
}: {
  readonly contactos: Contacto[];
  readonly resumen: ResumenPagina;
  readonly params: ParametrosLista;
  readonly opciones: OpcionesLista;
  readonly pestana: PestanaContactos;
  readonly listasPrecios: ListaPrecio[];
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [contactoEditando, setContactoEditando] = useState<Contacto | null>(null);

  useEffect(() => {
    if (window.location.hash === "#nuevo") {
      setContactoEditando(null);
      setDialogoAbierto(true);
    }
  }, []);

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
    router.refresh();
  }

  function cambiarPestana(valor: string | number) {
    if (valor === "clientes" || valor === "proveedores") {
      router.replace(urlLista("/dashboard/contactos", params, { tipo: valor, pagina: null }), { scroll: false });
      return;
    }
    router.replace(urlLista("/dashboard/contactos", params, { tipo: null, pagina: null }), { scroll: false });
  }

  return (
    <ContenedorLista>
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

      <Tabs value={pestana} onValueChange={cambiarPestana}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
        </TabsList>
      </Tabs>

      <TarjetaLista data-lista="contactos">
        <BarraLista>
          <BuscadorLista
            base="/dashboard/contactos"
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por nombre, RNC o teléfono…"
            ariaLabel="Buscar contactos"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <TablaLista
          columnas={columnasContactos}
          filas={contactos}
          claveFila={(contacto) => contacto.id}
          acciones={
            puedeEditar
              ? (contacto) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${contacto.nombre}`}
                    onClick={() => abrirEditar(contacto)}
                  >
                    <Pencil />
                  </Button>
                )
              : undefined
          }
          vacio={{
            filtrada: Boolean(opciones.q) || pestana !== "todos",
            titulo: opciones.q ? "Sin resultados" : "¡Aún no tienes contactos!",
            descripcion: mensajeVacio(opciones.q, pestana),
            accion: puedeEditar ? (
              <Button type="button" onClick={abrirNuevo}>
                <Plus />
                Nuevo contacto
              </Button>
            ) : undefined,
          }}
        />

        <PaginadorLista
          base="/dashboard/contactos"
          params={params}
          resumen={resumen}
          etiqueta="Ítems por página"
          tamano={opciones.tamano}
          opciones={TAMANOS_PAGINA}
          mostrarEnVacio
          botonesExtremos={false}
          className="border-border h-14 border-t px-4 text-slate-700 dark:text-slate-300"
        />
      </TarjetaLista>

      <Dialog open={dialogoAbierto} onOpenChange={cambiarDialogo}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{contactoEditando ? "Editar contacto" : "Nuevo contacto"}</DialogTitle>
          </DialogHeader>
          <FormularioContacto
            key={contactoEditando?.id ?? "nuevo"}
            contacto={contactoEditando}
            listasPrecios={listasPrecios}
            onGuardado={cerrarTrasGuardar}
          />
        </DialogContent>
      </Dialog>
    </ContenedorLista>
  );
}
