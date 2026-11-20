"use client";

import { useRouter } from "next/navigation";

import { DatePicker } from "@/components/date-picker";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { leerTexto, type ParametrosLista, urlLista } from "@/lib/listas/parametros";

const TODAS = "__todas";
const TODOS = "__todos";

export function FiltrosHistorial({
  params,
  desde,
  hasta,
  terminales,
}: {
  params: ParametrosLista;
  desde: string;
  hasta: string;
  terminales: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const estado = leerTexto(params, "estado");
  const terminal = leerTexto(params, "terminal");

  function cambiar(cambios: Record<string, string | null>) {
    router.replace(urlLista("/pos/historial", params, { ...cambios, pagina: null }), { scroll: false });
  }

  return (
    <>
      <BuscadorLista
        parametros={params}
        valorInicial={leerTexto(params, "q")}
        placeholder="Buscar por NCF, número o cliente…"
        ariaLabel="Buscar ventas del POS"
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Desde</Label>
          <DatePicker
            value={desde}
            onChange={(valor) => cambiar({ desde: valor || null, limpio: null })}
            placeholder="Desde"
            className="h-10 w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Hasta</Label>
          <DatePicker
            value={hasta}
            onChange={(valor) => cambiar({ hasta: valor || null, limpio: null })}
            placeholder="Hasta"
            className="h-10 w-[150px]"
          />
        </div>

        <Select
          items={[
            { value: TODOS, label: "Todas" },
            { value: "pagada", label: "Cobradas" },
            { value: "abierta", label: "Por cobrar" },
            { value: "anulada", label: "Anuladas" },
          ]}
          value={estado === "" ? TODOS : estado}
          onValueChange={(valor) => cambiar({ estado: valor === TODOS ? null : valor })}
        >
          <SelectTrigger className="h-10 w-[150px]" aria-label="Estado de la factura">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value={TODOS}>Todas</SelectItem>
            <SelectItem value="pagada">Cobradas</SelectItem>
            <SelectItem value="abierta">Por cobrar</SelectItem>
            <SelectItem value="anulada">Anuladas</SelectItem>
          </SelectContent>
        </Select>

        <Select
          items={[
            { value: TODAS, label: "Todas las terminales" },
            ...terminales.map((item) => ({ value: item.id, label: item.nombre })),
          ]}
          value={terminal === "" ? TODAS : terminal}
          onValueChange={(valor) => cambiar({ terminal: valor === TODAS ? null : valor })}
        >
          <SelectTrigger className="h-10 w-[190px]" aria-label="Terminal de la venta">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value={TODAS}>Todas las terminales</SelectItem>
            {terminales.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          className="h-10"
          onClick={() => router.replace("/pos/historial?limpio=1", { scroll: false })}
        >
          Limpiar filtros
        </Button>
      </div>
    </>
  );
}
