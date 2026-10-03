export const name = 'desktop-shell-hotkey';
export const inject = [];
/** Settings schema — see the note on `Config` in ./notify.ts. */
export const Config = {
    type: 'object',
    properties: {
        hotkey: { type: 'string', default: 'Alt+Space', description: 'Global hotkey (accelerator syntax)' },
        enabled: { type: 'boolean', default: true, description: 'Enable the global hotkey' },
        behavior: {
            type: 'string',
            enum: ['toggle', 'summon', 'hide'],
            default: 'toggle',
            description: 'What the hotkey does',
        },
    },
};
/** Alias of {@link Config}, kept for callers written against the M0 scaffold. */
export const ConfigSchema = Config;
export function apply(_ctx, _config = {}) {
    // M4: uiohook-nans + GET /shell-bridge/raise + notification fallback (PLAN.md §4.1)
}
