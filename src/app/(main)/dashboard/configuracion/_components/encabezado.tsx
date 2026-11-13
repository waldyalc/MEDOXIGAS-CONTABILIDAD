import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EncabezadoConfiguracion({
  titulo,
  descripcion,
}: {
  readonly titulo: string;
  readonly descripcion: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={<Link href="/dashboard/configuracion" prefetch={false} />}
      >
        <ArrowLeft data-icon="inline-start" />
        Configuración
      </Button>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl tracking-tight">{titulo}</h1>
        <p className="text-muted-foreground text-sm text-balance">{descripcion}</p>
      </div>
    </div>
  );
}
