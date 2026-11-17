import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { getNumeraciones } from "@/lib/numeraciones/consultas";

import { NumeracionesCliente } from "./_components/numeraciones-cliente";

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const numeraciones = await getNumeraciones();

  return (
    <ContenedorLista>
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/contabilidad" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Contabilidad
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Numeraciones</h1>
          <p className="text-muted-foreground text-sm">
            Secuencias del NCF por tipo de comprobante. El siguiente número se asigna al guardar cada documento.
          </p>
        </div>
      </div>

      <NumeracionesCliente numeraciones={numeraciones} puedeEditar={rol !== "lector"} />
    </ContenedorLista>
  );
}
