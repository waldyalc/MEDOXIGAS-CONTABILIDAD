"use client";

import { useState } from "react";

import { Download, FileSpreadsheet, FileText } from "lucide-react";

import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import type { TablaReporte } from "@/lib/reportes/exportar/tipos";
import { nombreArchivoDgiiExcel, soloDigitos, textoPeriodo } from "@/lib/reportes/fiscales/comun";
import type { DocumentoExcluido } from "@/lib/reportes/fiscales/excluidos";

type TipoArchivo = "txt" | "excel";

const TIPOS_ARCHIVO = [
  { value: "txt", label: "TXT plano (DGII)" },
  { value: "excel", label: "Excel (.xlsx)" },
];

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

interface Props {
  codigo: string;
  periodo: string;
  rnc: string | null;
  nombreArchivo: string;
  textoPlano: string;
  tabla: TablaReporte;
  excluidos?: readonly DocumentoExcluido[];
}

/**
 * Modal de exportación de Alegra (Periodo + Tipo de archivo) que descarga el
 * archivo en el momento: sin ZIP, sin historial (decisión de Waldy, 20 nov 2026).
 */
export function ModalExportar({ codigo, periodo, rnc, nombreArchivo, textoPlano, tabla, excluidos = [] }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoArchivo>("txt");
  const [generando, setGenerando] = useState(false);
  const sinRnc = soloDigitos(rnc) === "";

  async function descargar() {
    if (generando) return;
    setGenerando(true);

    try {
      if (tipo === "txt") {
        descargarBlob(new Blob([textoPlano], { type: "text/plain;charset=utf-8" }), nombreArchivo);
      } else {
        const { libroDgiiAExcel } = await import("./exportar-dgii");
        const buffer = await libroDgiiAExcel(tabla, excluidos);
        descargarBlob(
          new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          nombreArchivoDgiiExcel(codigo, rnc, periodo),
        );
      }
      setAbierto(false);
    } catch {
      toast.add({
        type: "error",
        title: "No se pudo descargar el reporte",
        description: "Intenta de nuevo en unos segundos.",
      });
    } finally {
      setGenerando(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setAbierto(true)}>
        <Download />
        Exportar
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{sinRnc ? "Actualiza tu identificación" : `Exportar reporte ${codigo}`}</DialogTitle>
          </DialogHeader>

          {sinRnc ? (
            <div className="flex flex-col gap-3 text-sm">
              <p>
                Para exportar los reportes de la DGII necesitas configurar el RNC de la empresa. Alegra bloquea la
                exportación con el aviso «Actualiza tu identificación».
              </p>
              <Button
                type="button"
                variant="outline"
                nativeButton={false}
                render={<a href="/dashboard/configuracion/empresa" />}
              >
                Ir a Configuración → Empresa
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="exportar-periodo">Periodo</Label>
                <Input id="exportar-periodo" value={textoPeriodo(periodo)} readOnly aria-readonly="true" />
                <p className="text-muted-foreground text-xs">
                  El archivo lleva el periodo que estás viendo; para otro periodo cambia las fechas del reporte.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="exportar-tipo">Tipo de archivo</Label>
                <SelectCampo
                  id="exportar-tipo"
                  aria-label="Tipo de archivo"
                  opciones={TIPOS_ARCHIVO}
                  valor={tipo}
                  onCambio={(valor) => setTipo(valor === "excel" ? "excel" : "txt")}
                  className="w-full"
                />
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  {tipo === "txt" ? <FileText className="size-3.5" /> : <FileSpreadsheet className="size-3.5" />}
                  {tipo === "txt"
                    ? "Archivo plano con el formato oficial de la DGII, separado por pipes."
                    : "Excel con los renglones y, si hay, la hoja «Documentos no incluidos»."}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={generando} />}>Cerrar</DialogClose>
            {sinRnc ? null : (
              <Button type="button" onClick={() => void descargar()} disabled={generando}>
                <Download />
                {generando ? "Generando…" : "Descargar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
