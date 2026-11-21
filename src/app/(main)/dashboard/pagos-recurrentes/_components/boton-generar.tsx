"use client";

import { useTransition } from "react";

import { useRouter } from "next/navigation";

import { Play } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { generarPagoRecurrente } from "@/lib/pagos-recurrentes/acciones";

interface Props {
  planId: string;
  activo: boolean;
  size?: "sm" | "default";
}

export function BotonGenerar({ planId, activo, size = "sm" }: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  function generar() {
    iniciar(async () => {
      const resultado = await generarPagoRecurrente(planId);

      if (!resultado.ok) {
        toast.add({ type: "error", title: "No se pudo generar", description: resultado.error });
        return;
      }

      toast.add({
        type: resultado.mensaje === "Pago del periodo generado." ? "success" : "info",
        title: "Pago recurrente",
        description: resultado.mensaje,
      });
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" size={size} disabled={pendiente || !activo} onClick={generar}>
      <Play data-icon="inline-start" />
      {pendiente ? "Generando…" : "Generar ahora"}
    </Button>
  );
}
