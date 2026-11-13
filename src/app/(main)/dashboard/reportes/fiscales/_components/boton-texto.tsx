"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  contenido: string;
  nombreArchivo: string;
  etiqueta: string;
}

export function BotonTexto({ contenido, nombreArchivo, etiqueta }: Props) {
  function descargar(): void {
    const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <Button type="button" variant="outline" onClick={descargar}>
      <Download />
      {etiqueta}
    </Button>
  );
}
