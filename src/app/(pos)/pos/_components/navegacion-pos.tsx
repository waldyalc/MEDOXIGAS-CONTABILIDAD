"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";
import { History, Menu, RotateCcw, ShoppingCart, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const DESTINOS_POS = [
  { href: "/pos", etiqueta: "Vender", icono: ShoppingCart },
  { href: "/pos/turnos", etiqueta: "Turnos", icono: Wallet },
  { href: "/pos/historial", etiqueta: "Historial", icono: History },
  { href: "/pos/devoluciones", etiqueta: "Devoluciones", icono: RotateCcw },
] as const;

function esActivo(pathname: string, href: string): boolean {
  return href === "/pos" ? pathname === "/pos" : pathname.startsWith(href);
}

export function NavegacionPos() {
  const pathname = usePathname();
  const actual = DESTINOS_POS.find((destino) => esActivo(pathname, destino.href)) ?? DESTINOS_POS[0];

  return (
    <>
      <nav aria-label="Navegación del punto de venta" className="hidden items-center gap-1 lg:flex">
        {DESTINOS_POS.map((destino) => {
          const activo = esActivo(pathname, destino.href);
          const Icono = destino.icono;
          return (
            <Link
              key={destino.href}
              href={destino.href}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors",
                activo
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icono className="size-4" aria-hidden="true" />
              {destino.etiqueta}
            </Link>
          );
        })}
      </nav>

      <div className="lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" className="h-10 gap-1.5">
                <Menu className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{actual.etiqueta}</span>
                <span className="sr-only sm:hidden">Menú</span>
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-48">
            {DESTINOS_POS.map((destino) => {
              const activo = esActivo(pathname, destino.href);
              const Icono = destino.icono;
              return (
                <DropdownMenuItem
                  key={destino.href}
                  render={<Link href={destino.href} />}
                  className={cn(activo && "bg-primary/10 text-primary font-medium")}
                >
                  <Icono className="size-4" aria-hidden="true" />
                  {destino.etiqueta}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
