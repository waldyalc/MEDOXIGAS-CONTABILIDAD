import Link from "next/link";

import { Info } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  titulo: string;
  href: string;
  tooltip: string;
}

/** Título de widget: enlace subrayado al reporte + tooltip «ⓘ», como en Alegra. */
export function TituloWidget({ titulo, href, tooltip }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <CardTitle className="text-foreground text-sm font-semibold">
        <Link href={href} className="hover:text-primary decoration-border underline underline-offset-[3px]">
          {titulo}
        </Link>
      </CardTitle>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              aria-label={`Más información sobre ${titulo}`}
            />
          }
        >
          <Info aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}
