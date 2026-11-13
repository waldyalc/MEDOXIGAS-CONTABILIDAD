import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { cargarOpcionesFactura } from "@/lib/compras/consultas";
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
  const [opciones, desdeOrden] = await Promise.all([
    cargarOpcionesFactura(),
    params.orden ? getOrdenParaFactura(params.orden) : Promise.resolve(null),
  ]);

  return (
    <FormularioFactura
      {...opciones}
      {...(desdeOrden
        ? { inicial: desdeOrden.inicial, ordenId: desdeOrden.ordenId, numeroOrden: desdeOrden.numero }
        : {})}
    />
  );
}
