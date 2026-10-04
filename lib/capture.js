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
import { CAPTURE_DEFAULTS } from './settings.js';
export const name = 'desktop-shell-capture';
export const inject = ['tools'];
/** Namespaced to avoid colliding with a host tool (the registry is layered). */
export const TOOL_NAME = 'desktop_capture_screen';
export const Config = Schema.object({
    defaultMode: Schema
        .union(['fullscreen', 'region'])
        .default(CAPTURE_DEFAULTS.defaultMode)
        .volatile(),
    imageFormat: Schema.union(['png', 'jpeg']).default(CAPTURE_DEFAULTS.imageFormat).volatile(),
});
const MEDIA_TYPES = { png: 'image/png', jpeg: 'image/jpeg' };
export function isRegion(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const r = value;
    return (typeof r.x === 'number' &&
        typeof r.y === 'number' &&
        typeof r.width === 'number' &&
        typeof r.height === 'number' &&
        Number.isFinite(r.x) &&
        Number.isFinite(r.y) &&
        r.width > 0 &&
        r.height > 0);
}
async function loadDeps() {
    const screenshotModule = (await import('screenshot-desktop'));
    const deps = {
        screenshot: async (format) => screenshotModule.default({ format }),
    };
    try {
        const sharp = (await import('sharp'));
        deps.crop = async (data, region) => sharp
            .default(data)
            .extract({ left: Math.round(region.x), top: Math.round(region.y), width: Math.round(region.width), height: Math.round(region.height) })
            .toBuffer();
        deps.measure = async (data) => {
            const meta = await sharp.default(data).metadata();
            return { width: meta.width ?? 0, height: meta.height ?? 0 };
        };
    }
    catch {
        // sharp is optional: full screen still works without it, region does not.
    }
    return deps;
}
/** Capture the screen. Pure with respect to the host so it can be tested. */
export async function captureScreen(readSettings, deps, args) {
    const settings = readSettings();
    const requested = (args.mode ?? settings.defaultMode);
    if (requested === 'window') {
        return {
            ok: false,
            mode: 'fullscreen',
            format: settings.imageFormat,
            bytes: 0,
            error: 'window mode is not supported: the host exposes no window handle. Use fullscreen or region.',
        };
    }
    if (requested !== 'fullscreen' && requested !== 'region') {
        return {
            ok: false,
            mode: 'fullscreen',
            format: settings.imageFormat,
            bytes: 0,
            error: `unknown mode "${requested}"; expected fullscreen or region`,
        };
    }
    const format = args.format === 'jpeg' || args.format === 'png' ? args.format : settings.imageFormat;
    const mode = requested;
    let data;
    try {
        data = await deps.screenshot(format);
    }
    catch (error) {
        return {
            ok: false,
            mode,
            format,
            bytes: 0,
            error: `capture failed: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
    if (mode === 'region') {
        if (!isRegion(args.region)) {
            // Not an error: tell the model exactly what to do differently.
            return {
                ok: false,
                mode,
                format,
                bytes: data.length,
                needsRegion: true,
                error: 'region mode needs an explicit { x, y, width, height } — there is no drag-to-select overlay',
            };
        }
        if (!deps.crop) {
            return { ok: false, mode, format, bytes: data.length, error: 'region mode requires sharp, which is not installed' };
        }
        try {
            data = await deps.crop(data, args.region);
        }
        catch (error) {
            return {
                ok: false,
                mode,
                format,
                bytes: data.length,
                error: `crop failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    let width;
    let height;
    if (deps.measure) {
        try {
            const size = await deps.measure(data);
            width = size.width;
            height = size.height;
        }
        catch {
            // Dimensions are cosmetic; a failure here must not fail the capture.
        }
    }
    return { ok: true, mode, format, bytes: data.length, width, height, data };
}
export const TOOL_PARAMETERS = {
    type: 'object',
    properties: {
        mode: {
            type: 'string',
            enum: ['fullscreen', 'region'],
            description: 'fullscreen captures every display; region needs an explicit rect. There is no drag overlay.',
        },
        region: {
            type: 'object',
            description: 'Required when mode is region.',
            properties: {
                x: { type: 'number', description: 'Left edge in screen pixels.' },
                y: { type: 'number', description: 'Top edge in screen pixels.' },
                width: { type: 'number', description: 'Width in pixels; must be greater than zero.' },
                height: { type: 'number', description: 'Height in pixels; must be greater than zero.' },
            },
            required: ['x', 'y', 'width', 'height'],
        },
        format: { type: 'string', enum: ['png', 'jpeg'], description: 'Image format. Defaults to the setting.' },
    },
};
export function renderCapture(_args, value) {
    const result = (value ?? {});
    if (!result.ok)
        return [{ type: 'text', text: `Screen capture failed: ${result.error ?? 'unknown error'}` }];
    const size = result.width && result.height ? ` (${result.width}x${result.height})` : '';
    const blocks = [];
    if (result.attachment)
        blocks.push({ type: 'image', attachment: result.attachment });
    blocks.push({
        type: 'text',
        text: `Captured the screen: ${result.mode}${size}, ${result.bytes} bytes of ${result.format}.`,
    });
    return blocks;
}
export function resolveSettings(config) {
    const raw = (config ?? {});
    const mode = raw.defaultMode;
    const format = raw.imageFormat;
    return {
        defaultMode: mode === 'region' || mode === 'fullscreen' ? mode : CAPTURE_DEFAULTS.defaultMode,
        imageFormat: format === 'jpeg' || format === 'png' ? format : CAPTURE_DEFAULTS.imageFormat,
    };
}
/** The part of `apply` that is testable without a host. */
export function createCapturePlugin(options) {
    const readSettings = () => resolveSettings(options.config);
    return {
        readSettings,
        async capture(args) {
            return captureScreen(readSettings, options.deps, args ?? {});
        },
        /** Hand the bytes to the host's attachment store and produce the model value. */
        async execute(args, attachments) {
            const result = await captureScreen(readSettings, options.deps, args ?? {});
            if (!result.ok || !result.data)
                return result;
            if (!attachments) {
                return { ...result, ok: false, error: 'host does not provide ctx.attachments, so the image cannot be delivered' };
            }
            try {
                const attachment = await attachments.saveImage({
                    data: result.data,
                    mediaType: MEDIA_TYPES[result.format],
                    name: `screenshot-${result.mode}`,
                });
                // The store normalizes: it may re-encode and downscale, so the stored ref
                // is the authority on what actually landed. Report its numbers rather
                // than the ones we measured from the raw capture, otherwise the model is
                // told a size and a format that no longer match the image it will see.
                const ref = (attachment ?? {});
                const { data: _bytes, ...rest } = result;
                return {
                    ...rest,
                    ok: true,
                    attachment,
                    ...(ref.mediaType ? { format: ref.mediaType.replace('image/', '') } : {}),
                    ...(ref.width ? { width: ref.width } : {}),
                    ...(ref.height ? { height: ref.height } : {}),
                    ...(ref.bytes ? { bytes: ref.bytes } : {}),
                };
            }
            catch (error) {
                const { data: _bytes, ...rest } = result;
                return {
                    ...rest,
                    ok: false,
                    error: `could not store the image: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    };
}
export function apply(ctx, config = {}) {
    const host = ctx;
    const logger = host.logger;
    // The native modules load on first use, so plugin load never fails on them.
    let pluginPromise;
    const plugin = async () => (pluginPromise ??= loadDeps().then((deps) => createCapturePlugin({ config, deps, logger })));
    host.inject(['tools'], (toolCtx) => {
        toolCtx.effect(() => {
            try {
                return toolCtx.tools.register({
                    name: TOOL_NAME,
                    description: 'Capture the screen and return it as an image in this conversation. Use it when the user asks what is '
                        + 'on screen, wants a screenshot, or refers to something visible on their desktop. Prefer fullscreen; '
                        + 'for region mode pass an explicit rectangle.',
                    parameters: TOOL_PARAMETERS,
                    output: { schema: { type: 'json' }, render: renderCapture },
                    async execute(args) {
                        try {
                            return (await plugin()).execute(args ?? {}, toolCtx.attachments);
                        }
                        catch (error) {
                            // A failed native load must surface as a refusal, not a broken turn.
                            logger?.warn?.(`[desktop-shell-capture] capture unavailable: ${String(error)}`);
                            return {
                                ok: false,
                                mode: 'fullscreen',
                                format: resolveSettings(config).imageFormat,
                                bytes: 0,
                                error: `screen capture unavailable: ${error instanceof Error ? error.message : String(error)}`,
                            };
                        }
                    },
                });
            }
            catch (error) {
                logger?.warn?.(`[desktop-shell-capture] ${TOOL_NAME} registration skipped: ${String(error)}`);
                return () => { };
            }
        }, 'desktop-shell-capture: capture tool');
    });
}
