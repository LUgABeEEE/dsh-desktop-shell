/**
 * D — clipboard watch / read (P1).
 *
 * The host has no clipboard service: `navigator.clipboard` is only used by the
 * browser half, so `clipboardy` is used directly.
 *
 * `clipboardy` has no change-event API, so watching is a poll. That is a real
 * limitation and worth stating plainly: a poll cannot see clipboard changes made
 * by a process running at a higher integrity level, and it wakes the CPU on an
 * interval. The native `clipboard-event`/`@nut-tree-fork/nut-js` route needs a
 * compiled addon that will not build here (see PLAN.md section 6).
 *
 * Both `watch` and `autoInject` default to false. Clipboard contents are private:
 * nothing leaves the machine, and the watcher stays off unless asked (PLAN.md
 * section 6). `read_clipboard` is always available and only reads when the model
 * calls it, which is not the same thing as watching.
 */
import Schema from '@deepseek-ai/schemastery';
export declare const name = "desktop-shell-clipboard";
export declare const inject: string[];
export declare const READ_TOOL_NAME = "desktop_read_clipboard";
export interface ClipboardSettings {
    watch: boolean;
    autoInject: boolean;
    minLength: number;
}
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    watch: Schema<boolean, boolean, "volatile-defined">;
    autoInject: Schema<boolean, boolean, "volatile-defined">;
    minLength: Schema<number, number, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    watch: Schema<boolean, boolean, "volatile-defined">;
    autoInject: Schema<boolean, boolean, "volatile-defined">;
    minLength: Schema<number, number, "volatile-defined">;
}>>, "plain">;
export interface ClipboardDeps {
    readText: () => Promise<string>;
}
export declare function loadClipboardDeps(): Promise<ClipboardDeps>;
export interface ReadResult {
    ok: boolean;
    text?: string;
    length?: number;
    truncated?: boolean;
    error?: string;
}
/** Longest clipboard payload handed to the model, to keep a prompt from exploding. */
export declare const MAX_CHARS = 100000;
export declare function readClipboard(deps: ClipboardDeps): Promise<ReadResult>;
/** Whether a clipboard change is worth reacting to. */
export declare function shouldAccept(text: string, settings: ClipboardSettings): boolean;
/**
 * Poll-based clipboard watcher. Exposed separately from `apply` so it can be
 * tested with a fake clock/reader and torn down deterministically.
 */
export declare function createClipboardWatcher(options: {
    deps: ClipboardDeps;
    readSettings: () => ClipboardSettings;
    intervalMs: number;
    onText: (text: string) => void;
    onError?: (error: unknown) => void;
}): {
    start(): void;
    stop(): void;
    /** Exposed for tests. */
    poll: () => Promise<void>;
};
export declare const READ_TOOL_PARAMETERS: {
    readonly type: "object";
    readonly properties: {
        readonly trim: {
            readonly type: "boolean";
            readonly description: "Trim surrounding whitespace. Defaults to false.";
        };
    };
};
export declare function renderRead(_args: unknown, value: unknown): {
    type: 'text';
    text: string;
}[];
export declare function resolveSettings(config: unknown): ClipboardSettings;
export interface ClipboardToolCtx {
    tools: {
        register: (spec: Record<string, unknown>) => unknown;
    };
    effect: (fn: () => unknown, label?: string) => unknown;
    logger?: {
        warn: (m: string) => void;
        debug?: (m: string) => void;
    };
    /** Present when the host exposes an agent to inject draft text into. */
    agents?: {
        active?: unknown;
    };
}
export declare function apply(ctx: unknown, config?: unknown): void;
