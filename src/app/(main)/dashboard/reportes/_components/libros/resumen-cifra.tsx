interface Props {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}

export function ResumenCifra({ etiqueta, valor, destacado = false }: Props) {
  return (
    <div className="bg-card ring-foreground/10 rounded-xl px-4 py-3 ring-1">
      <p className="text-muted-foreground text-xs">{etiqueta}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${destacado ? "" : "text-foreground"}`}>{valor}</p>
    </div>
  );
}
