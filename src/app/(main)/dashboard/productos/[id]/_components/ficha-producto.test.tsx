import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CodigoBarra, ComponenteCombo, UnidadMedida } from "@/lib/inventario/ferreteria/tipos";
import type { FichaProducto as DatosFichaProducto } from "@/lib/productos/ficha";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/adjuntos/acciones", () => ({
  borrarAdjunto: vi.fn(),
  descargarAdjunto: vi.fn(),
  registrarAdjunto: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

const { FichaProducto } = await import("./ficha-producto");

const ficha: DatosFichaProducto = {
  producto: {
    id: "11111111-1111-4111-8111-111111111111",
    nombre: "Cemento gris 42.5 kg",
    referencia: "CEM-42",
    descripcion: null,
    tipo: "producto",
    categoriaNombre: "Construcción",
    activo: true,
    inventariable: true,
    precio: 650,
    itbis_tasa: 18,
    costo: 390,
    cantidad: 50,
    unidadMedida: "Libra",
    almacenId: null,
    vendeNegativo: false,
    imagenPath: null,
    imagenUrl: null,
    precios: [],
    cuentaIngresoId: null,
    cuentaInventarioId: null,
    cuentaCostoId: null,
  },
  cuentas: { ingreso: null, inventario: null, costo: null },
  facturasVenta: [],
  facturasCompra: [],
  cotizaciones: [],
  conduces: [],
  existencias: [],
  kardex: { existenciaInicial: 50, filas: [] },
  adjuntos: [],
};

const unidad: UnidadMedida = {
  id: "44444444-4444-4444-8444-444444444444",
  producto_id: ficha.producto.id,
  nombre: "Saco 50 kg",
  factor_base: "50",
  precio: "30000.00",
  es_compra: true,
  es_venta: true,
  activa: true,
  creado_en: "2026-11-20T00:00:00Z",
};

const codigo: CodigoBarra = {
  id: "55555555-5555-4555-8555-555555555555",
  producto_id: ficha.producto.id,
  unidad_id: unidad.id,
  codigo: "7501234567890",
  principal: true,
  creado_en: "2026-11-20T00:00:00Z",
};

const componente: ComponenteCombo = {
  id: "66666666-6666-4666-8666-666666666666",
  combo_id: ficha.producto.id,
  componente_id: "77777777-7777-4777-8777-777777777777",
  componente_nombre: "Tornillo 2 pulgadas",
  componente_tipo: "producto",
  inventariable: true,
  cantidad: "2",
};

function fichaCon(datos: Partial<DatosFichaProducto["producto"]> = {}) {
  return { ...ficha, producto: { ...ficha.producto, ...datos } };
}

function fichaRender(datos: Partial<DatosFichaProducto["producto"]> = {}, puedeEscribir = true) {
  return renderToStaticMarkup(
    <FichaProducto
      ficha={fichaCon(datos)}
      puedeEscribir={puedeEscribir}
      datosFerreteria={{ marca: "Oximat", favorito_pos: true, ubicacion: "Pasillo 3, estante B" }}
      existencias={[
        {
          almacen_id: "33333333-3333-4333-8333-333333333333",
          almacen_nombre: "Principal",
          es_principal: true,
          ubicacion: "Pasillo 3",
          cantidad: 50,
          cantidad_inicial: 50,
          minimo: 10,
          maximo: 100,
        },
      ]}
      codigosBarra={[codigo]}
      unidadesMedida={[unidad]}
      componentesCombo={[componente]}
    />,
  );
}

describe("FichaProducto", () => {
  it("usa EncabezadoPagina con migas y muestra los datos de ferretería", () => {
    const html = fichaRender();

    expect(html).toContain("Productos");
    expect(html).toContain("Marca");
    expect(html).toContain("Oximat");
    expect(html).toContain("Ubicación por defecto");
    expect(html).toContain("Pasillo 3, estante B");
    expect(html).toContain("Favorito POS");
  });

  it("ofrece las pestañas Datos, Códigos, Unidades y Existencias", () => {
    const html = fichaRender();

    for (const pestana of ["Datos", "Códigos", "Unidades", "Existencias"]) {
      expect(html).toContain(`${pestana}<span class="bg-primary`);
    }
    expect(html).not.toContain(`Combo<span class="bg-primary`);
  });

  it("la pestaña Combo solo existe para un combo", () => {
    expect(fichaRender({ tipo: "combo" })).toContain(`Combo<span class="bg-primary`);
  });

  it("sin permiso de escritura no muestra Editar producto y avisa «Solo lectura»", () => {
    const html = fichaRender({}, false);

    expect(html).not.toContain("Editar producto");
    expect(html).toContain("Solo lectura");
  });
});
