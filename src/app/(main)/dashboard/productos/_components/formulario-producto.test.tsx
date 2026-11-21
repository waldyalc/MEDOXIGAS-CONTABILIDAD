import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CodigoBarra, ComponenteCombo, UnidadMedida } from "@/lib/inventario/ferreteria/tipos";
import type { ExistenciaAlmacen } from "@/lib/inventario/tipos";
import type { ProductoEditable } from "@/lib/productos/consultas";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/productos/actions", () => ({
  actualizarProducto: vi.fn(),
  crearProducto: vi.fn(),
}));

vi.mock("@/lib/inventario/ferreteria/acciones", () => ({
  guardarCodigosBarra: vi.fn(),
  guardarDatosFerreteriaProducto: vi.fn(),
  guardarRecetaCombo: vi.fn(),
  guardarUnidadesProducto: vi.fn(),
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

const unidad: UnidadMedida = {
  id: "44444444-4444-4444-8444-444444444444",
  producto_id: producto.id,
  nombre: "Caja 50 lb",
  factor_base: "50",
  precio: "7500.00",
  es_compra: true,
  es_venta: true,
  activa: true,
  creado_en: "2026-11-20T00:00:00Z",
};

const codigo: CodigoBarra = {
  id: "55555555-5555-4555-8555-555555555555",
  producto_id: producto.id,
  unidad_id: unidad.id,
  codigo: "7501234567890",
  principal: true,
  creado_en: "2026-11-20T00:00:00Z",
};

const componente: ComponenteCombo = {
  id: "66666666-6666-4666-8666-666666666666",
  combo_id: producto.id,
  componente_id: "77777777-7777-4777-8777-777777777777",
  componente_nombre: "Tornillo 2 pulgadas",
  componente_tipo: "producto",
  inventariable: true,
  cantidad: "2",
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
      datosFerreteriaIniciales={{ marca: "Oximat", favoritoPos: true, ubicacion: "Pasillo 3, estante B" }}
      codigosBarra={[codigo]}
      unidadesMedida={[unidad]}
      componentesCombo={[componente]}
      productosParaCombo={[]}
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

  it("precarga marca, ubicación, códigos de barra y unidades de ferretería", () => {
    const html = formulario(producto);

    expect(html).toContain('value="Oximat"');
    expect(html).toContain('value="Pasillo 3, estante B"');
    expect(html).toContain('value="7501234567890"');
    expect(html).toContain('value="Caja 50 lb"');
    expect(html).toContain("Códigos de barra");
    expect(html).toContain("Unidades de medida");
  });

  it("solo muestra la receta del combo cuando el producto es un combo", () => {
    expect(formulario(producto)).not.toContain("Receta del combo");

    const combo: ProductoEditable = { ...producto, tipo: "combo" };
    const html = formulario(combo);

    expect(html).toContain("Receta del combo");
    expect(html).toContain('aria-label="Cantidad del componente 1"');
  });
});
