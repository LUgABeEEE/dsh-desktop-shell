export const name = 'desktop-shell-notify'
export const inject: string[] = []

export interface Config {
  onTaskComplete?: boolean
  onApprovalNeeded?: boolean
  sound?: boolean
  titlePrefix?: string
}

export const ConfigSchema = {
  type: 'object',
  properties: {
    onTaskComplete: { type: 'boolean', default: true, description: 'Notify when a task/turn completes' },
    onApprovalNeeded: { type: 'boolean', default: true, description: 'Notify when user approval is required' },
    sound: { type: 'boolean', default: true, description: 'Play notification sound' },
    titlePrefix: { type: 'string', default: 'DSH · ', description: 'Notification title prefix' },
  },
} as const

export function apply(_ctx: unknown, _config: Config = {}): void {
  // M1: register `notify` tool + agent/turn-stopping hooks (PLAN.md §4.2)
}
