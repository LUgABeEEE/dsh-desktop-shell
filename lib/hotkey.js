/**
 * A — global hotkey summon/hide DSH (P0).
 * M0 stub: export shape only; M4 implements uiohook-nans + /shell-bridge/raise.
 * Host is pure Node (ELECTRON_RUN_AS_NODE=1) — no Electron APIs.
 */

export const name = 'desktop-shell-hotkey'

/** Planned inject for M4: agents (optional webhookRuntime). */
export const inject = []

/**
 * Settings schema (PLAN.md §3.4).
 * hotkey uses Electron-accelerator-style syntax as the config string format.
 */
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
}

/**
 * @param {any} ctx
 * @param {any} [config]
 */
export function apply(ctx, config = {}) {
  // M4: uiohook-nans listener + GET /shell-bridge/raise + notification fallback (PLAN.md §4.1)
}
