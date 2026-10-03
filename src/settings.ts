export interface NotifyConfig {
  onTaskComplete?: boolean
  onApprovalNeeded?: boolean
  sound?: boolean
  titlePrefix?: string
}

export interface CaptureConfig {
  defaultMode?: 'fullscreen' | 'region' | 'window'
  imageFormat?: 'png' | 'jpeg'
}

export interface ClipboardConfig {
  watch?: boolean
  autoInject?: boolean
  minLength?: number
}

export interface HotkeyConfig {
  hotkey?: string
  enabled?: boolean
  behavior?: 'toggle' | 'summon' | 'hide'
}

export const NOTIFY_DEFAULTS: Required<NotifyConfig> = {
  onTaskComplete: true,
  onApprovalNeeded: true,
  sound: true,
  titlePrefix: 'DSH · ',
}

export const CAPTURE_DEFAULTS: Required<CaptureConfig> = {
  defaultMode: 'region',
  imageFormat: 'png',
}

export const CLIPBOARD_DEFAULTS: Required<ClipboardConfig> = {
  watch: false,
  autoInject: false,
  minLength: 8,
}

export const HOTKEY_DEFAULTS: Required<HotkeyConfig> = {
  hotkey: 'Alt+Space',
  enabled: true,
  behavior: 'toggle',
}

export function withDefaults<T extends object>(raw: Partial<T> | undefined, defaults: T): T {
  return { ...defaults, ...(raw ?? {}) }
}
