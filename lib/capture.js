export const name = 'desktop-shell-capture';
export const inject = [];
/** Settings schema — see the note on `Config` in ./notify.ts. */
export const Config = {
    type: 'object',
    properties: {
        defaultMode: {
            type: 'string',
            enum: ['fullscreen', 'region', 'window'],
            default: 'region',
            description: 'Default capture mode',
        },
        imageFormat: {
            type: 'string',
            enum: ['png', 'jpeg'],
            default: 'png',
            description: 'Screenshot image format',
        },
    },
};
/** Alias of {@link Config}, kept for callers written against the M0 scaffold. */
export const ConfigSchema = Config;
export function apply(_ctx, _config = {}) {
    // M2: register `capture_screen` tool (PLAN.md §4.3)
}
