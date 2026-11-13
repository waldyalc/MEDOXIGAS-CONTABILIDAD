import { SelectorRangoFechas } from "../../_components/selector-fechas";

interface Props {
  desde: string;
  hasta: string;
}

export function FiltrosPeriodo({ desde, hasta }: Props) {
  return (
    <div className="print:hidden">
      <SelectorRangoFechas desde={desde} hasta={hasta} />
    </div>
  );
}
