"use client";

import { useRouter } from "next/navigation";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Vuelve a pedir los datos del servidor cuando una pantalla no pudo cargar. */
export function BotonReintentar({ etiqueta = "Reintentar" }: { etiqueta?: string }) {
  const router = useRouter();

  return (
    <Button type="button" variant="outline" onClick={() => router.refresh()}>
      <RefreshCw />
      {etiqueta}
    </Button>
  );
}
