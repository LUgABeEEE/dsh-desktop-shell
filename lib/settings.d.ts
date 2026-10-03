/**
 * Config helpers shared by the four sub-plugins.
 *
 * Every sub-plugin exports its `Config` as a Schemastery schema (Cordis validates
 * it through the Standard Schema interface). Fields the user should be able to
 * change from the settings page are marked `.volatile()`.
 *
 * `.volatile()` has a consequence that is easy to get wrong: a volatile field
 * does NOT hand `apply` a plain value, it hands over a stable wrapper that must
 * be read with `.get()` at the moment of use. Defaults live on the schema, not in
 * a merge helper, so there is no `withDefaults` here any more.
 */
/** A config field as it may arrive: a plain value, a volatile wrapper, or absent. */
export type ConfigField<T> = T | {
    get(): T;
} | undefined;
/**
 * Read a config field regardless of whether it is volatile. Also tolerates an
 * older host that delivers plain values, so the plugins keep working if the
 * `.volatile()` markers are ever dropped.
 */
export declare function readConfigField<T>(field: ConfigField<T>, fallback: T): T;
/** Default values, mirrored from the schemas so tests and docs have one source. */
export declare const NOTIFY_DEFAULTS: {
    readonly onTaskComplete: true;
    readonly onApprovalNeeded: true;
    readonly sound: true;
    readonly titlePrefix: "DSH · ";
};
export declare const CAPTURE_DEFAULTS: {
    readonly defaultMode: "fullscreen";
    readonly imageFormat: "png";
};
export declare const CLIPBOARD_DEFAULTS: {
    readonly watch: false;
    readonly autoInject: false;
    readonly minLength: 8;
};
export declare const HOTKEY_DEFAULTS: {
    readonly hotkey: "Alt+Space";
    readonly enabled: true;
    readonly behavior: "toggle";
};
