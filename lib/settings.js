export const NOTIFY_DEFAULTS = {
    onTaskComplete: true,
    onApprovalNeeded: true,
    sound: true,
    titlePrefix: 'DSH · ',
};
export const CAPTURE_DEFAULTS = {
    defaultMode: 'region',
    imageFormat: 'png',
};
export const CLIPBOARD_DEFAULTS = {
    watch: false,
    autoInject: false,
    minLength: 8,
};
export const HOTKEY_DEFAULTS = {
    hotkey: 'Alt+Space',
    enabled: true,
    behavior: 'toggle',
};
export function withDefaults(raw, defaults) {
    return { ...defaults, ...(raw ?? {}) };
}
