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
import { HOTKEY_DEFAULTS } from './settings.js';
export const name = 'desktop-shell-hotkey';
export const inject = [];
export const Config = Schema.object({
    hotkey: Schema.string().default(HOTKEY_DEFAULTS.hotkey).volatile(),
    enabled: Schema.boolean().default(HOTKEY_DEFAULTS.enabled).volatile(),
    behavior: Schema.union(['toggle', 'summon', 'hide']).default(HOTKEY_DEFAULTS.behavior).volatile(),
});
export function apply(_ctx, _config = {}) {
    // M4: global hotkey + GET /shell-bridge/raise + notification fallback (PLAN.md §4.1).
}
