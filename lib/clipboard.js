export const name = 'desktop-shell-clipboard';
export const inject = [];
/** Settings schema — see the note on `Config` in ./notify.ts. */
export const Config = {
    type: 'object',
    properties: {
        watch: { type: 'boolean', default: false, description: 'Watch clipboard changes' },
        autoInject: { type: 'boolean', default: false, description: 'Inject changed text into the active session draft' },
        minLength: { type: 'number', default: 8, description: 'Minimum text length to accept' },
    },
};
/** Alias of {@link Config}, kept for callers written against the M0 scaffold. */
export const ConfigSchema = Config;
export function apply(_ctx, _config = {}) {
    // M3: ctx.clipboardWatch service + `read_clipboard` tool (PLAN.md §4.4)
}
