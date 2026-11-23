# Navegador para depurar — evaluación (23-11-2026)

Pedido del encargo: «evalúa Playwright MCP o agent-browser para que los
agentes exploren bugs visuales con snapshots de accesibilidad».

## Evaluación

| Opción | Qué es | Coste | Veredicto |
| --- | --- | --- | --- |
| **`@playwright/mcp`** (Microsoft, oficial) | Servidor MCP que expone el navegador por snapshots de accesibilidad (no por capturas de píxeles: cada acción devuelve el árbol ARIA, barato en tokens) | Paquete ~97 KB; proceso Node ~100–200 MB mientras viva la sesión; Chromium solo se abre al usar una herramienta (~500–800 MB durante el uso) | **Instalado** en `opencode.json` (pin `@0.0.85`, del 9-11-2026; la `0.0.86` del 18-11 aún no cumple 7 días) |
| `agent-browser` / otros CLIs | Envoltorios sobre Playwright con CLI propio | Similar, pero sin integración MCP con opencode | Descartado: duplica lo que el MCP ya da |

## Qué quedó

```json
"playwright": {
  "type": "local",
  "command": ["npx", "-y", "@playwright/mcp@0.0.85", "--headless", "--browser", "chromium"],
  "enabled": true
}
```

- Usa el Chromium ya instalado en `/root/.cache/ms-playwright` (o descarga el
  suyo a la primera vez; el disco sobra).
- `--headless`: sin X, como corresponde al VPS.
- Sirve para *explorar* bugs (navegar, leer el árbol ARIA, rellenar, hacer
  clic) — complementa, no sustituye, a `pnpm captura`: la regla de capturas
  para entregar trabajo sigue siendo el script `pnpm captura`.

## Coste de RAM y regla de uso

- El servidor MCP corre por cada sesión de opencode que lo tenga habilitado:
  ~100–200 MB por hijo **aunque no abra el navegador**. Con la RAM al límite,
  **regla: un solo hijo usando navegador a la vez**; si el orquestador ve la
  RAM justa (`free -m`), deshabilita la entrada en `opencode.json` de su
  worktree o no pide depuración visual.
- Si el coste fijo por sesión molesta, la alternativa es dejarlo en
  `"enabled": false` por defecto y encenderlo solo en el brief del hijo que
  depura visualmente. Decisión de Waldy.
