import { notFound, redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import {
  listarCodigosBarra,
  listarComponentesCombo,
  listarUnidadesProducto,
} from "@/lib/inventario/ferreteria/consultas";
import { obtenerFichaProducto } from "@/lib/productos/ficha-consultas";

import { listarExistenciasFerreteria, obtenerDatosFerreteriaProducto } from "../_components/ferreteria-datos";
import { FichaProducto } from "./_components/ficha-producto";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [rol, ficha, datosFerreteria, existencias, codigosBarra, unidadesMedida, componentesCombo] = await Promise.all([
    getRol(),
    obtenerFichaProducto(id),
    obtenerDatosFerreteriaProducto(id),
    listarExistenciasFerreteria(id),
    listarCodigosBarra(id),
    listarUnidadesProducto(id),
    listarComponentesCombo(id),
  ]);

  if (rol == null) redirect("/unauthorized");
  if (!ficha) notFound();

  return (
    <FichaProducto
      key={ficha.producto.id}
      ficha={ficha}
      puedeEscribir={rol !== "lector"}
      datosFerreteria={datosFerreteria}
      existencias={existencias}
      codigosBarra={codigosBarra}
      unidadesMedida={unidadesMedida}
      componentesCombo={componentesCombo}
    />
  );
}
