"use client";

import { useState } from "react";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import type { TablaReporte } from "@/lib/reportes/exportar/tipos";

type Formato = "excel" | "pdf";

interface Props {
  tabla: TablaReporte;
  nombreArchivo: string;
}

const EXTENSION: Record<Formato, string> = { excel: "xlsx", pdf: "pdf" };

async function generarBlob(tabla: TablaReporte, formato: Formato): Promise<Blob> {
  if (formato === "excel") {
    const { tablaAExcel } = await import("@/lib/reportes/exportar/excel");
    const buffer = await tablaAExcel(tabla);
    return new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  const { tablaAPdf } = await import("@/lib/reportes/exportar/pdf");
  return tablaAPdf(tabla);
}

function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function BotonDescargar({ tabla, nombreArchivo }: Props) {
  const [generando, setGenerando] = useState<Formato | null>(null);

  async function descargar(formato: Formato): Promise<void> {
    if (generando != null) return;

    setGenerando(formato);
    try {
      const blob = await generarBlob(tabla, formato);
      descargarBlob(blob, `${nombreArchivo}.${EXTENSION[formato]}`);
    } catch {
      toast.add({
        type: "error",
        title: "No se pudo descargar el reporte",
        description: "Intenta de nuevo en unos segundos.",
      });
    } finally {
      setGenerando(null);
    }
  }

  return (
    <div className="print:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" disabled={generando != null} />}>
          <Download />
          {generando != null ? "Generando…" : "Descargar"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={generando != null} onClick={() => void descargar("excel")}>
            Descargar Excel
          </DropdownMenuItem>
          <DropdownMenuItem disabled={generando != null} onClick={() => void descargar("pdf")}>
            Descargar PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
