export async function limpiarCachePOS(): Promise<void> {
  if (typeof caches === "undefined") return;
  for (const nombre of await caches.keys()) {
    if (nombre.startsWith("medoxigas-pos-v1-")) await caches.delete(nombre);
  }
}
