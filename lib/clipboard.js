/**
 * D — clipboard watch / read (P1).
 * M0 stub: export shape only; M3 implements clipboard-event/clipboardy.
 * Privacy: watch defaults to false; no clipboard content is uploaded.
 */

export const name = 'desktop-shell-clipboard'

/** Planned inject for M3: tools (+ agents for autoInject). */
export const inject = []

/**
 * Settings schema (PLAN.md §3.4).
 */
export const Config = {
  type: 'object',
  properties: {
    watch: { type: 'boolean', default: false, description: 'Watch clipboard changes' },
    autoInject: { type: 'boolean', default: false, description: 'Inject changed text into the active session draft' },
    minLength: { type: 'number', default: 8, description: 'Minimum text length to accept' },
  },
}

/**
 * @param {any} ctx
 * @param {any} [config]
 */
export function apply(ctx, config = {}) {
  // M3: ctx.clipboardWatch service + `read_clipboard` tool (PLAN.md §4.4)
}
