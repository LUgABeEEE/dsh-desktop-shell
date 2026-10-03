/**
 * C — screen capture (P1).
 *
 * M2. Only the settings schema is wired up so far; see DEVLOG.md.
 *
 * Note for whoever implements the tool: the host has no general screenshot API.
 * `ctx.computerUse` exists but only exposes a single opt-in provider slot and is
 * not installed by default, so real capture needs a third-party module.
 */
import Schema from '@deepseek-ai/schemastery';
import { CAPTURE_DEFAULTS } from './settings.js';
export const name = 'desktop-shell-capture';
export const inject = [];
export const Config = Schema.object({
    defaultMode: Schema
        .union(['fullscreen', 'region', 'window'])
        .default(CAPTURE_DEFAULTS.defaultMode)
        .volatile(),
    imageFormat: Schema.union(['png', 'jpeg']).default(CAPTURE_DEFAULTS.imageFormat).volatile(),
});
export function apply(_ctx, _config = {}) {
    // M2: register the `capture_screen` tool (PLAN.md §4.3).
}
