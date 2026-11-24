import { describe, expect, it } from "vitest";

import {
  type CatalogoOffline,
  cargarCatalogoCompletoOffline,
  type RespuestaLoteCatalogo,
} from "./cache-catalogo-offline";
import type { ProductoPOS } from "./tipos";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const VENDER = join(process.cwd(), "src", "app", "(pos)", "pos", "_components", "vender", "vender-pos.tsx");

function producto(indice: number): ProductoPOS {
  return {
    producto_id: `producto-${indice}`,
    nombre: `Producto ${indice}`,
    referencia: null,
    marca: null,
    tipo: "producto",
    categoria_id: null,
    favorito_pos: false,
    imagen_path: null,
    unidad_medida: "Unidad",
    precio: "100.00",
    itbis_tasa: "18",
    stock: "10",
    disponible: "10",
    unidades: [],
  };
}

function catalogo(cantidad: number): ProductoPOS[] {
  return Array.from({ length: cantidad }, (_, indice) => producto(indice));
}

/**
 * Candado del bug #2 de la auditoría offline: la descarga del catálogo no
 * puede truncarse en 50 productos si la red cae a mitad. Se acumula en
 * memoria y se guarda una sola vez, al recibir el último lote.
 */
describe("catálogo completo para trabajar sin conexión", () => {
  it("acumula 120 productos en tres lotes y guarda una sola vez, completo", async () => {
    const productos = catalogo(120);
    const offsets: number[] = [];
    const guardados: CatalogoOffline[] = [];

    const completo = await cargarCatalogoCompletoOffline({
      obtenerLote: async (offset, limit) => {
        offsets.push(offset);
        return { ok: true, data: productos.slice(offset, offset + limit) };
      },
      guardar: async (valor) => {
        guardados.push(valor);
      },
      ahora: () => "2026-11-24T10:00:00.000Z",
    });

    expect(completo).toBe(true);
    expect(offsets, "Debe pedir los lotes 0, 50 y 100, en ese orden").toEqual([0, 50, 100]);
    expect(guardados, "Guardar una sola vez evita dejar el caché a medias").toHaveLength(1);
    expect(guardados[0]?.productos, "El caché completo tiene los 120 productos").toHaveLength(120);
    expect(guardados[0]?.productos[119]?.producto_id).toBe("producto-119");
    expect(guardados[0]?.completo).toBe(true);
    expect(guardados[0]?.actualizado).toBe("2026-11-24T10:00:00.000Z");
  });

  it("si el segundo lote falla no guarda y deja intacto el catálogo completo previo", async () => {
    const productos = catalogo(120);
    const previo: CatalogoOffline = {
      productos: catalogo(80),
      actualizado: "2026-11-20T10:00:00.000Z",
      completo: true,
    };
    const almacen = new Map<string, CatalogoOffline>([["catalogo", previo]]);

    const completo = await cargarCatalogoCompletoOffline({
      obtenerLote: async (offset, limit): Promise<RespuestaLoteCatalogo> => {
        if (offset === 0) return { ok: true, data: productos.slice(0, limit) };
        return { ok: false, error: "Sin conexión" };
      },
      guardar: async (valor) => {
        almacen.set("catalogo", valor);
      },
    });

    expect(completo).toBe(false);
    expect(almacen.get("catalogo"), "El catálogo previo de 80 productos sigue igual").toBe(previo);
    expect(previo.productos).toHaveLength(80);
  });

  it("si la red lanza una excepción a mitad tampoco guarda", async () => {
    const productos = catalogo(120);
    let llamadas = 0;

    const completo = await cargarCatalogoCompletoOffline({
      obtenerLote: async (offset, limit) => {
        llamadas += 1;
        if (offset === 0) return { ok: true, data: productos.slice(0, limit) };
        throw new Error("Se cortó la red");
      },
      guardar: async () => {
        llamadas += 100;
      },
    });

    expect(completo).toBe(false);
    expect(llamadas, "Solo se pidieron dos lotes y nunca se guardó").toBe(2);
  });

  it("si la pantalla dejó de estar vigente a mitad, no guarda", async () => {
    const productos = catalogo(120);
    let vigente = true;
    let guardados = 0;

    const completo = await cargarCatalogoCompletoOffline({
      obtenerLote: async (offset, limit) => {
        const respuesta = { ok: true, data: productos.slice(offset, offset + limit) } as const;
        if (offset === 50) vigente = false;
        return respuesta;
      },
      guardar: async () => {
        guardados += 1;
      },
      sigueVigente: () => vigente,
    });

    expect(completo).toBe(false);
    expect(guardados).toBe(0);
  });

  it("vender-pos descarga el catálogo completo y no reinicia la descarga en cada refresh", () => {
    const vender = readFileSync(VENDER, "utf8");

    expect(
      vender,
      "La preparación del caché debe usar cargarCatalogoCompletoOffline, no guardar lote por lote",
    ).toContain("cargarCatalogoCompletoOffline");
    expect(vender, "No vuelve el bucle que guardaba cada lote a medias").not.toContain(
      "completo: respuesta.data.length < TAMANO_LOTE",
    );
    expect(
      vender,
      "El efecto del catálogo depende solo de ámbito, terminal y lista: router.refresh() no puede reiniciar la descarga",
    ).toContain("}, [ambito, terminal.id, listaPrecioId]);");
  });

  it("el cliente recién creado se guarda en el estado local y en IndexedDB", () => {
    const vender = readFileSync(VENDER, "utf8");

    expect(vender, "vender-pos debe recibir el contacto creado desde el panel").toContain("onContactoCreado");
    expect(vender, "El contacto nuevo entra a la lista del POS sin duplicar").toContain(
      "setListaContactos(actualizados)",
    );
    expect(vender, "El contacto nuevo se persiste de inmediato en IndexedDB").toContain(
      'guardarOffline("contactos", ambito, actualizados)',
    );
    expect(vender, "El POS debe pintar la lista local de contactos, no la prop del servidor").not.toMatch(
      /<PanelFactura[\s\S]{0,900}?contactos=\{contactos\}/,
    );
  });
});
