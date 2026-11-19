import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getPerfil } from "@/lib/auth/rol";
import { listarCuentasMovimiento } from "@/lib/contabilidad/consultas";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { listarAlmacenesActivos, listarCategorias, listarListasPreciosActivas } from "@/lib/inventario/consultas";

import { FormularioProducto } from "../_components/formulario-producto";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const [categorias, almacenes, listasPrecios, impuestos, cuentas] = await Promise.all([
    listarCategorias(),
    listarAlmacenesActivos(),
    listarListasPreciosActivas(),
    getImpuestosActivos(),
    listarCuentasMovimiento(),
  ]);

  if (perfil.rol === "lector") {
    return (
      <ContenedorFormulario>
        <EncabezadoPagina
          titulo="Nuevo producto"
          migas={[{ etiqueta: "Productos", href: "/dashboard/productos" }, { etiqueta: "Nuevo producto" }]}
        />
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear productos.</AlertDescription>
        </Alert>
      </ContenedorFormulario>
    );
  }

  return (
    <ContenedorFormulario>
      <FormularioProducto
        producto={null}
        categorias={categorias}
        almacenes={almacenes}
        listasPrecios={listasPrecios}
        impuestos={impuestos}
        cuentas={cuentas}
        existencias={[]}
        imagenUrlInicial={null}
      />
    </ContenedorFormulario>
  );
}
