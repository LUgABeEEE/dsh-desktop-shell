export const name = 'desktop-shell-notify'
export const inject: string[] = []

export interface Config {
  onTaskComplete?: boolean
  onApprovalNeeded?: boolean
  sound?: boolean
  titlePrefix?: string
}

/**
 * Settings schema. DSH 0.1.7+ derives the settings page from the plugin's Config
 * export (see PLAN.md §3.4). Exported under both `Config` and `ConfigSchema`
 * because the two names are in use across the installed plugin set — keeping
 * both means the settings page resolves regardless of which one the host reads.
 *
 * `Config` the interface (type space) and `Config` the const (value space)
 * deliberately share a name; TypeScript allows this and it mirrors how
 * dsh-cost-meter exposes its schema.
 */
export const Config = {
  type: 'object',
  properties: {
    onTaskComplete: { type: 'boolean', default: true, description: 'Notify when a task/turn completes' },
    onApprovalNeeded: { type: 'boolean', default: true, description: 'Notify when user approval is required' },
    sound: { type: 'boolean', default: true, description: 'Play notification sound' },
    titlePrefix: { type: 'string', default: 'DSH · ', description: 'Notification title prefix' },
  },
} as const

/** Alias of {@link Config}, kept for callers written against the M0 scaffold. */
export const ConfigSchema = Config

export function apply(_ctx: unknown, _config: Config = {}): void {
  // M1: register `notify` tool + agent/turn-stopping hooks (PLAN.md §4.2)
}
