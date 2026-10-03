export { name as notifyName, apply as applyNotify, ConfigSchema as NotifyConfigSchema } from './notify.js'
export type { Config as NotifyConfig } from './notify.js'
export { name as captureName, apply as applyCapture, ConfigSchema as CaptureConfigSchema } from './capture.js'
export type { Config as CaptureConfig } from './capture.js'
export { name as clipboardName, apply as applyClipboard, ConfigSchema as ClipboardConfigSchema } from './clipboard.js'
export type { Config as ClipboardConfig } from './clipboard.js'
export { name as hotkeyName, apply as applyHotkey, ConfigSchema as HotkeyConfigSchema } from './hotkey.js'
export type { Config as HotkeyConfig } from './hotkey.js'

export const name = 'dsh-desktop-shell'
export const inject: string[] = []

export function apply(_ctx: unknown): void {
  // Umbrella entry is unused — cordis.patch.yml mounts the four sub-plugins directly.
}
