export declare const name = "desktop-shell-capture";
export declare const inject: string[];
export interface Config {
    defaultMode?: 'fullscreen' | 'region' | 'window';
    imageFormat?: 'png' | 'jpeg';
}
/** Settings schema — see the note on `Config` in ./notify.ts. */
export declare const Config: {
    readonly type: "object";
    readonly properties: {
        readonly defaultMode: {
            readonly type: "string";
            readonly enum: readonly ["fullscreen", "region", "window"];
            readonly default: "region";
            readonly description: "Default capture mode";
        };
        readonly imageFormat: {
            readonly type: "string";
            readonly enum: readonly ["png", "jpeg"];
            readonly default: "png";
            readonly description: "Screenshot image format";
        };
    };
};
/** Alias of {@link Config}, kept for callers written against the M0 scaffold. */
export declare const ConfigSchema: {
    readonly type: "object";
    readonly properties: {
        readonly defaultMode: {
            readonly type: "string";
            readonly enum: readonly ["fullscreen", "region", "window"];
            readonly default: "region";
            readonly description: "Default capture mode";
        };
        readonly imageFormat: {
            readonly type: "string";
            readonly enum: readonly ["png", "jpeg"];
            readonly default: "png";
            readonly description: "Screenshot image format";
        };
    };
};
export declare function apply(_ctx: unknown, _config?: Config): void;
