---
name: biome
description: Usar cada vez que Waldy corrija a la IA, o cuando un error se repita, para convertir la corrección en un candado automático (un test o una regla de Biome) en vez de solo apuntarlo en AGENTS.md. Explica qué es un test, qué es una regla de Biome, por qué valen más que un consejo escrito y resume la charla «All Code Is Slop (Except Mine)» de Lauren Tan.
---

# Candados: tests y reglas de Biome

## La regla de oro

**Cada vez que Waldy te corrija algo, no lo apuntes solo en un `.md`: conviértelo en un test o una regla de Biome que falle si alguien lo vuelve a hacer.** Después anota en `AGENTS.md` una línea que diga qué candado existe y dónde está.

## Qué es cada cosa

- **Test**: un programa pequeño que revisa el sistema solo. Ejemplo: «crea una factura de 1,000 y comprueba que el asiento cuadre». Si algo se rompe, sale en rojo y el commit o el push no pasa. Viven junto al código (`*.test.ts`, Vitest), en `supabase/tests` (pgTAP, base de datos) o en `e2e/` (Playwright, navegador).
- **Regla de Biome**: Biome es el revisor automático del código (formato y lint, configurado en `biome.json`). Una regla revisa **cómo está escrito** el código, no si el sistema funciona. Ejemplo: «prohibido importar X en pantallas del navegador». Si la IA la rompe, el guardado o el commit se frena y le dice qué arreglar.
- **AGENTS.md**: es un consejo. La IA a veces no lo lee, se le olvida en tareas largas o busca una excusa. Un test o una regla es un candado: si se rompe, el código no entra. Se usan las dos cosas: AGENTS.md explica, el candado obliga.

## Cómo crear un candado

1. Escribe en una frase el error que se corrigió (por ejemplo: «usó un `<select>` nativo»).
2. Elige el candado más simple que lo detecte:
   - **Patrón en el código** (algo que no se debe escribir): primero mira si Biome ya tiene una regla (`noRestrictedImports`, `noRestrictedGlobals`, etc.) y actívala en `biome.json`. Si no existe, un test de Vitest que lea los archivos y busque el patrón, como `src/lib/selects-nativos.test.ts`.
   - **Comportamiento** (un cálculo o un flujo que debe dar cierto resultado): test de Vitest o pgTAP.
   - **Pantalla** (algo que el usuario debe ver o poder hacer): prueba e2e de Playwright.
3. El mensaje de error debe decir **cómo arreglarlo de raíz**, no solo qué está mal (ejemplo: «Usa SelectCampo o el Select de components/ui/select»).
4. Comprueba que el candado falla con el error y pasa con el arreglo.
5. Limpia los casos viejos que ya rompían la regla, para que la IA no copie el mal ejemplo.
6. Agrega una línea en `AGENTS.md` (sección «Candados») con qué revisa y en qué archivo está.
7. Corre `pnpm typecheck`, `pnpm check`, `pnpm test` y `pnpm build`. Nunca `--no-verify`.

## Resumen práctico de la charla de Lauren Tan

«All Code Is Slop (Except Mine)», Lauren Tan (Potato), SpaceXAI, equipo de Grok Bot ([video](https://www.youtube.com/watch?v=O_zcc6Xl12g)).

- **La IA copia lo que ve en el repo.** El código es su entrada más grande. Un parche, un atajo o un mal ejemplo se copia en la siguiente tarea como si fuera la forma correcta. El repo es un jardín: hay que sacar la mala hierba.
- **Corrección = candado.** Cada vez que corriges a la IA, conviértelo en un chequeo automático (lint, tipos, test) o rediseña el código para que el error sea imposible. Así cada vez hay menos que revisar a mano.
- **Prohíbe lo que exige mucha finura.** Si algo es fácil de usar mal (en React, `useEffect`), mejor prohibirlo fuera de un sitio controlado.
- **Carpetas que dan contexto.** Separa lo que no se debe mezclar en carpetas distintas y prohíbe los imports entre ellas con una regla.
- **Pocos comentarios.** La IA usa comentarios y `.md` para justificar parches. Los comentarios envejecen y no se ejecutan; una regla sí se ejecuta.
- **Verificar, no leer código.** Revisa pruebas: capturas, videos, tests y un mapa de pantallas (lista de todas las pantallas con su ruta) para que «el botón de recibir pago» signifique lo mismo para todos.
- **Limpiar antes de automatizar.** Si el ciclo base produce parches, automatizarlo produce más parches y gasta más. Primero reglas y limpieza, después muchas sesiones a la vez.
- Resultado en su equipo: miles de PR al mes, pocas reversiones (cerca de 0.5 %) y la app más rápida.

## Ideas de candados para Medoxigas Contabilidad

- Formularios de alta y edición solo con `FormCard`, `FormGrid` y `FormField`.
- Pantallas con datos que tengan `loading.tsx` con esqueleto.
- Clientes, productos, documentos y cuentas siempre como enlace a su ficha en tablas y vistas.
- Montos nunca con `number` flotante en cálculos guardados; ITBIS y totales en el servidor.
- Test de cuadre contable (`docs/pruebas/cuadre.sql` como base): débitos = créditos, CxC, CxP, ITBIS e inventario.
- Prohibir `setTimeout` como parche en componentes.
