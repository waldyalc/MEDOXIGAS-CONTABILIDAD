import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ExistenciaAlmacen } from "@/lib/inventario/tipos";
import type { ProductoEditable } from "@/lib/productos/consultas";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/productos/actions", () => ({
  actualizarProducto: vi.fn(),
  crearProducto: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

const { FormularioProducto } = await import("./formulario-producto");

const producto: ProductoEditable = {
  id: "11111111-1111-4111-8111-111111111111",
  nombre: "Producto captura ER",
  tipo: "producto",
  referencia: "ER-1",
  descripcion: null,
  precio: 1500,
  itbis_tasa: 18,
  impuesto_id: null,
  inventariable: true,
  cantidad: 12.5,
  costo: 900,
  categoria_id: null,
  precios: [],
  activo: true,
  unidad_medida: "Unidad",
  almacen_id: "33333333-3333-4333-8333-333333333333",
  vende_negativo: false,
  imagen_path: null,
  cuenta_ingreso_id: null,
  cuenta_inventario_id: null,
  cuenta_costo_id: null,
};

const almacen = {
  id: "33333333-3333-4333-8333-333333333333",
  nombre: "Principal",
  es_principal: true,
  activo: true,
};

function formulario(editable: ProductoEditable | null, existencias: ExistenciaAlmacen[] = []) {
  return renderToStaticMarkup(
    <FormularioProducto
      producto={editable}
      categorias={[]}
      almacenes={[almacen]}
      listasPrecios={[]}
      impuestos={[]}
      cuentas={[]}
      existencias={existencias}
      imagenUrlInicial={null}
    />,
  );
}

describe("FormularioProducto", () => {
  it("en edición llama «Cantidad inicial» al campo, como Alegra", () => {
    const html = formulario(producto, [
      {
        almacen_id: almacen.id,
        almacen_nombre: almacen.nombre,
        es_principal: true,
        cantidad: 10,
        cantidad_inicial: 12.5,
        minimo: 0,
        maximo: null,
      },
    ]);

    expect(html).toContain("Cantidad inicial");
    expect(html).not.toContain("Cantidad actual");
    expect(html).toContain('name="cantidad"');
    expect(html).toContain('value="12.5"');
  });

  it("en edición avisa que el asiento de inventario inicial se ajusta al guardar", () => {
    expect(formulario(producto)).toContain("Al guardar, el asiento de inventario inicial se ajusta automáticamente.");
  });

  it("al crear mantiene la ayuda de la cantidad inicial y su asiento", () => {
    const html = formulario(null);

    expect(html).toContain("Cantidad inicial");
    expect(html).toContain("La cantidad inicial entra al almacén elegido al guardar.");
  });
});
