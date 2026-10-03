export declare const name = "desktop-shell-clipboard";
export declare const inject: string[];
export interface Config {
    watch?: boolean;
    autoInject?: boolean;
    minLength?: number;
}
/** Settings schema — see the note on `Config` in ./notify.ts. */
export declare const Config: {
    readonly type: "object";
    readonly properties: {
        readonly watch: {
            readonly type: "boolean";
            readonly default: false;
            readonly description: "Watch clipboard changes";
        };
        readonly autoInject: {
            readonly type: "boolean";
            readonly default: false;
            readonly description: "Inject changed text into the active session draft";
        };
        readonly minLength: {
            readonly type: "number";
            readonly default: 8;
            readonly description: "Minimum text length to accept";
        };
    };
};
/** Alias of {@link Config}, kept for callers written against the M0 scaffold. */
export declare const ConfigSchema: {
    readonly type: "object";
    readonly properties: {
        readonly watch: {
            readonly type: "boolean";
            readonly default: false;
            readonly description: "Watch clipboard changes";
        };
        readonly autoInject: {
            readonly type: "boolean";
            readonly default: false;
            readonly description: "Inject changed text into the active session draft";
        };
        readonly minLength: {
            readonly type: "number";
            readonly default: 8;
            readonly description: "Minimum text length to accept";
        };
    };
};
export declare function apply(_ctx: unknown, _config?: Config): void;
