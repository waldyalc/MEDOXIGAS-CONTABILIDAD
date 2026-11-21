"use client";

import { useRouter } from "next/navigation";

import { DatePicker } from "@/components/date-picker";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { leerTexto, type ParametrosLista, urlLista } from "@/lib/listas/parametros";

const TODOS = "__todos";

export function FiltrosDevoluciones({
  params,
  desde,
  hasta,
}: {
  params: ParametrosLista;
  desde: string;
  hasta: string;
}) {
  const router = useRouter();
  const estado = leerTexto(params, "estado");

  function cambiar(cambios: Record<string, string | null>) {
    router.replace(urlLista("/pos/devoluciones", params, { ...cambios, pagina: null }), { scroll: false });
  }

  return (
    <>
      <BuscadorLista
        parametros={params}
        valorInicial={leerTexto(params, "q")}
        placeholder="Buscar por NCF, factura o cliente…"
        ariaLabel="Buscar devoluciones del POS"
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
            { value: "activa", label: "Activas" },
            { value: "anulada", label: "Anuladas" },
          ]}
          value={estado === "" ? TODOS : estado}
          onValueChange={(valor) => cambiar({ estado: valor === TODOS ? null : valor })}
        >
          <SelectTrigger className="h-10 w-[150px]" aria-label="Estado de la devolución">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value={TODOS}>Todas</SelectItem>
            <SelectItem value="activa">Activas</SelectItem>
            <SelectItem value="anulada">Anuladas</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          className="h-10"
          onClick={() => router.replace("/pos/devoluciones?limpio=1", { scroll: false })}
        >
          Limpiar filtros
        </Button>
      </div>
    </>
  );
}
