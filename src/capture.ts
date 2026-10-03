export const name = 'desktop-shell-capture'
export const inject: string[] = []

export interface Config {
  defaultMode?: 'fullscreen' | 'region' | 'window'
  imageFormat?: 'png' | 'jpeg'
}

export const ConfigSchema = {
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
} as const

export function apply(_ctx: unknown, _config: Config = {}): void {
  // M2: register `capture_screen` tool (PLAN.md §4.3)
}
