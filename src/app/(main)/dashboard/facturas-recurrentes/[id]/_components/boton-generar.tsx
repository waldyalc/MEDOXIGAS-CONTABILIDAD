"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { rutaFactura } from "@/lib/enlaces";
import { generarFacturaRecurrente } from "@/lib/facturas-recurrentes/acciones";

export function BotonGenerar({ id }: { id: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [facturaId, setFacturaId] = useState<string | null>(null);

  function generar() {
    setError(null);
    setFacturaId(null);

    iniciar(async () => {
      const resultado = await generarFacturaRecurrente(id);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setFacturaId(resultado.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" onClick={generar} disabled={pendiente}>
        {pendiente ? <Loader2 className="animate-spin" /> : null}
        Generar ahora
      </Button>
      {error ? (
        <Alert variant="destructive" className="max-w-sm">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {facturaId ? (
        <p className="text-muted-foreground text-sm">
          Factura generada. <Enlace href={rutaFactura(facturaId)}>Ver factura</Enlace>
        </p>
      ) : null}
    </div>
  );
}
