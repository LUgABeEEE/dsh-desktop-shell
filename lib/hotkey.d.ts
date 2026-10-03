export declare const name = "desktop-shell-hotkey";
export declare const inject: string[];
export interface Config {
    hotkey?: string;
    enabled?: boolean;
    behavior?: 'toggle' | 'summon' | 'hide';
}
/** Settings schema — see the note on `Config` in ./notify.ts. */
export declare const Config: {
    readonly type: "object";
    readonly properties: {
        readonly hotkey: {
            readonly type: "string";
            readonly default: "Alt+Space";
            readonly description: "Global hotkey (accelerator syntax)";
        };
        readonly enabled: {
            readonly type: "boolean";
            readonly default: true;
            readonly description: "Enable the global hotkey";
        };
        readonly behavior: {
            readonly type: "string";
            readonly enum: readonly ["toggle", "summon", "hide"];
            readonly default: "toggle";
            readonly description: "What the hotkey does";
        };
    };
};
/** Alias of {@link Config}, kept for callers written against the M0 scaffold. */
export declare const ConfigSchema: {
    readonly type: "object";
    readonly properties: {
        readonly hotkey: {
            readonly type: "string";
            readonly default: "Alt+Space";
            readonly description: "Global hotkey (accelerator syntax)";
        };
        readonly enabled: {
            readonly type: "boolean";
            readonly default: true;
            readonly description: "Enable the global hotkey";
        };
        readonly behavior: {
            readonly type: "string";
            readonly enum: readonly ["toggle", "summon", "hide"];
            readonly default: "toggle";
            readonly description: "What the hotkey does";
        };
    };
};
export declare function apply(_ctx: unknown, _config?: Config): void;
