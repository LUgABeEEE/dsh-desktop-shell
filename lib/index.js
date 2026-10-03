export { name as notifyName, apply as applyNotify, Config as NotifyConfig, TOOL_NAME as NOTIFY_TOOL_NAME, createNotifyPlugin, resolveSettings as resolveNotifySettings, } from './notify.js';
export { name as captureName, apply as applyCapture, Config as CaptureConfig, TOOL_NAME as CAPTURE_TOOL_NAME, createCapturePlugin, captureScreen, resolveSettings as resolveCaptureSettings, } from './capture.js';
export { name as clipboardName, apply as applyClipboard, Config as ClipboardConfig, READ_TOOL_NAME as CLIPBOARD_READ_TOOL_NAME, createClipboardWatcher, readClipboard, resolveSettings as resolveClipboardSettings, } from './clipboard.js';
export { name as hotkeyName, apply as applyHotkey, Config as HotkeyConfig, parseAccelerator, startHotkeyListener, resolveSettings as resolveHotkeySettings, } from './hotkey.js';
export { readConfigField } from './settings.js';
export const name = 'dsh-desktop-shell';
export const inject = [];
export function apply(_ctx) {
    // Umbrella entry is unused — cordis.patch.yml mounts the four sub-plugins directly.
}
