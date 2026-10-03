/**
 * dsh-desktop-shell — desktop OS integration bundle for DeepSeek Harness.
 * Four Cordis sub-plugins, each mounted by its own cordis.patch.yml row.
 */

export { name as notifyName, apply as applyNotify, Config as NotifyConfig } from './notify.js'
export { name as captureName, apply as applyCapture, Config as CaptureConfig } from './capture.js'
export { name as clipboardName, apply as applyClipboard, Config as ClipboardConfig } from './clipboard.js'
export { name as hotkeyName, apply as applyHotkey, Config as HotkeyConfig } from './hotkey.js'

export const name = 'dsh-desktop-shell'
export const inject = []

/**
 * Umbrella apply is unused — the bundle mounts the four sub-plugins directly.
 * @param {any} ctx
 */
export function apply(ctx) {}
