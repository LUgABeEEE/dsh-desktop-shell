/**
 * B — native OS notifications (P0).
 *
 * Every integration point below was verified against the vendored Cordis/DSH
 * source and against plugins actually installed in this desktop profile, not
 * assumed. The corrections that matter when editing this file:
 *
 *   - the tool spec field is `parameters` (JSON Schema) — there is no `schema`
 *   - `output: { schema, render }` is MANDATORY; `execute` returns the canonical
 *     JSON value and `render` turns it into content blocks
 *   - `Config` must be a Schemastery schema (Standard Schema). A plain object is
 *     silently not a validator and the row's settings page never appears
 *   - `.volatile()` fields reach `apply` as a wrapper; read them with `.get()`
 *   - `agent/turn-stopping` is a *serial* event: `{ agent, turn, signal }`, no
 *     `next()`, and it is awaited — so never block it on a notification
 *   - approvals surface through the `approval/request` waterfall, which is the
 *     accurate seam; guessing tool names in `tools/pre-execute` is not
 *
 * Design rule: a notification must never break an agent turn or take the host
 * down. Every backend call is contained and every hook swallows its errors.
 */
import Schema from '@deepseek-ai/schemastery';
export declare const name = "desktop-shell-notify";
export declare const inject: string[];
/** Resolved (plain) settings, after volatile wrappers have been read. */
export interface NotifySettings {
    onTaskComplete: boolean;
    onApprovalNeeded: boolean;
    sound: boolean;
    titlePrefix: string;
}
/**
 * Settings schema. Cordis validates this through the Standard Schema interface
 * and fills defaults from it; every field is `.volatile()` so each one shows up
 * as an editable field on the settings page (the form id is the `desktop-shell-notify`
 * entry id from cordis.patch.yml). Volatile also means a change does NOT remount
 * the fiber, which is why settings are read at use time rather than captured in
 * `apply`.
 */
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    onTaskComplete: Schema<boolean, boolean, "volatile-defined">;
    onApprovalNeeded: Schema<boolean, boolean, "volatile-defined">;
    sound: Schema<boolean, boolean, "volatile-defined">;
    titlePrefix: Schema<string, string, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    onTaskComplete: Schema<boolean, boolean, "volatile-defined">;
    onApprovalNeeded: Schema<boolean, boolean, "volatile-defined">;
    sound: Schema<boolean, boolean, "volatile-defined">;
    titlePrefix: Schema<string, string, "volatile-defined">;
}>>, "plain">;
/**
 * Tool name registered with the host. Deliberately our own rather than `notify`:
 * dsh's registry is layered and a host tool of the same name would shadow ours.
 */
export declare const TOOL_NAME = "desktop_notify";
export interface NotifyRequest {
    title: string;
    message: string;
    sound: boolean;
    urgent: boolean;
}
/** Everything a backend must do. Minimal so tests can substitute one. */
export type NotifyBackend = (request: NotifyRequest) => Promise<void>;
export interface NotifyResult {
    ok: boolean;
    delivered: boolean;
    title: string;
    /** Present on failure; the tool reports the refusal rather than throwing. */
    error?: string;
}
export interface NotifyInput {
    title?: string;
    message?: string;
    urgent?: boolean;
}
export declare function resolveSettings(config: unknown): NotifySettings;
/**
 * `urgent` is not uniformly supported by OS backends (Windows Focus Assist can
 * drop a toast regardless), so it only escalates sound and is passed through to
 * backends that understand `urgency`. See PLAN.md §6.
 */
export declare function buildTitle(prefix: string, title: string | undefined, fallback: string): string;
/**
 * Lazily load node-notifier. The host ships no notification service and does not
 * bundle node-notifier, so this is a real runtime dependency — but it is imported
 * on first use rather than at module load so a broken install degrades to
 * "notifications unavailable" instead of failing the whole plugin row.
 */
export declare function loadNodeNotifierBackend(): Promise<NotifyBackend>;
/**
 * Build the notification service around a backend. This is the unit-testable
 * core; `apply` below only wires it into the host.
 */
export declare function createNotifier(readSettings: () => NotifySettings, backend: NotifyBackend): (input: NotifyInput) => Promise<NotifyResult>;
export type NotifyFn = ReturnType<typeof createNotifier>;
export interface MinimalLogger {
    warn: (message: string) => void;
    debug?: (message: string) => void;
    error?: (message: string) => void;
}
export interface TextBlock {
    type: 'text';
    text: string;
}
export interface ToolCtx {
    tools: {
        register: (spec: Record<string, unknown>) => unknown;
    };
    effect: (fn: () => unknown, label?: string) => unknown;
    logger?: MinimalLogger;
}
export interface HostCtx {
    inject: (names: string[], fn: (ctx: ToolCtx) => void) => void;
    on: (event: string, handler: (...args: never[]) => unknown) => unknown;
    logger?: MinimalLogger;
}
/** Read a session id off an agent without assuming its exact internal shape. */
export declare function sessionIdOf(agent: unknown): string | undefined;
export declare const TOOL_PARAMETERS: {
    readonly type: "object";
    readonly properties: {
        readonly title: {
            readonly type: "string";
            readonly description: "Short notification title. Omit to use a default.";
        };
        readonly message: {
            readonly type: "string";
            readonly description: "Body text shown in the notification.";
        };
        readonly urgent: {
            readonly type: "boolean";
            readonly description: "Escalate: plays the sound even when muted. Use sparingly.";
        };
    };
    readonly required: readonly ["message"];
};
export declare function renderNotifyResult(_args: unknown, value: unknown): TextBlock[];
/**
 * The plugin's behaviour, independent of the host. Kept separate from `apply` so
 * tests can drive it with a fake backend and never pop a real notification.
 */
export declare function createNotifyPlugin(options: {
    config: unknown;
    backend: NotifyBackend;
    logger?: MinimalLogger;
}): {
    notify: (input: NotifyInput) => Promise<NotifyResult>;
    registerTools: (toolCtx: ToolCtx) => void;
    handleTurnStopping: (payload: {
        agent?: unknown;
    } | undefined) => void;
    handleApprovalRequest: (req: {
        agent?: unknown;
        toolName?: string;
    } | undefined, next: () => unknown) => Promise<unknown>;
};
export type NotifyPlugin = ReturnType<typeof createNotifyPlugin>;
export declare function apply(ctx: unknown, config?: unknown): void;
