export interface NotifyConfig {
    onTaskComplete?: boolean;
    onApprovalNeeded?: boolean;
    sound?: boolean;
    titlePrefix?: string;
}
export interface CaptureConfig {
    defaultMode?: 'fullscreen' | 'region' | 'window';
    imageFormat?: 'png' | 'jpeg';
}
export interface ClipboardConfig {
    watch?: boolean;
    autoInject?: boolean;
    minLength?: number;
}
export interface HotkeyConfig {
    hotkey?: string;
    enabled?: boolean;
    behavior?: 'toggle' | 'summon' | 'hide';
}
export declare const NOTIFY_DEFAULTS: Required<NotifyConfig>;
export declare const CAPTURE_DEFAULTS: Required<CaptureConfig>;
export declare const CLIPBOARD_DEFAULTS: Required<ClipboardConfig>;
export declare const HOTKEY_DEFAULTS: Required<HotkeyConfig>;
export declare function withDefaults<T extends object>(raw: Partial<T> | undefined, defaults: T): T;
