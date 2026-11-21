import { notFound, redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { getRol } from "@/lib/auth/rol";
import { listarCuentasMovimiento } from "@/lib/contabilidad/consultas";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import {
  listarAlmacenesActivos,
  listarCategorias,
  listarExistenciasProducto,
  listarListasPreciosActivas,
} from "@/lib/inventario/consultas";
import {
  listarCodigosBarra,
  listarComponentesCombo,
  listarProductosParaCombo,
  listarUnidadesProducto,
} from "@/lib/inventario/ferreteria/consultas";
import { obtenerProductoEditable } from "@/lib/productos/consultas";
import { urlFirmadaImagenProducto } from "@/lib/productos/imagen";
import { createClient } from "@/lib/supabase/server";

import { obtenerDatosFerreteriaProducto } from "../../_components/ferreteria-datos";
import { FormularioProducto } from "../../_components/formulario-producto";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [
    rol,
    producto,
    categorias,
    almacenes,
    listasPrecios,
    impuestos,
    cuentas,
    existencias,
    datosFerreteria,
    codigosBarra,
    unidadesMedida,
    componentesCombo,
    productosParaCombo,
  ] = await Promise.all([
    getRol(),
    obtenerProductoEditable(id),
    listarCategorias(),
    listarAlmacenesActivos(),
    listarListasPreciosActivas(),
    getImpuestosActivos(),
    listarCuentasMovimiento(),
    listarExistenciasProducto(id),
    obtenerDatosFerreteriaProducto(id),
    listarCodigosBarra(id),
    listarUnidadesProducto(id),
    listarComponentesCombo(id),
    listarProductosParaCombo(),
  ]);

  if (rol === null) redirect("/unauthorized");
  if (!producto) notFound();
  if (rol === "lector") redirect(`/dashboard/productos/${encodeURIComponent(id)}`);

  const supabase = await createClient();
  const imagenUrl = await urlFirmadaImagenProducto(supabase, producto.imagen_path);

  return (
    <ContenedorFormulario>
      <FormularioProducto
        key={producto.id}
        producto={producto}
        categorias={categorias}
        almacenes={almacenes}
        listasPrecios={listasPrecios}
        impuestos={impuestos}
        cuentas={cuentas}
        existencias={existencias}
        imagenUrlInicial={imagenUrl}
        datosFerreteriaIniciales={{
          marca: datosFerreteria?.marca ?? "",
          favoritoPos: datosFerreteria?.favorito_pos ?? false,
          ubicacion: datosFerreteria?.ubicacion ?? "",
        }}
        codigosBarra={codigosBarra}
        unidadesMedida={unidadesMedida}
        componentesCombo={componentesCombo}
        productosParaCombo={productosParaCombo}
      />
    </ContenedorFormulario>
  );
}
