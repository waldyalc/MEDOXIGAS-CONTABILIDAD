"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const PAGINAS_NOMINA = [
  { titulo: "Datos laborales", href: "/dashboard/configuracion/nomina/laboral" },
  { titulo: "Mapeo contable", href: "/dashboard/configuracion/nomina/mapeo" },
  { titulo: "Conceptos", href: "/dashboard/configuracion/nomina/conceptos" },
  { titulo: "Parámetros legales", href: "/dashboard/configuracion/nomina/parametros" },
] as const;

/** Pestañas de navegación de la configuración de nómina: son enlaces, no estado local. */
export function TabsNomina() {
  const pathname = usePathname();
  const activa = PAGINAS_NOMINA.find((pagina) => pagina.href === pathname)?.href ?? PAGINAS_NOMINA[0].href;

  return (
    <Tabs value={activa} className="w-full">
      <TabsList variant="line" className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b pb-0">
        {PAGINAS_NOMINA.map((pagina) => (
          <TabsTrigger
            key={pagina.href}
            value={pagina.href}
            nativeButton={false}
            render={<Link href={pagina.href} prefetch={false} />}
            className="h-9 shrink-0 px-3 after:bottom-0"
          >
            {pagina.titulo}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
