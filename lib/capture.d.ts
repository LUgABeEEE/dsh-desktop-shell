/**
 * C — screen capture (P1).
 *
 * The host has no general screenshot API: `ctx.computerUse` is only a single
 * opt-in provider slot and is not installed by default, so capture is done with
 * `screenshot-desktop`. Verified on Windows: it drives .NET through PowerShell and
 * returns a real PNG.
 *
 * Region mode takes explicit coordinates and crops with `sharp`. There is no
 * drag-to-select overlay: that needs a native input-capture module, and the
 * obvious candidate (`iohook` / `uiohook-nans`) has no prebuilt binary for
 * current Node on Windows — see PLAN.md section 6. `window` mode is therefore
 * NOT supported and is rejected with a clear message rather than silently
 * returning a full screen.
 *
 * Privacy: nothing is written to a temp file. The bytes go straight to the host's
 * content-addressed attachment store, which is the host's own designed path for
 * putting an image in front of the model. See PLAN.md section 6 — note that the
 * host store has no GC, so captures accumulate until DSH prunes them.
 */
import Schema from '@deepseek-ai/schemastery';
export declare const name = "desktop-shell-capture";
export declare const inject: string[];
/** Namespaced to avoid colliding with a host tool (the registry is layered). */
export declare const TOOL_NAME = "desktop_capture_screen";
export type CaptureMode = 'fullscreen' | 'region';
export type ImageFormat = 'png' | 'jpeg';
export interface CaptureSettings {
    defaultMode: CaptureMode;
    imageFormat: ImageFormat;
}
export interface Region {
    x: number;
    y: number;
    width: number;
    height: number;
}
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    defaultMode: Schema<"fullscreen" | "region", "fullscreen" | "region", "volatile-defined">;
    imageFormat: Schema<"png" | "jpeg", "png" | "jpeg", "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    defaultMode: Schema<"fullscreen" | "region", "fullscreen" | "region", "volatile-defined">;
    imageFormat: Schema<"png" | "jpeg", "png" | "jpeg", "volatile-defined">;
}>>, "plain">;
export interface CaptureDeps {
    /** Returns raw image bytes for the whole screen. */
    screenshot: (format: ImageFormat) => Promise<Buffer>;
    /** Crops bytes to a region; absent when `sharp` is not installed. */
    crop?: (data: Buffer, region: Region) => Promise<Buffer>;
    /** Reads image dimensions; absent when `sharp` is not installed. */
    measure?: (data: Buffer) => Promise<{
        width: number;
        height: number;
    }>;
}
export interface CapturedImage {
    data: Buffer;
    mediaType: 'image/png' | 'image/jpeg';
    width?: number;
    height?: number;
}
export interface CaptureResult {
    ok: boolean;
    mode: CaptureMode;
    format: ImageFormat;
    bytes: number;
    width?: number;
    height?: number;
    /** Raw bytes. Only present on success and stripped before reaching the model. */
    data?: Buffer;
    /** Present once the host has stored it; rendered as an image content block. */
    attachment?: unknown;
    /** Set when `mode: 'region'` was requested but no coordinates were given. */
    needsRegion?: boolean;
    error?: string;
}
export declare function isRegion(value: unknown): value is Region;
/** Capture the screen. Pure with respect to the host so it can be tested. */
export declare function captureScreen(readSettings: () => CaptureSettings, deps: CaptureDeps, args: {
    mode?: string;
    region?: unknown;
    format?: string;
}): Promise<CaptureResult>;
export declare const TOOL_PARAMETERS: {
    readonly type: "object";
    readonly properties: {
        readonly mode: {
            readonly type: "string";
            readonly enum: readonly ["fullscreen", "region"];
            readonly description: "fullscreen captures every display; region needs an explicit rect. There is no drag overlay.";
        };
        readonly region: {
            readonly type: "object";
            readonly description: "Required when mode is region.";
            readonly properties: {
                readonly x: {
                    readonly type: "number";
                    readonly description: "Left edge in screen pixels.";
                };
                readonly y: {
                    readonly type: "number";
                    readonly description: "Top edge in screen pixels.";
                };
                readonly width: {
                    readonly type: "number";
                    readonly description: "Width in pixels; must be greater than zero.";
                };
                readonly height: {
                    readonly type: "number";
                    readonly description: "Height in pixels; must be greater than zero.";
                };
            };
            readonly required: readonly ["x", "y", "width", "height"];
        };
        readonly format: {
            readonly type: "string";
            readonly enum: readonly ["png", "jpeg"];
            readonly description: "Image format. Defaults to the setting.";
        };
    };
};
export interface ContentBlock {
    type: string;
    text?: string;
    attachment?: unknown;
}
export declare function renderCapture(_args: unknown, value: unknown): ContentBlock[];
export declare function resolveSettings(config: unknown): CaptureSettings;
export interface CaptureToolCtx {
    attachments?: {
        saveImage: (input: {
            data: Buffer;
            mediaType: string;
            name?: string;
        }) => Promise<unknown>;
    };
    tools: {
        register: (spec: Record<string, unknown>) => unknown;
    };
    effect: (fn: () => unknown, label?: string) => unknown;
    logger?: {
        warn: (m: string) => void;
    };
}
/** The part of `apply` that is testable without a host. */
export declare function createCapturePlugin(options: {
    config: unknown;
    deps: CaptureDeps;
    logger?: {
        warn: (m: string) => void;
    };
}): {
    readSettings: () => CaptureSettings;
    capture(args: {
        mode?: string;
        region?: unknown;
        format?: string;
    }): Promise<CaptureResult>;
    /** Hand the bytes to the host's attachment store and produce the model value. */
    execute(args: {
        mode?: string;
        region?: unknown;
        format?: string;
    }, attachments?: CaptureToolCtx["attachments"]): Promise<CaptureResult | {
        bytes: number;
        height?: number;
        width?: number;
        format: string;
        ok: boolean;
        attachment: unknown;
        mode: CaptureMode;
        /** Set when `mode: 'region'` was requested but no coordinates were given. */
        needsRegion?: boolean;
        error?: string;
    }>;
};
export type CapturePlugin = ReturnType<typeof createCapturePlugin>;
export declare function apply(ctx: unknown, config?: unknown): void;
