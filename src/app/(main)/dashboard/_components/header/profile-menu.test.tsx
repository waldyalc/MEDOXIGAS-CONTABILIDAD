import type { ReactNode } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, render }: { children?: ReactNode; render?: { props?: { href?: string } } }) => {
    const href = render?.props?.href;
    if (href) return <a href={href}>{children}</a>;
    return <button type="button">{children}</button>;
  },
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@/stores/preferences/preferences-provider", () => ({
  usePreferencesStore: (selector: (estado: unknown) => unknown) =>
    selector({
      values: { theme_mode: "light" },
      resolvedThemeMode: "light",
      setPreference: vi.fn(),
    }),
}));

vi.mock("@/app/login/actions", () => ({
  salir: vi.fn(),
}));

vi.mock("@/lib/cache-pos", () => ({
  limpiarCachePOS: vi.fn(),
}));

const { ProfileMenu } = await import("./profile-menu");

function renderizar(rol: "admin" | "contador" | "lector" = "admin") {
  return renderToStaticMarkup(<ProfileMenu nombre="Waldy Alcántara" correo="waldyalcantara818@gmail.com" rol={rol} />);
}

describe("ProfileMenu", () => {
  it("renderiza iniciales, nombre, correo, rol y Cerrar sesión", () => {
    const html = renderizar();

    expect(html).toContain("WA");
    expect(html).toContain("Waldy Alcántara");
    expect(html).toContain("waldyalcantara818@gmail.com");
    expect(html).toContain("Administrador");
    expect(html).toContain("Cerrar sesión");
  });

  it("incluye los enlaces de configuración, usuarios, auditoría y perfil para admin", () => {
    const html = renderizar("admin");

    expect(html).toContain('href="/dashboard/configuracion"');
    expect(html).toContain('href="/dashboard/configuracion/usuarios"');
    expect(html).toContain('href="/dashboard/configuracion/auditoria"');
    expect(html).toContain('href="/dashboard/perfil"');
    expect(html).toContain("Configuración");
    expect(html).toContain("Usuarios");
    expect(html).toContain("Auditoría");
    expect(html).toContain("Mi perfil y seguridad");
  });

  it("oculta Usuarios cuando el rol no es admin", () => {
    const html = renderizar("contador");

    expect(html).not.toContain('href="/dashboard/configuracion/usuarios"');
    expect(html).not.toContain(">Usuarios<");
    expect(html).toContain("Contador");
    expect(html).toContain('href="/dashboard/perfil"');
  });

  it("no muestra Empresas ni Facturación electrónica", () => {
    const html = renderizar();

    expect(html).not.toContain("Empresas");
    expect(html).not.toContain("Facturación electrónica");
  });

  it("muestra el control Claro/Oscuro bajo TEMA", () => {
    const html = renderizar();
    const indiceTema = html.indexOf("TEMA");

    expect(indiceTema).toBeGreaterThan(-1);
    expect(html.indexOf("Claro")).toBeGreaterThan(indiceTema);
    expect(html.indexOf("Oscuro")).toBeGreaterThan(indiceTema);
    expect(html).toContain('aria-pressed="true"');
  });
});
