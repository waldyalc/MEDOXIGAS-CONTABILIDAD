// @vitest-environment jsdom

import { act, type ComponentPropsWithoutRef } from "react";

import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ParametrosLista, ResumenPagina } from "@/lib/listas/parametros";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ prefetch: _prefetch, ...props }: ComponentPropsWithoutRef<"a"> & { prefetch?: boolean }) => (
    <a {...props} />
  ),
}));

const { opcionesConActual, paginaDesdeTexto } = await import("./barra-paginacion");
const { PaginadorLista } = await import("./paginador-lista");
const { PaginadorLocal } = await import("./paginador-local");

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RESUMEN: ResumenPagina = { pagina: 1, totalPaginas: 6, inicio: 1, fin: 30, total: 170 };
const raices: { root: Root; contenedor: HTMLDivElement }[] = [];

afterEach(async () => {
  for (const { root, contenedor } of raices.splice(0)) {
    await act(async () => root.unmount());
    contenedor.remove();
  }
  document.body.innerHTML = "";
  router.push.mockClear();
  router.replace.mockClear();
});

async function renderizarPaginador(params: ParametrosLista = {}, resumen: ResumenPagina = RESUMEN, tamano = 30) {
  const contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  const root = createRoot(contenedor);
  await act(async () => {
    root.render(
      <PaginadorLista base="/dashboard/contactos" params={params} resumen={resumen} tamano={tamano} mostrarEnVacio />,
    );
  });
  raices.push({ root, contenedor });
  return contenedor;
}

function inputPagina(contenedor: HTMLElement): HTMLInputElement {
  const input = contenedor.querySelector<HTMLInputElement>('input[aria-label="Ir a página"]');
  expect(input).not.toBeNull();
  return input as HTMLInputElement;
}

async function escribir(input: HTMLInputElement, valor: string) {
  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    if (!descriptor?.set) throw new Error("jsdom no expone el setter de value");
    descriptor.set.call(input, valor);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

async function presionarEnter(input: HTMLInputElement) {
  await act(async () => {
    input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
}

function htmlSinComentarios(html: string): string {
  return html.replace(/<!-- -->/g, "");
}

describe("PaginadorLista estilo Alegra", () => {
  it("renderiza selector, separador, rango, salto editable y flechas limpias", () => {
    const html = htmlSinComentarios(
      renderToStaticMarkup(
        <PaginadorLista base="/dashboard/contactos" params={{ tamano: "30" }} resumen={RESUMEN} mostrarEnVacio />,
      ),
    );

    expect(html).toContain("Ítems por página:");
    expect(html).toContain('aria-label="Ítems por página:"');
    expect(html).toContain('class="bg-border h-4 w-px"');
    expect(html).toContain("1-30 de 170");
    expect(html).toContain("Página");
    expect(html).toContain('aria-label="Ir a página"');
    expect(html).toContain('value="1"');
    expect(html).toContain("de 6");
    expect(html).toContain('aria-label="Página anterior"');
    expect(html).toContain('aria-label="Página siguiente"');
    expect(html).toContain("border-t");
    expect(html).toContain("py-2.5");
    expect(html).not.toContain("Mostrando");
    expect(html).not.toContain('aria-label="Primera página"');
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("Siguiente");
  });

  it("el selector conserva las seis opciones globales aunque una lista vieja pase solo 25, 50 y 100", () => {
    expect(opcionesConActual([25, 50, 100], 25)).toEqual([10, 20, 25, 30, 50, 100]);
  });

  it("acota el número escrito entre 1 y el total de páginas", () => {
    expect(paginaDesdeTexto("3", 6)).toBe(3);
    expect(paginaDesdeTexto("0004", 6)).toBe(4);
    expect(paginaDesdeTexto("0", 6)).toBe(1);
    expect(paginaDesdeTexto("999", 6)).toBe(6);
    expect(paginaDesdeTexto("", 6)).toBeNull();
    expect(paginaDesdeTexto("abc", 6)).toBeNull();
    expect(paginaDesdeTexto("2.5", 6)).toBeNull();
  });

  it("escribir una página y confirmar con Enter navega a esa página", async () => {
    const contenedor = await renderizarPaginador();
    const input = inputPagina(contenedor);

    await escribir(input, "3");
    await presionarEnter(input);

    expect(router.push).toHaveBeenCalledWith("/dashboard/contactos?pagina=3", { scroll: false });
  });

  it("confirmar al perder el foco también navega a la página escrita", async () => {
    const contenedor = await renderizarPaginador();
    const input = inputPagina(contenedor);

    await escribir(input, "2");
    await act(async () => {
      input.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true }));
    });

    expect(router.push).toHaveBeenCalledWith("/dashboard/contactos?pagina=2", { scroll: false });
  });

  it("al confirmar un número fuera de rango salta a los extremos válidos", async () => {
    const contenedor = await renderizarPaginador();
    const input = inputPagina(contenedor);

    await escribir(input, "999");
    await presionarEnter(input);

    expect(router.push).toHaveBeenCalledWith("/dashboard/contactos?pagina=6", { scroll: false });
  });

  it("al escribir cero en una página intermedia regresa a la página 1", async () => {
    const contenedor = await renderizarPaginador({}, { pagina: 2, totalPaginas: 6, inicio: 31, fin: 60, total: 170 });
    const input = inputPagina(contenedor);

    expect(input.value).toBe("2");
    await escribir(input, "0");
    await presionarEnter(input);

    expect(router.push).toHaveBeenCalledWith("/dashboard/contactos?pagina=1", { scroll: false });
  });

  it("un valor vacío o inválido restaura la página actual al perder el foco", async () => {
    const contenedor = await renderizarPaginador();
    const input = inputPagina(contenedor);

    await escribir(input, "");
    await act(async () => {
      input.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true }));
    });

    expect(input.value).toBe("1");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("elegir otro tamaño en el selector navega a la página 1 con el nuevo tamaño", async () => {
    const contenedor = await renderizarPaginador();
    const trigger = contenedor.querySelector<HTMLElement>('[aria-label="Ítems por página:"]');
    expect(trigger).not.toBeNull();

    await act(async () => trigger?.click());
    const opcion50 = [...document.body.querySelectorAll<HTMLElement>('[data-slot="select-item"]')].find(
      (item) => item.textContent?.trim() === "50",
    );
    expect(opcion50).toBeDefined();
    await act(async () => {
      const pointerDown = new window.MouseEvent("pointerdown", { bubbles: true, cancelable: true });
      Object.defineProperty(pointerDown, "pointerType", { value: "mouse" });
      opcion50?.dispatchEvent(pointerDown);
      opcion50?.click();
    });

    expect(router.push).toHaveBeenCalledWith("/dashboard/contactos?tamano=50", { scroll: false });
  });

  it("cambiar el tamaño navega a la página 1 quitando el parámetro pagina", () => {
    const fuente = readFileSync(join(process.cwd(), "src", "components", "listas", "paginador-lista.tsx"), "utf8");

    expect(fuente).toMatch(/tamano:\s*String\(nuevoTamano\),\s*pagina:\s*null/);
    expect(fuente).toContain("router.push");
  });

  it("cambia de página con Enter y también confirma al perder el foco", () => {
    const fuente = readFileSync(join(process.cwd(), "src", "components", "listas", "barra-paginacion.tsx"), "utf8");

    expect(fuente).toContain('evento.key === "Enter"');
    expect(fuente).toContain("onBlur={confirmar}");
  });
});

