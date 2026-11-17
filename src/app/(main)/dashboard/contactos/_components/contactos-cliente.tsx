"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { Pencil, Plus } from "lucide-react";

import { FormularioContacto } from "@/components/contactos/formulario-contacto";
import { Enlace } from "@/components/enlace";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Contacto, etiquetaTipoContacto, type PestanaContactos } from "@/lib/contactos/contactos";
import { rutaContacto } from "@/lib/enlaces";
import type { ListaPrecio } from "@/lib/inventario/tipos";
import { type OpcionesLista, type ParametrosLista, type ResumenPagina, urlLista } from "@/lib/listas/parametros";

function mensajeVacio(q: string, pestana: PestanaContactos): string {
  if (q) return "No se encontraron contactos con esa búsqueda.";
  if (pestana !== "todos") return "No hay contactos en esta pestaña.";
  return "Todavía no hay contactos.";
}

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

        <BuscadorLista
          base="/dashboard/contactos"
          parametros={params}
          valorInicial={opciones.q}
          placeholder="Buscar por nombre, RNC o teléfono…"
          ariaLabel="Buscar contactos"
          className="sm:max-w-xs"
        />
      </div>

      <div className="flex flex-col gap-3">
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
              {contactos.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={puedeEditar ? 5 : 4}
                    className="text-muted-foreground h-24 text-center whitespace-normal"
                  >
                    {mensajeVacio(opciones.q, pestana)}
                  </TableCell>
                </TableRow>
              ) : (
                contactos.map((contacto) => (
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

        <PaginadorLista base="/dashboard/contactos" params={params} resumen={resumen} />
      </div>

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
    </div>
  );
}
