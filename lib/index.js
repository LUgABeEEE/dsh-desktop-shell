export { name as notifyName, apply as applyNotify, Config as NotifyConfig, TOOL_NAME as NOTIFY_TOOL_NAME, } from './notify.js';
export { name as captureName, apply as applyCapture, Config as CaptureConfig } from './capture.js';
export { name as clipboardName, apply as applyClipboard, Config as ClipboardConfig } from './clipboard.js';
export { name as hotkeyName, apply as applyHotkey, Config as HotkeyConfig } from './hotkey.js';
export { readConfigField } from './settings.js';
export const name = 'dsh-desktop-shell';
export const inject = [];
export function apply(_ctx) {
    // Umbrella entry is unused — cordis.patch.yml mounts the four sub-plugins directly.
}
