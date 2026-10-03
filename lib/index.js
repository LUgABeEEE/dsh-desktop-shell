export { name as notifyName, apply as applyNotify, Config as NotifyConfigSchema } from './notify.js';
export { name as captureName, apply as applyCapture, Config as CaptureConfigSchema } from './capture.js';
export { name as clipboardName, apply as applyClipboard, Config as ClipboardConfigSchema } from './clipboard.js';
export { name as hotkeyName, apply as applyHotkey, Config as HotkeyConfigSchema } from './hotkey.js';
export const name = 'dsh-desktop-shell';
export const inject = [];
export function apply(_ctx) {
    // Umbrella entry is unused — cordis.patch.yml mounts the four sub-plugins directly.
}
