import { describe, expect, it } from "vitest";

import {
  alternarFavoritoPOS,
  CLAVE_FAVORITOS_POS,
  esFavoritoPOS,
  type FavoritosPOS,
  filtrarFavoritosPOS,
  guardarFavoritosPOS,
  leerFavoritosPOS,
} from "./favoritos";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function almacen(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => {
      datos.set(clave, valor);
    },
    datos,
  };
}

function producto(productoId: string, favoritoPos = false) {
  return { producto_id: productoId, favorito_pos: favoritoPos, nombre: productoId };
}

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf8");

describe("favoritos del POS (MSG-31)", () => {
  it("lee localStorage con una clave versionada y descarta lo que no sea un mapa de booleanos", () => {
    expect(CLAVE_FAVORITOS_POS).toBe("pos:favoritos:v1");

    const guardado = almacen({
      [CLAVE_FAVORITOS_POS]: JSON.stringify({ productoUno: true, productoDos: false }),
    });
    expect(leerFavoritosPOS(guardado)).toEqual({ productoUno: true, productoDos: false });

    for (const crudo of ["", "no es json", "[]", "null", '"texto"', '{"a":"sí","b":1," ":true}']) {
      const roto = almacen({ [CLAVE_FAVORITOS_POS]: crudo });
      expect(leerFavoritosPOS(roto), `«${crudo}» debe degradar a un mapa vacío`).toEqual({});
    }
    expect(leerFavoritosPOS(null)).toEqual({});
  });

  it("no rompe la pantalla si localStorage falla al leer o al guardar", () => {
    const roto = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("cuota llena");
      },
    };
    expect(leerFavoritosPOS(roto)).toEqual({});
    expect(() => guardarFavoritosPOS(roto, { a: true })).not.toThrow();
  });

  it("el favorito local manda sobre el global y alterna en ambos sentidos", () => {
    const global = producto("global", true);

    expect(esFavoritoPOS({}, global), "sin marca local se usa favorito_pos").toBe(true);
    expect(esFavoritoPOS({ global: false }, global), "la marca local puede desmarcar el global").toBe(false);
    expect(esFavoritoPOS({ global: true }, producto("global")), "la marca local puede marcar un producto").toBe(true);

    const desmarcado = alternarFavoritoPOS({}, global);
    expect(desmarcado).toEqual({ global: false });
    expect(esFavoritoPOS(desmarcado, global)).toBe(false);

    const remarcado = alternarFavoritoPOS(desmarcado, global);
    expect(esFavoritoPOS(remarcado, global)).toBe(true);
    expect(remarcado.otro, "alternar no borra los demás favoritos").toBeUndefined();
  });

  it("el filtro «Favoritos» muestra solo lo marcado y conserva el orden del catálogo", () => {
    const productos = [
      producto("local", false),
      producto("global", true),
      producto("desmarcado", true),
      producto("ninguno", false),
    ];
    const locales: FavoritosPOS = { local: true, desmarcado: false };

    expect(filtrarFavoritosPOS(productos, locales).map((item) => item.producto_id)).toEqual(["local", "global"]);
    expect(filtrarFavoritosPOS(productos, {}).map((item) => item.producto_id)).toEqual(["global", "desmarcado"]);
  });

  it("la tarjeta usa el cuadro de marca con estrella y el clic no agrega al carrito", () => {
    const tarjeta = leer("src/app/(pos)/pos/_components/vender/tarjeta-producto-pos.tsx");

    expect(tarjeta).toContain("aria-pressed={favorito}");
    expect(tarjeta).toContain("evento.stopPropagation()");
    expect(tarjeta).toContain("onFavorito(producto)");
    expect(tarjeta).toMatch(/`Quitar \$\{producto\.nombre\} de favoritos`/);
    expect(tarjeta).toMatch(/`Marcar \$\{producto\.nombre\} como favorito`/);
    expect(tarjeta, "la estrella marcada usa la variante rellena de Tabler").toContain(
      'fill={favorito ? "currentColor" : "none"}',
    );
    expect(
      tarjeta,
      "el relleno va por la prop `fill` del ícono: `fill-white`/`fill-current` (clases Tailwind) no rellenan el svg",
    ).not.toMatch(/fill-white|fill-current/);
    expect(tarjeta, "el cuadro de marca usa tokens --pos-* y mide 32 px para el tacto").toContain("bg-pos-primario");
    expect(tarjeta).toContain("size-8");
    expect(tarjeta, "no vuelvas al teal suelto #30aba9").not.toContain("#30aba9");
    expect(tarjeta, "el POS no toma --primary directo: usa tokens pos-*").not.toMatch(
      /--primary|bg-primary|text-primary/,
    );
  });

  it("el catálogo conecta la estrella y Vender filtra con la capa local", () => {
    const catalogo = leer("src/app/(pos)/pos/_components/vender/catalogo-pos.tsx");
    expect(catalogo).toContain("favorito={esFavorito(producto)}");
    expect(catalogo).toContain("onFavorito={onFavorito}");

    const vender = leer("src/app/(pos)/pos/_components/vender/vender-pos.tsx");
    expect(vender).toContain("filtrarFavoritosPOS(catalogo, favoritosLocales)");
    expect(vender, "el filtro ya no puede delegar solo al favorito global del servidor").not.toContain(
      "solo_favoritos: favoritos",
    );

    const hook = leer("src/app/(pos)/pos/_components/vender/use-favoritos-pos.ts");
    expect(hook).toContain("window.localStorage");
    expect(hook).toContain("leerFavoritosPOS");
  });
});
