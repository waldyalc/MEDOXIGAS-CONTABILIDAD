import { ImageResponse } from "next/og";

export async function createAppIcon(size: number) {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "#1e56c7",
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
