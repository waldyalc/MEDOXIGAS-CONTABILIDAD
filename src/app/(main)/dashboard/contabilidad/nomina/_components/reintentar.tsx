"use client";

import { useRouter } from "next/navigation";

import { RefreshCw } from "@/components/icons";
import { Button } from "@/components/ui/button";

/** Vuelve a pedir los datos de la pantalla sin recargar el navegador. */
export function BotonReintentar({ etiqueta = "Reintentar" }: { etiqueta?: string }) {
  const router = useRouter();

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>
      <RefreshCw data-icon="inline-start" />
      {etiqueta}
    </Button>
  );
}
