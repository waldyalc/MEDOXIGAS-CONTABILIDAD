import { Fragment } from "react";

import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface MigaDePan {
  etiqueta: string;
  /** La última miga se pinta como página actual, sin enlace. */
  href?: string;
}

function ContenidoMiga({ item, esActual }: { item: MigaDePan; esActual: boolean }) {
  if (esActual) {
    return <BreadcrumbPage className="font-medium text-slate-900 dark:text-slate-100">{item.etiqueta}</BreadcrumbPage>;
  }

  if (item.href) {
    return (
      <BreadcrumbLink
        className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        render={<Link href={item.href} />}
      >
        {item.etiqueta}
      </BreadcrumbLink>
    );
  }

  return <span className="text-slate-500 dark:text-slate-400">{item.etiqueta}</span>;
}

export function MigasDePan({ items }: { items: readonly MigaDePan[] }) {
  return (
    <Breadcrumb className="print:hidden">
      <BreadcrumbList className="gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        {items.map((item, indice) => {
          const esActual = indice === items.length - 1;

          return (
            <Fragment key={item.href ?? item.etiqueta}>
              <BreadcrumbItem>
                <ContenidoMiga item={item} esActual={esActual} />
              </BreadcrumbItem>
              {esActual ? null : <BreadcrumbSeparator className="text-slate-400 dark:text-slate-500" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
