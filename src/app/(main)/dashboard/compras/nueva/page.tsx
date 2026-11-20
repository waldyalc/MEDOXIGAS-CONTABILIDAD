import Link from "next/link";
import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { cargarOpcionesFactura } from "@/lib/compras/consultas";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { getOrdenParaFactura } from "@/lib/ordenes-compra/consultas";

import { FormularioFactura } from "../_components/formulario-factura";

interface Props {
  searchParams: Promise<{ orden?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");
  if (rol === "lector") redirect("/dashboard/compras");

  const params = await searchParams;
  const [opciones, desdeOrden, empresa] = await Promise.all([
    cargarOpcionesFactura(),
    params.orden ? getOrdenParaFactura(params.orden) : Promise.resolve(null),
    getEmpresa(),
  ]);

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nueva factura de proveedor"
        migas={[{ etiqueta: "Compras", href: "/dashboard/compras" }, { etiqueta: "Nueva factura de proveedor" }]}
        acciones={
          <Button variant="outline" render={<Link href="/dashboard/compras/pagos" prefetch={false} />}>
            Pagos
          </Button>
        }
      />

      <FormularioFactura
        {...opciones}
        empresa={empresa}
        {...(desdeOrden
          ? { inicial: desdeOrden.inicial, ordenId: desdeOrden.ordenId, numeroOrden: desdeOrden.numero }
          : {})}
      />
    </ContenedorFormulario>
  );
}
