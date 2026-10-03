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
function isVolatile(field) {
    return typeof field === 'object' && field !== null && typeof field.get === 'function';
}
/**
 * Read a config field regardless of whether it is volatile. Also tolerates an
 * older host that delivers plain values, so the plugins keep working if the
 * `.volatile()` markers are ever dropped.
 */
export function readConfigField(field, fallback) {
    if (field === undefined || field === null)
        return fallback;
    if (isVolatile(field)) {
        const value = field.get();
        return value === undefined || value === null ? fallback : value;
    }
    return field;
}
/** Default values, mirrored from the schemas so tests and docs have one source. */
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
