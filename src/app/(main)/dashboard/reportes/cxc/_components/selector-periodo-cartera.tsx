"use client";

import { useEffect, useState } from "react";

import type { RangoFechas } from "@/lib/fechas/rangos";

import { SelectorRangoFechas } from "../../_components/selector-fechas";

export function SelectorPeriodoCartera({ desde, hasta }: RangoFechas) {
  const [rango, setRango] = useState<RangoFechas>({ desde, hasta });

  useEffect(() => {
    setRango({ desde, hasta });
  }, [desde, hasta]);

  return <SelectorRangoFechas desde={rango.desde} hasta={rango.hasta} variante="campo" onChange={setRango} />;
}
