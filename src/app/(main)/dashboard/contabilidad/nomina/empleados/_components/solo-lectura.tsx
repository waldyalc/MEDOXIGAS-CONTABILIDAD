import Link from "next/link";

import { ShieldAlert } from "@/components/icons";
import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Tarjeta para un `lector` que abre el formulario por URL directa. */
export function SoloLecturaEmpleado({ volverA, titulo }: { volverA: string; titulo: string }) {
  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo={titulo}
        subtitulo="Registra los datos personales, el contrato y la forma de pago."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
          { etiqueta: "Nómina", href: "/dashboard/contabilidad/nomina" },
          { etiqueta: "Empleados", href: "/dashboard/contabilidad/nomina/empleados" },
          { etiqueta: titulo },
        ]}
      />
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <ShieldAlert className="text-muted-foreground size-10" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Solo lectura</h2>
          <p className="text-muted-foreground max-w-md text-sm">
            Tu perfil no puede crear ni editar empleados. Un administrador o contador puede hacerlo.
          </p>
          <Button variant="outline" className="mt-2" render={<Link href={volverA} prefetch={false} />}>
            Volver
          </Button>
        </CardContent>
      </Card>
    </ContenedorFormulario>
  );
}
