/**
 * B — native OS notifications (P0).
 * M0 stub: export shape only; M1 implements node-notifier + agent hooks.
 */

export const name = 'desktop-shell-notify'

/** Planned inject for M1: tools + agent event hooks. Keep empty in M0 so the row loads standalone. */
export const inject = []

/**
 * Settings schema (DSH 0.1.7+ derives the settings page from Config).
 * @see PLAN.md §3.4
 */
export const Config = {
  type: 'object',
  properties: {
    onTaskComplete: { type: 'boolean', default: true, description: 'Notify when a task/turn completes' },
    onApprovalNeeded: { type: 'boolean', default: true, description: 'Notify when user approval is required' },
    sound: { type: 'boolean', default: true, description: 'Play notification sound' },
    titlePrefix: { type: 'string', default: 'DSH · ', description: 'Notification title prefix' },
  },
}

/**
 * @param {any} ctx
 * @param {any} [config]
 */
export function apply(ctx, config = {}) {
  // M1: register `notify` tool + agent/turn-stopping hooks (PLAN.md §4.2)
}
