const entero = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 0 });
const porcentaje = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const mpa = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatoEntero(valor: number | null | undefined) {
  if (valor == null || Number.isNaN(valor)) return "—";
  return entero.format(valor);
}

export function formatoKg(valor: number | null | undefined) {
  if (valor == null || Number.isNaN(valor)) return "—";
  return `${entero.format(valor)} kg`;
}

export function formatoPct(valor: number | null | undefined) {
  if (valor == null || Number.isNaN(valor)) return "—";
  return `${porcentaje.format(valor)} %`;
}

export function formatoMpa(valor: number | null | undefined) {
  if (valor == null || Number.isNaN(valor)) return "—";
  return `${mpa.format(valor)} MPa`;
}

export function formatoFechaHora(iso: string | null | undefined) {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santo_Domingo",
  }).format(fecha);
}

export function formatoEje(iso: string) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santo_Domingo",
  }).format(fecha);
}

export function formatoDia(iso: string) {
  const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return iso;
  return new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}
