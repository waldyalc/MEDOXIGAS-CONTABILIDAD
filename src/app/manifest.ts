import type { MetadataRoute } from "next";

import { COLOR_MARCA_PRIMARIO } from "@/lib/marca";

/**
 * PWA del POS: se instala desde el navegador y abre directo en /pos. Los iconos
 * salen de `src/app/icon.tsx` (cuadrado y con los tamaños exactos que declara),
 * no de los logos de `public/marca`, que son apaisados.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Medoxigas POS",
    short_name: "Medoxigas POS",
    description: "Punto de venta de Medoxigas ALC, SRL",
    start_url: "/pos",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: COLOR_MARCA_PRIMARIO,
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
