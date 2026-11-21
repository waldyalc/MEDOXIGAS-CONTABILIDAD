"use client";

import { useState } from "react";

import { Tags } from "@/components/icons";
import { type ColumnaLista, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { SelectCampo } from "@/components/select-campo";
import { toast } from "@/components/ui/toast";
import {
  CATEGORIAS_DGII,
  type CuentaDgii,
  etiquetaCategoriaDgii,
  etiquetaTipoCompra,
  etiquetaTipoIngreso,
  TIPOS_COMPRA,
  TIPOS_INGRESO,
} from "@/lib/configuracion/dgii";
import { actualizarClasificacionDgii } from "@/lib/configuracion/dgii-acciones";

const OPCIONES_CATEGORIA = CATEGORIAS_DGII.map((categoria) => ({
  value: categoria.valor,
  label: categoria.corta,
}));
const OPCIONES_TIPO_COMPRA = TIPOS_COMPRA.map((tipo) => ({ value: tipo.valor, label: tipo.corta }));
const OPCIONES_TIPO_INGRESO = TIPOS_INGRESO.map((tipo) => ({ value: tipo.valor, label: tipo.corta }));

type CampoClasificacion = "categoriaDgii" | "tipoCompra" | "tipoIngreso";

function textoCuentasSinClasificar(cantidad: number): string {
  if (cantidad === 0) return "Todas las cuentas de movimiento están clasificadas.";
  if (cantidad === 1) return "1 cuenta sin clasificar.";
  return `${cantidad} cuentas sin clasificar.`;
}

export function ReportesDgiiCliente({
  cuentas,
  puedeEditar,
}: {
  readonly cuentas: readonly CuentaDgii[];
  readonly puedeEditar: boolean;
}) {
  const [filas, setFilas] = useState<CuentaDgii[]>([...cuentas]);
  const [guardando, setGuardando] = useState<string | null>(null);

  async function cambiar(cuenta: CuentaDgii, campo: CampoClasificacion, valor: string) {
    const siguiente: CuentaDgii = { ...cuenta, [campo]: valor === "" ? null : valor };

    setFilas((actuales) => actuales.map((fila) => (fila.id === cuenta.id ? siguiente : fila)));
    setGuardando(cuenta.id);

    const resultado = await actualizarClasificacionDgii({
      cuentaId: cuenta.id,
      categoriaDgii: siguiente.categoriaDgii,
      tipoCompra: siguiente.tipoCompra,
      tipoIngreso: siguiente.tipoIngreso,
    });

    setGuardando(null);

    if (!resultado.ok) {
      // Solo se revierte esta fila: otra cuenta pudo guardarse mientras tanto.
      setFilas((actuales) => actuales.map((fila) => (fila.id === cuenta.id ? cuenta : fila)));
      toast.add({ type: "error", title: "No se pudo guardar la clasificación", description: resultado.error });
      return;
    }

    toast.add({ type: "success", title: "Clasificación guardada" });
  }

  const columnas: readonly ColumnaLista<CuentaDgii>[] = [
    {
      clave: "cuenta",
      encabezado: "Cuenta contable",
      className: "min-w-48",
      celda: (cuenta) => (
        <div className="flex min-w-48 flex-col gap-0.5">
          <span className="text-muted-foreground font-mono text-xs">{cuenta.codigo}</span>
          <span className="font-medium">{cuenta.nombre}</span>
        </div>
      ),
    },
    {
      clave: "categoriaDgii",
      encabezado: "Categoría DGII",
      className: "min-w-56",
      celda: (cuenta) => (
        <SelectCampo
          aria-label={`Categoría DGII de ${cuenta.nombre}`}
          opciones={OPCIONES_CATEGORIA}
          valor={cuenta.categoriaDgii}
          etiquetaVacia="Sin clasificar"
          deshabilitado={!puedeEditar || guardando === cuenta.id}
          onCambio={(valor) => void cambiar(cuenta, "categoriaDgii", valor)}
          className="w-full"
        />
      ),
    },
    {
      clave: "tipoCompra",
      encabezado: "Tipo de compra",
      className: "min-w-32",
      celda: (cuenta) => (
        <SelectCampo
          aria-label={`Tipo de compra de ${cuenta.nombre}`}
          opciones={OPCIONES_TIPO_COMPRA}
          valor={cuenta.tipoCompra}
          etiquetaVacia="Sin clasificar"
          deshabilitado={!puedeEditar || guardando === cuenta.id}
          onCambio={(valor) => void cambiar(cuenta, "tipoCompra", valor)}
          className="w-full"
        />
      ),
    },
    {
      clave: "tipoIngreso",
      encabezado: "Tipo de ingreso",
      className: "min-w-52",
      celda: (cuenta) => (
        <SelectCampo
          aria-label={`Tipo de ingreso de ${cuenta.nombre}`}
          opciones={OPCIONES_TIPO_INGRESO}
          valor={cuenta.tipoIngreso}
          etiquetaVacia="Sin clasificar"
          deshabilitado={!puedeEditar || guardando === cuenta.id}
          onCambio={(valor) => void cambiar(cuenta, "tipoIngreso", valor)}
          className="w-full"
        />
      ),
    },
  ];

  const sinClasificar = filas.filter(
    (fila) => fila.categoriaDgii == null && fila.tipoCompra == null && fila.tipoIngreso == null,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-muted-foreground max-w-3xl text-sm">
          Alegra clasifica cada renglón del 606 por la cuenta del gasto o costo (categoría DGII y bienes/servicios) y
          cada renglón del 607 por el tipo de ingreso de la cuenta. Una cuenta sin clasificar deja su documento fuera
          del TXT, con el motivo en «Documentos no incluidos».
        </p>
        <p className="text-muted-foreground text-sm">{textoCuentasSinClasificar(sinClasificar)}</p>
      </div>

      <TarjetaLista data-lista="configuracion-reportes-dgii">
        <TablaLista
          columnas={columnas}
          filas={filas}
          claveFila={(cuenta) => cuenta.id}
          vacio={{
            titulo: "No hay cuentas de movimiento activas",
            descripcion: "Crea cuentas en el catálogo para poder clasificarlas.",
            icono: <Tags className="size-10" />,
          }}
        />
      </TarjetaLista>

      <p className="text-muted-foreground text-xs">
        Categoría DGII y tipo de compra alimentan el 606; el tipo de ingreso alimenta el 607.{" "}
        {etiquetaCategoriaDgii("09")} es la que usa la semilla para inventario y costo de ventas;{" "}
        {etiquetaTipoCompra("bienes")} y {etiquetaTipoIngreso("1")} son los valores por defecto de Alegra.
      </p>
    </div>
  );
}
