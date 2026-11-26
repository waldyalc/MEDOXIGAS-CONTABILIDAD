import { ImageResponse } from "next/og";

import { COLOR_MARCA_PRIMARIO } from "@/lib/marca";

export async function createAppIcon(size: number) {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: COLOR_MARCA_PRIMARIO,
        color: "white",
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
      }}
    >
      MC
    </div>,
    { width: size, height: size },
  );
}
