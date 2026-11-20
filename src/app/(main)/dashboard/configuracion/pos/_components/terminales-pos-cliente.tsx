"use client";

import { useState } from "react";

import { Pencil, Plus, Store } from "lucide-react";

import { type ColumnaLista, PillEstado, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import type { TerminalPOS } from "@/lib/pos/tipos";

import { type CatalogosPos, cajonesOcupados } from "./catalogos";
import { DialogoTerminal } from "./dialogo-terminal";

function nombreDeCuenta(catalogos: CatalogosPos, cuentaId: string): string {
  const cuenta = catalogos.cuentas.find((opcion) => opcion.id === cuentaId);
  return cuenta ? `${cuenta.codigo} · ${cuenta.nombre}` : "Cuenta no disponible";
}

function nombreDeAlmacen(catalogos: CatalogosPos, almacenId: string): string {
  const almacen = catalogos.almacenes.find((opcion) => opcion.id === almacenId);
  return almacen?.nombre ?? "Almacén no disponible";
}

export function TerminalesPosCliente({
  terminales,
  catalogos,
  puedeEditar,
}: {
  readonly terminales: TerminalPOS[];
  readonly catalogos: CatalogosPos;
  readonly puedeEditar: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [editada, setEditada] = useState<TerminalPOS | null>(null);

  const columnas: readonly ColumnaLista<TerminalPOS>[] = [
    {
      clave: "nombre",
      encabezado: "Nombre",
      celda: (terminal) => <span className="font-medium">{terminal.nombre}</span>,
    },
    {
      clave: "almacen",
      encabezado: "Almacén",
      celda: (terminal) => (
        <span className="text-muted-foreground">{nombreDeAlmacen(catalogos, terminal.almacen_id)}</span>
      ),
    },
    {
      clave: "efectivo",
      encabezado: "Cuenta de efectivo",
      celda: (terminal) => (
        <span className="text-muted-foreground">{nombreDeCuenta(catalogos, terminal.cuenta_efectivo_id)}</span>
      ),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (terminal) => (
        <PillEstado tono={terminal.activa ? "exito" : "neutro"}>{terminal.activa ? "Activa" : "Inactiva"}</PillEstado>
      ),
    },
  ];

  function abrirNueva() {
    setEditada(null);
    setAbierto(true);
  }

  function abrirEdicion(terminal: TerminalPOS) {
    setEditada(terminal);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    setEditada(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Cada caja física necesita su terminal, su almacén y su cajón de efectivo. Las ventas caen en la contabilidad
          como cualquier factura.
        </p>
        {puedeEditar ? (
          <Button type="button" onClick={abrirNueva}>
            <Plus />
            Nueva terminal
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">Tu rol es de solo lectura.</p>
        )}
      </div>

      <TarjetaLista data-lista="configuracion-pos-terminales">
        <TablaLista
          columnas={columnas}
          filas={terminales}
          claveFila={(terminal) => terminal.id}
          acciones={
            puedeEditar
              ? (terminal) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${terminal.nombre}`}
                    onClick={() => abrirEdicion(terminal)}
                  >
                    <Pencil />
                  </Button>
                )
              : undefined
          }
          vacio={{
            titulo: "Aún no hay terminales de punto de venta",
            descripcion:
              "Configura la primera caja con su almacén, su cuenta de efectivo y su numeración para poder vender.",
            icono: <Store className="size-10" />,
            accion: puedeEditar ? (
              <Button type="button" onClick={abrirNueva}>
                <Plus />
                Nueva terminal
              </Button>
            ) : undefined,
          }}
        />
      </TarjetaLista>

      {abierto ? (
        <DialogoTerminal
          key={editada?.id ?? "nueva"}
          terminal={editada}
          catalogos={catalogos}
          cajonesEnUso={cajonesOcupados(terminales, editada?.id ?? null)}
          onCerrar={cerrar}
        />
      ) : null}
    </div>
  );
}
