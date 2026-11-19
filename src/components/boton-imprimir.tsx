"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Imprime el contenido `data-print-root`/`data-print-paper` de la página. */
export function BotonImprimir() {
  return (
    <Button variant="outline" onClick={() => window.print()} className="print:hidden">
      <Printer />
      Imprimir
    </Button>
  );
}
