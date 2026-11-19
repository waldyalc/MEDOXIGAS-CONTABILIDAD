"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { format, isValid, parse } from "date-fns";
import type { DateRange } from "react-day-picker";

import { ACCIONES_AUDITORIA, ENTIDADES_AUDITADAS } from "@/components/auditoria/historial-documento";
import { DateRangePicker } from "@/components/date-range-picker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UsuarioAuditoria } from "@/lib/auditoria/consultas";

const RUTA = "/dashboard/configuracion/auditoria";
const TODOS = "todos";
const FORMATO_ISO = "yyyy-MM-dd";

const OPCIONES_ENTIDAD = [{ value: TODOS, label: "Todas las entidades" }, ...ENTIDADES_AUDITADAS];
const OPCIONES_ACCION = [{ value: TODOS, label: "Todas las acciones" }, ...ACCIONES_AUDITORIA];

function aFecha(valor: string): Date | undefined {
  if (valor === "") return undefined;
  const fecha = parse(valor, FORMATO_ISO, new Date());
  return isValid(fecha) ? fecha : undefined;
}

function aRango(desde: string, hasta: string): DateRange | undefined {
  const inicio = aFecha(desde);
  if (!inicio) return undefined;
  return { from: inicio, to: aFecha(hasta) ?? inicio };
}

interface Props {
  entidad: string;
  usuario: string;
  accion: string;
  desde: string;
  hasta: string;
  usuarios: readonly UsuarioAuditoria[];
}

/**
 * Filtros de la auditoría (usuario, entidad, acción y rango de fechas). Se
 * aplican navegando con parámetros de URL para que la página siga siendo un
 * Server Component y el paginador conserve los filtros.
 */
export function FiltroAuditoria({ entidad, usuario, accion, desde, hasta, usuarios }: Props) {
  const router = useRouter();
  const [entidadEstado, setEntidadEstado] = useState(entidad === "" ? TODOS : entidad);
  const [usuarioEstado, setUsuarioEstado] = useState(usuario === "" ? TODOS : usuario);
  const [accionEstado, setAccionEstado] = useState(accion === "" ? TODOS : accion);
  const [rango, setRango] = useState<DateRange | undefined>(() => aRango(desde, hasta));

  // Cada navegación (paginador u otro filtro) re-renderiza la página con
  // nuevos parámetros: el filtro se sincroniza con la URL.
  useEffect(() => {
    setEntidadEstado(entidad === "" ? TODOS : entidad);
    setUsuarioEstado(usuario === "" ? TODOS : usuario);
    setAccionEstado(accion === "" ? TODOS : accion);
    setRango(aRango(desde, hasta));
  }, [entidad, usuario, accion, desde, hasta]);

  const opcionesUsuario = [
    { value: TODOS, label: "Todos los usuarios" },
    ...usuarios.map((fila) => ({ value: fila.id, label: fila.nombre.trim() === "" ? "Sin nombre" : fila.nombre })),
  ];

  function aplicar() {
    const busqueda = new URLSearchParams();
    if (entidadEstado !== TODOS) busqueda.set("entidad", entidadEstado);
    if (usuarioEstado !== TODOS) busqueda.set("usuario", usuarioEstado);
    if (accionEstado !== TODOS) busqueda.set("accion", accionEstado);
    if (rango?.from) busqueda.set("desde", format(rango.from, FORMATO_ISO));
    if (rango?.to) busqueda.set("hasta", format(rango.to ?? rango.from, FORMATO_ISO));

    const consulta = busqueda.toString();
    router.push(consulta === "" ? RUTA : `${RUTA}?${consulta}`);
  }

  function limpiar() {
    setEntidadEstado(TODOS);
    setUsuarioEstado(TODOS);
    setAccionEstado(TODOS);
    setRango(undefined);
    router.push(RUTA);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={usuarioEstado} onValueChange={(valor) => setUsuarioEstado(valor ?? TODOS)} items={opcionesUsuario}>
        <SelectTrigger className="w-44" aria-label="Filtrar por usuario">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {opcionesUsuario.map((opcion) => (
            <SelectItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={entidadEstado}
        onValueChange={(valor) => setEntidadEstado(valor ?? TODOS)}
        items={OPCIONES_ENTIDAD}
      >
        <SelectTrigger className="w-44" aria-label="Filtrar por entidad">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {OPCIONES_ENTIDAD.map((opcion) => (
            <SelectItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={accionEstado} onValueChange={(valor) => setAccionEstado(valor ?? TODOS)} items={OPCIONES_ACCION}>
        <SelectTrigger className="w-40" aria-label="Filtrar por acción">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {OPCIONES_ACCION.map((opcion) => (
            <SelectItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DateRangePicker value={rango} onChange={setRango} />

      <Button type="button" variant="secondary" onClick={aplicar}>
        Aplicar
      </Button>
      <Button type="button" variant="outline" onClick={limpiar}>
        Limpiar
      </Button>
    </div>
  );
}
