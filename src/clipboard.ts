export const name = 'desktop-shell-clipboard'
export const inject: string[] = []

export interface Config {
  watch?: boolean
  autoInject?: boolean
  minLength?: number
}

export const ConfigSchema = {
  type: 'object',
  properties: {
    watch: { type: 'boolean', default: false, description: 'Watch clipboard changes' },
    autoInject: { type: 'boolean', default: false, description: 'Inject changed text into the active session draft' },
    minLength: { type: 'number', default: 8, description: 'Minimum text length to accept' },
  },
} as const

export function apply(_ctx: unknown, _config: Config = {}): void {
  // M3: ctx.clipboardWatch service + `read_clipboard` tool (PLAN.md §4.4)
}
