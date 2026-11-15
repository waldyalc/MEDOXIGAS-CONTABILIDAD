"use client";

import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";

import { usePathname, useRouter } from "next/navigation";

import { cn } from "cn";
import { Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { type ParametrosLista, urlLista } from "@/lib/listas/parametros";

const ESPERA_BUSQUEDA_MS = 350;

interface Props {
  base?: string;
  parametros: ParametrosLista;
  valorInicial: string;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}

export function BuscadorLista({ base, parametros, valorInicial, placeholder, ariaLabel, className }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [texto, setTexto] = useState(valorInicial);
  const [pendiente, iniciar] = useTransition();
  const enviado = useRef(valorInicial);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ruta = base ?? pathname;

  useEffect(() => {
    setTexto(valorInicial);
    enviado.current = valorInicial;
  }, [valorInicial]);

  useEffect(() => {
    if (texto === enviado.current) return;

    temporizador.current = setTimeout(() => {
      enviado.current = texto;
      iniciar(() => {
        router.replace(urlLista(ruta, parametros, { q: texto.trim() || null, pagina: null }), { scroll: false });
      });
    }, ESPERA_BUSQUEDA_MS);

    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [texto, ruta, parametros, router]);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (temporizador.current) clearTimeout(temporizador.current);
    enviado.current = texto;
    iniciar(() => {
      router.replace(urlLista(ruta, parametros, { q: texto.trim() || null, pagina: null }), { scroll: false });
    });
  }

  return (
    <form onSubmit={enviar} className={cn("relative w-full sm:max-w-sm", className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-busy={pendiente}
        className="pl-8"
      />
      {pendiente ? (
        <Loader2 className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin" />
      ) : null}
    </form>
  );
}
