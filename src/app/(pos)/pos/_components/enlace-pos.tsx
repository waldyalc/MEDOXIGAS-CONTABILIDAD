"use client";

import { type ComponentProps, type MouseEvent, useEffect } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { limpiarNavegacionInternaPos, marcarNavegacionInternaPos } from "@/lib/pos/navegacion-interna";

import { useOfflinePOS } from "./offline-pos-provider";
import { usePosSpaOpcional } from "./pos-spa-provider";

type EnlacePosProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  externo?: boolean;
};

function abreEnOtraPestana(evento: MouseEvent<HTMLAnchorElement>): boolean {
  return evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey || evento.button !== 0;
}

export function EnlacePos({ externo = false, href, onClick, ...props }: EnlacePosProps) {
  const { estado } = useOfflinePOS();
  const spa = usePosSpaOpcional();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === href) limpiarNavegacionInternaPos();
  }, [href, pathname]);

  function alHacerClick(evento: MouseEvent<HTMLAnchorElement>) {
    if (!externo && !abreEnOtraPestana(evento)) {
      marcarNavegacionInternaPos();
      if (spa?.navegarPos(href)) {
        evento.preventDefault();
        limpiarNavegacionInternaPos();
      }
    }
    onClick?.(evento);
  }

  if (estado === "offline" && !externo) {
    // Sin red, un `<a>` abre el HTML cacheado del Service Worker: el fetch
    // RSC de `<Link>` (`?_rsc=…`) no está en caché y dejaría la navegación colgada.
    return <a {...props} href={href} onClick={alHacerClick} />;
  }

  return <Link {...props} href={href} onClick={alHacerClick} />;
}
