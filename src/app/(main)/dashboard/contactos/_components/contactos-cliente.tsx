"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { AvatarInicial } from "@/components/avatar-inicial";
import { DialogoNuevoContacto } from "@/components/contactos/dialogo-nuevo-contacto";
import { FormularioContacto } from "@/components/contactos/formulario-contacto";
import { Enlace } from "@/components/enlace";
import { Pencil, Plus } from "@/components/icons";
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
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Contacto, etiquetaTipoContacto, type PestanaContactos } from "@/lib/contactos/contactos";
import { rutaContacto } from "@/lib/enlaces";
import type { ListaPrecio } from "@/lib/inventario/tipos";
import {
  type OpcionesLista,
  type ParametrosLista,
  type ResumenPagina,
  TAMANOS_PAGINA,
  urlLista,
} from "@/lib/listas/parametros";

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
  const [dialogoRapidoAbierto, setDialogoRapidoAbierto] = useState(false);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [contactoEditando, setContactoEditando] = useState<Contacto | null>(null);

  useEffect(() => {
    if (window.location.hash === "#nuevo") {
      setDialogoRapidoAbierto(false);
      setContactoEditando(null);
      setDialogoAbierto(true);
    }
  }, []);

  function abrirNuevo() {
    setContactoEditando(null);
    setDialogoAbierto(false);
    setDialogoRapidoAbierto(true);
  }

  function abrirEditar(contacto: Contacto) {
    setDialogoRapidoAbierto(false);
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

  function cerrarDialogoRapido() {
    setDialogoRapidoAbierto(false);
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
      <EncabezadoPagina
        titulo="Contactos"
        subtitulo="Administra tus clientes y proveedores."
        migas={[{ etiqueta: "Inicio", href: "/dashboard" }, { etiqueta: "Contactos" }]}
        acciones={
          puedeEditar ? (
            <Button type="button" onClick={abrirNuevo}>
              <Plus />
              Nuevo contacto
            </Button>
          ) : null
        }
      />

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
          filaHref={(contacto) => rutaContacto(contacto.id)}
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

      <DialogoNuevoContacto
        abierto={dialogoRapidoAbierto}
        onOpenChange={setDialogoRapidoAbierto}
        tipoInicial="cliente"
        onCreado={cerrarDialogoRapido}
      />
    </ContenedorLista>
  );
}
