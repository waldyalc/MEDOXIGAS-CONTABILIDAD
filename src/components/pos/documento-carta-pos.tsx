"use client";

import { DocumentoPapel } from "@/components/documento-venta/documento-papel";
import type { DocumentoCartaCotizacionPOS, DocumentoCartaFacturaPOS } from "@/lib/pos/impresion";

/**
 * PDF Carta del POS: reutiliza `DocumentoPapel` de Contabilidad sin duplicar
 * su HTML. Se importa de forma estática para que el papel esté montado cuando
 * `ImpresionPos` llama a `window.print()`.
 */

export function CartaFacturaPOS({ datos }: { datos: DocumentoCartaFacturaPOS }) {
  return (
    <DocumentoPapel
      tipo="factura"
      empresa={datos.empresa}
      factura={datos.factura}
      lineas={datos.lineas}
      contacto={datos.contacto}
      ncfVence={datos.ncfVence}
      impuestos={datos.impuestos}
      mostrarLogo={datos.mostrarLogo}
    />
  );
}

export function CartaCotizacionPOS({ datos }: { datos: DocumentoCartaCotizacionPOS }) {
  return <DocumentoPapel tipo="cotizacion" vista={datos.vista} mostrarLogo={datos.mostrarLogo} />;
}
