import { cn } from "cn";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const COLORES = ["#1e56c7", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#0369a1", "#4d7c0f", "#a21caf"] as const;

function inicial(nombre: string | null | undefined, correo: string | null | undefined) {
  const fuente = nombre?.trim() || correo?.trim() || "";
  return fuente.charAt(0).toUpperCase() || "?";
}

function colorDe(nombre: string | null | undefined, correo: string | null | undefined) {
  const fuente = nombre?.trim() || correo?.trim() || "?";
  let suma = 0;
  for (const caracter of fuente) suma = (suma + (caracter.codePointAt(0) ?? 0)) % 997;
  return COLORES[suma % COLORES.length] ?? COLORES[0];
}

export function AvatarInicial({
  nombre,
  correo,
  size = "default",
  className,
}: {
  readonly nombre?: string | null;
  readonly correo?: string | null;
  readonly size?: "default" | "sm" | "lg";
  readonly className?: string;
}) {
  const etiqueta = nombre?.trim() || correo?.trim() || "Usuario";
  return (
    <Avatar size={size} className={cn("text-white", className)} style={{ backgroundColor: colorDe(nombre, correo) }}>
      <AvatarFallback aria-label={etiqueta} className="bg-transparent font-semibold text-white">
        {inicial(nombre, correo)}
      </AvatarFallback>
    </Avatar>
  );
}
