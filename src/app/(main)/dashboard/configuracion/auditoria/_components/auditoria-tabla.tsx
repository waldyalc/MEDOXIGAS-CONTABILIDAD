"use client";

import { useState } from "react";

import {
  etiquetaAccion,
  etiquetaCampo,
  etiquetaEntidad,
  formatearValorCampo,
  tonoAccion,
} from "@/components/auditoria/historial-documento";
import { ChevronDown, ChevronRight, History } from "@/components/icons";
import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import type { EntradaAuditoria } from "@/lib/auditoria/consultas";
import { formatoFechaHora } from "@/lib/formato";

function DetalleCambios({
  entrada,
  expandida,
  onAlternar,
}: {
  readonly entrada: EntradaAuditoria;
  readonly expandida: boolean;
  readonly onAlternar: () => void;
}) {
  if (entrada.cambios.length === 0) {
    return <span className="text-muted-foreground">{entrada.accion === "crear" ? "Creación" : "—"}</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2"
        aria-expanded={expandida}
        onClick={onAlternar}
      >
        {expandida ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {entrada.cambios.length === 1 ? "1 cambio" : `${entrada.cambios.length} cambios`}
      </Button>

      {expandida ? (
        <ul className="flex flex-col gap-0.5">
          {entrada.cambios.map((cambio) => (
            <li key={cambio.campo} className="text-muted-foreground text-xs">
              <span className="text-slate-700 dark:text-slate-300">{etiquetaCampo(cambio.campo)}:</span>{" "}
              <span className="line-through">{formatearValorCampo(cambio.campo, cambio.anterior)}</span>
              <span aria-hidden> → </span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {formatearValorCampo(cambio.campo, cambio.nuevo)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Tabla de la auditoría: fecha, usuario, acción (pill: verde crear, amarillo
 * modificar, rojo anular), entidad, etiqueta del documento y cambios
 * expandibles.
 */
export function AuditoriaTabla({
  entradas,
  filtrada,
}: {
  readonly entradas: readonly EntradaAuditoria[];
  readonly filtrada: boolean;
}) {
  const [expandidas, setExpandidas] = useState<ReadonlySet<string>>(() => new Set());

  function alternar(id: string) {
    setExpandidas((previa) => {
      const siguiente = new Set(previa);
      if (siguiente.has(id)) {
        siguiente.delete(id);
      } else {
        siguiente.add(id);
      }
      return siguiente;
    });
  }

  const columnas: readonly ColumnaLista<EntradaAuditoria>[] = [
    {
      clave: "creado_en",
      encabezado: "Fecha",
      celda: (entrada) => <span className="text-muted-foreground">{formatoFechaHora(entrada.creado_en)}</span>,
    },
    {
      clave: "usuario",
      encabezado: "Usuario",
      celda: (entrada) => <span className="font-medium">{entrada.usuario_nombre.trim() || "—"}</span>,
    },
    {
      clave: "accion",
      encabezado: "Acción",
      celda: (entrada) => <PillEstado tono={tonoAccion(entrada.accion)}>{etiquetaAccion(entrada.accion)}</PillEstado>,
    },
    {
      clave: "entidad",
      encabezado: "Entidad",
      celda: (entrada) => etiquetaEntidad(entrada.entidad),
    },
    {
      clave: "etiqueta",
      encabezado: "Documento",
      celda: (entrada) => entrada.entidad_etiqueta.trim() || "—",
    },
    {
      clave: "cambios",
      encabezado: "Cambios",
      className: "whitespace-normal",
      celda: (entrada) => (
        <DetalleCambios
          entrada={entrada}
          expandida={expandidas.has(entrada.id)}
          onAlternar={() => alternar(entrada.id)}
        />
      ),
    },
  ];

  return (
    <TablaLista
      columnas={columnas}
      filas={entradas}
      claveFila={(entrada) => entrada.id}
      vacio={{
        filtrada,
        titulo: filtrada ? "Sin resultados" : "Sin registros",
        descripcion: filtrada
          ? "Ningún registro de auditoría coincide con los filtros."
          : "Todavía no hay actividad auditada en el sistema.",
        icono: <History className="size-10" />,
      }}
    />
  );
}
