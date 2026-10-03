/**
 * Shared settings helpers for the four desktop-shell sub-plugins.
 * DSH 0.1.7+ derives per-plugin settings pages from each plugin's Config export.
 */

/**
 * Normalize a raw config object against defaults.
 * @param {Record<string, any>} raw
 * @param {Record<string, any>} defaults
 */
export function withDefaults(raw, defaults) {
  return { ...defaults, ...(raw ?? {}) }
}

export const NOTIFY_DEFAULTS = {
  onTaskComplete: true,
  onApprovalNeeded: true,
  sound: true,
  titlePrefix: 'DSH · ',
}

export const CAPTURE_DEFAULTS = {
  defaultMode: 'region',
  imageFormat: 'png',
}

export const CLIPBOARD_DEFAULTS = {
  watch: false,
  autoInject: false,
  minLength: 8,
}

export const HOTKEY_DEFAULTS = {
  hotkey: 'Alt+Space',
  enabled: true,
  behavior: 'toggle',
}
