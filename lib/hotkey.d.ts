/**
 * A — global hotkey to summon/hide the window (P0, hardest).
 *
 * M4. Only the settings schema is wired up so far; see DEVLOG.md.
 *
 * Note for whoever implements this: the host exposes no window-focus seam — there
 * is no `ctx.desktopShell`, and Desktop's global shortcut handling lives in the
 * Electron main process and is not reachable from a Cordis plugin. Registered
 * global shortcuts therefore need a third-party native module, and focusing the
 * window needs the local-HTTP + notification-fallback route in PLAN.md §4.1.
 */
import Schema from '@deepseek-ai/schemastery';
export declare const name = "desktop-shell-hotkey";
export declare const inject: string[];
export interface HotkeySettings {
    hotkey: string;
    enabled: boolean;
    behavior: 'toggle' | 'summon' | 'hide';
}
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    hotkey: Schema<string, string, "volatile-defined">;
    enabled: Schema<boolean, boolean, "volatile-defined">;
    behavior: Schema<"toggle" | "summon" | "hide", "toggle" | "summon" | "hide", "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    hotkey: Schema<string, string, "volatile-defined">;
    enabled: Schema<boolean, boolean, "volatile-defined">;
    behavior: Schema<"toggle" | "summon" | "hide", "toggle" | "summon" | "hide", "volatile-defined">;
}>>, "plain">;
export declare function apply(_ctx: unknown, _config?: unknown): void;
