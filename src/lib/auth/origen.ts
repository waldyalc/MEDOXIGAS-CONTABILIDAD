function primerValor(valor: string | null) {
  const limpio = valor?.split(",")[0]?.trim();
  return limpio ? limpio : undefined;
}

function esLocal(host: string) {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
}

export function origenDesdeHeaders(headers: Headers) {
  const host = primerValor(headers.get("x-forwarded-host")) ?? primerValor(headers.get("host"));
  if (!host) return "";

  const proto = primerValor(headers.get("x-forwarded-proto")) ?? (esLocal(host) ? "http" : "https");
  return `${proto}://${host}`;
}
