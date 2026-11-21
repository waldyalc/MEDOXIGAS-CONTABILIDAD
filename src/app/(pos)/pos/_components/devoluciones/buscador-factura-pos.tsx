"use client";

import { useEffect, useState } from "react";

import { Loader2, Search } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

import { facturasCandidatasPOS } from "../acciones-pos";
import type { FacturaCandidataPOS } from "../tipos";

const ESPERA_MS = 300;

export function BuscadorFacturaPos({
  onSeleccionar,
  soloConSaldo = false,
  placeholder = "Buscar por NCF, número o cliente…",
}: {
  onSeleccionar: (factura: FacturaCandidataPOS) => void;
  soloConSaldo?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [facturas, setFacturas] = useState<FacturaCandidataPOS[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    const temporizador = setTimeout(() => {
      facturasCandidatasPOS(q.trim())
        .then((resultado) => {
          if (!activo) return;
          if (!resultado.ok) {
            setError(resultado.error);
            setFacturas([]);
            return;
          }
          setError(null);
          setFacturas(soloConSaldo ? resultado.data.filter((factura) => Number(factura.saldo) > 0) : resultado.data);
        })
        .catch(() => {
          if (activo) setError("No se pudieron cargar las facturas. Revisa tu conexión.");
        })
        .finally(() => {
          if (activo) setCargando(false);
        });
    }, ESPERA_MS);

    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [q, soloConSaldo]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(evento) => setQ(evento.target.value)}
          placeholder={placeholder}
          aria-label="Buscar factura"
          className="pl-8"
        />
        {cargando ? (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin" />
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}

      <div className="border-border max-h-64 overflow-y-auto rounded-lg border">
        {facturas.length === 0 && !cargando ? (
          <p className="text-muted-foreground px-3 py-4 text-center text-sm">
            {soloConSaldo ? "No hay facturas con saldo pendiente." : "No hay facturas que coincidan."}
          </p>
        ) : (
          <div className="divide-border flex flex-col divide-y">
            {facturas.map((factura) => (
              <button
                key={factura.id}
                type="button"
                className="hover:bg-muted flex items-center justify-between gap-3 px-3 py-2 text-left"
                onClick={() => onSeleccionar(factura)}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{factura.ncf ?? `Factura No ${factura.numero}`}</span>
                  <span className="text-muted-foreground truncate text-xs">{factura.cliente_nombre}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end text-xs">
                  <span className="tabular-nums">{formatoDia(factura.fecha)}</span>
                  <span className="text-muted-foreground tabular-nums">Saldo {formatoMoneda(factura.saldo)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
