import { ImageResponse } from "next/og";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MARGEN = 0.12;

export async function createAppIcon(size: number) {
  const png = await readFile(join(process.cwd(), "public/marca/logo-medoxigas-cuadrado.png"));
  const logoSize = Math.round(size * (1 - MARGEN * 2));

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "white",
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: ImageResponse no admite next/image */}
      <img src={`data:image/png;base64,${png.toString("base64")}`} width={logoSize} height={logoSize} alt="" />
    </div>,
    { width: size, height: size },
  );
}
