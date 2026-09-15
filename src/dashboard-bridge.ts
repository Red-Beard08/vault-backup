import type { App } from "obsidian";

export interface DashboardModuleDefinition { id: string; name: string; command: string; icon?: string; description?: string; order?: number; }
export interface DashboardWidgetDefinition { id: string; name: string; description?: string; icon?: string; defaultLayout: { w: number; mobileW: number; h: number; order?: number }; mobile?: "stack" | "responsive" | "hidden"; render: (ctx: unknown, container: HTMLElement) => void | Promise<void>; cleanup?: () => void; }

type DashboardHost = { registerModule?: (definition: DashboardModuleDefinition) => (() => void); registerWidget?: (definition: DashboardWidgetDefinition) => (() => void); };

function host(app: App): DashboardHost | undefined {
  return (app as App & { plugins?: { getPlugin?: (id: string) => unknown } }).plugins?.getPlugin?.("red-beard-dashboard") as DashboardHost | undefined;
}

export function registerDashboardModule(app: App, definition: DashboardModuleDefinition): () => void {
  let dispose: () => void = () => undefined;
  let timer: number | undefined;
  let attempts = 0;
  const attempt = () => {
    const dashboard = host(app);
    if (dashboard?.registerModule) {
      try { dispose = dashboard.registerModule(definition) ?? (() => undefined); } catch { /* host unavailable or duplicate */ }
      if (timer !== undefined) window.clearTimeout(timer);
      return;
    }
    if (attempts++ < 20) timer = window.setTimeout(attempt, 250);
  };
  attempt();
  return () => { if (timer !== undefined) window.clearTimeout(timer); dispose(); };
}

export function registerDashboardWidget(app: App, definition: DashboardWidgetDefinition): () => void {
  const dashboard = host(app);
  if (!dashboard?.registerWidget) return () => undefined;
  try { return dashboard.registerWidget(definition) ?? (() => undefined); } catch { return () => undefined; }
}
