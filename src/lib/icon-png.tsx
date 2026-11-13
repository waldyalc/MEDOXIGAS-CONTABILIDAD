import { ImageResponse } from "next/og";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function createPngIcon(ruta: string, size: number) {
  const png = await readFile(join(process.cwd(), "public", ruta));

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      {/* biome-ignore lint/performance/noImgElement: ImageResponse no admite next/image */}
      <img src={`data:image/png;base64,${png.toString("base64")}`} width={size} height={size} alt="" />
    </div>,
    { width: size, height: size },
  );
}
