import Link from "next/link";

import { DatabaseZap, MonitorCog, Store } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Pantallas completas cuando el POS no está instalado o no tiene terminales. */
export function EstadoPos({ tipo }: { tipo: "no-instalado" | "sin-terminales" | "error" }) {
  const contenido = {
    "no-instalado": {
      icono: <DatabaseZap className="text-muted-foreground size-10" />,
      titulo: "El punto de venta no está instalado en esta base de datos.",
      descripcion: "Aplica la migración del POS para habilitarlo.",
      accion: (
        <Button render={<Link href="/dashboard" />} variant="outline">
          Volver a Contabilidad
        </Button>
      ),
    },
    "sin-terminales": {
      icono: <Store className="text-muted-foreground size-10" />,
      titulo: "No hay terminales de punto de venta configuradas.",
      descripcion: "Configura la primera terminal con su almacén, cajón y numeración.",
      accion: (
        <Button render={<Link href="/dashboard/configuracion/pos" target="_blank" rel="noreferrer" />}>
          Configurar terminal
        </Button>
      ),
    },
    error: {
      icono: <MonitorCog className="text-muted-foreground size-10" />,
      titulo: "No se pudo conectar con el servidor.",
      descripcion: "Revisa tu conexión e inténtalo de nuevo.",
      accion: (
        <Button render={<Link href="/pos" />} variant="outline">
          Reintentar
        </Button>
      ),
    },
  }[tipo];

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-6">
      <div className="border-border bg-card flex max-w-md flex-col items-center gap-3 rounded-2xl border p-8 text-center">
        {contenido.icono}
        <h1 className="text-lg font-semibold">{contenido.titulo}</h1>
        <p className="text-muted-foreground text-sm">{contenido.descripcion}</p>
        <div className="pt-2">{contenido.accion}</div>
      </div>
    </div>
  );
}