describe("PaginadorLocal estilo Alegra", () => {
  it("usa la misma barra y conserva el sustantivo del rango", () => {
    const html = htmlSinComentarios(
      renderToStaticMarkup(
        <PaginadorLocal
          total={170}
          pagina={0}
          setPagina={() => undefined}
          porPagina={30}
          opciones={[25, 50, 100]}
          onCambiarPorPagina={() => undefined}
          etiqueta="clientes"
        />,
      ),
    );

    expect(html).toContain("Ítems por página:");
    expect(html).toContain("1-30 de 170 clientes");
    expect(html).toContain('aria-label="Ir a página"');
    expect(html).toContain('aria-label="Página anterior"');
    expect(html).toContain('aria-label="Página siguiente"');
  });

  it("sin callback de tamaño conserva el salto editable pero oculta el selector", () => {
    const html = htmlSinComentarios(
      renderToStaticMarkup(<PaginadorLocal total={30} pagina={0} setPagina={() => undefined} porPagina={30} />),
    );

    expect(html).not.toContain("Ítems por página:");
    expect(html).toContain('aria-label="Ir a página"');
  });

  it("no muestra un paginador vacío", () => {
    expect(
      renderToStaticMarkup(<PaginadorLocal total={0} pagina={0} setPagina={() => undefined} porPagina={30} />),
    ).toBe("");
  });

  it("usePagina expone el tamaño y lo cambia volviendo a la primera página", () => {
    const fuente = readFileSync(join(process.cwd(), "src", "components", "ficha", "ficha-ui.tsx"), "utf8");

    expect(fuente).toContain("porPagina");
    expect(fuente).toContain("setPorPagina");
    expect(fuente).toMatch(/function setPorPagina[\s\S]*?setPagina\(0\)/);
  });
});
