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

import Schema from '@deepseek-ai/schemastery'

import { CAPTURE_DEFAULTS } from './settings.js'

export const name = 'desktop-shell-capture'
export const inject: string[] = ['tools']

/** Namespaced to avoid colliding with a host tool (the registry is layered). */
export const TOOL_NAME = 'desktop_capture_screen'

export type CaptureMode = 'fullscreen' | 'region'
export type ImageFormat = 'png' | 'jpeg'

export interface CaptureSettings {
  defaultMode: CaptureMode
  imageFormat: ImageFormat
}

export interface Region {
  x: number
  y: number
  width: number
  height: number
}

export const Config = Schema.object({
  defaultMode: Schema
    .union(['fullscreen', 'region'] as const)
    .default(CAPTURE_DEFAULTS.defaultMode)
    .volatile(),
  imageFormat: Schema.union(['png', 'jpeg'] as const).default(CAPTURE_DEFAULTS.imageFormat).volatile(),
})

export interface CaptureDeps {
  /** Returns raw image bytes for the whole screen. */
  screenshot: (format: ImageFormat) => Promise<Buffer>
  /** Crops bytes to a region; absent when `sharp` is not installed. */
  crop?: (data: Buffer, region: Region) => Promise<Buffer>
  /** Reads image dimensions; absent when `sharp` is not installed. */
  measure?: (data: Buffer) => Promise<{ width: number; height: number }>
}

export interface CapturedImage {
  data: Buffer
  mediaType: 'image/png' | 'image/jpeg'
  width?: number
  height?: number
}

export interface CaptureResult {
  ok: boolean
  mode: CaptureMode
  format: ImageFormat
  bytes: number
  width?: number
  height?: number
  /** Raw bytes. Only present on success and stripped before reaching the model. */
  data?: Buffer
  /** Present once the host has stored it; rendered as an image content block. */
  attachment?: unknown
  /** Set when `mode: 'region'` was requested but no coordinates were given. */
  needsRegion?: boolean
  error?: string
}

const MEDIA_TYPES = { png: 'image/png', jpeg: 'image/jpeg' } as const

export function isRegion(value: unknown): value is Region {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return (
    typeof r.x === 'number' &&
    typeof r.y === 'number' &&
    typeof r.width === 'number' &&
    typeof r.height === 'number' &&
    Number.isFinite(r.x) &&
    Number.isFinite(r.y) &&
    r.width > 0 &&
    r.height > 0
  )
}

async function loadDeps(): Promise<CaptureDeps> {
  const screenshotModule = (await import('screenshot-desktop')) as unknown as {
    default: (options: { format: string }) => Promise<Buffer>
  }
  const deps: CaptureDeps = {
    screenshot: async (format) => screenshotModule.default({ format }),
  }
  try {
    const sharp = (await import('sharp')) as unknown as {
      default: (input: Buffer) => {
        extract: (r: { left: number; top: number; width: number; height: number }) => {
          toBuffer: () => Promise<Buffer>
        }
        metadata: () => Promise<{ width?: number; height?: number }>
        toFormat: (format: string) => { toBuffer: () => Promise<Buffer> }
      }
    }
    deps.crop = async (data, region) =>
      sharp
        .default(data)
        .extract({ left: Math.round(region.x), top: Math.round(region.y), width: Math.round(region.width), height: Math.round(region.height) })
        .toBuffer()
    deps.measure = async (data) => {
      const meta = await sharp.default(data).metadata()
      return { width: meta.width ?? 0, height: meta.height ?? 0 }
    }
  } catch {
    // sharp is optional: full screen still works without it, region does not.
  }
  return deps
}

/** Capture the screen. Pure with respect to the host so it can be tested. */
export async function captureScreen(
  readSettings: () => CaptureSettings,
  deps: CaptureDeps,
  args: { mode?: string; region?: unknown; format?: string },
): Promise<CaptureResult> {
  const settings = readSettings()
  const requested = (args.mode ?? settings.defaultMode) as string

  if (requested === 'window') {
    return {
      ok: false,
      mode: 'fullscreen',
      format: settings.imageFormat,
      bytes: 0,
      error: 'window mode is not supported: the host exposes no window handle. Use fullscreen or region.',
    }
  }
  if (requested !== 'fullscreen' && requested !== 'region') {
    return {
      ok: false,
      mode: 'fullscreen',
      format: settings.imageFormat,
      bytes: 0,
      error: `unknown mode "${requested}"; expected fullscreen or region`,
    }
  }

  const format: ImageFormat = args.format === 'jpeg' || args.format === 'png' ? args.format : settings.imageFormat
  const mode: CaptureMode = requested

  let data: Buffer
  try {
    data = await deps.screenshot(format)
  } catch (error) {
    return {
      ok: false,
      mode,
      format,
      bytes: 0,
      error: `capture failed: ${error instanceof Error ? error.message : String(error)}`,
    }
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
      }
    }
    if (!deps.crop) {
      return { ok: false, mode, format, bytes: data.length, error: 'region mode requires sharp, which is not installed' }
    }
    try {
      data = await deps.crop(data, args.region)
    } catch (error) {
      return {
        ok: false,
        mode,
        format,
        bytes: data.length,
        error: `crop failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  let width: number | undefined
  let height: number | undefined
  if (deps.measure) {
    try {
      const size = await deps.measure(data)
      width = size.width
      height = size.height
    } catch {
      // Dimensions are cosmetic; a failure here must not fail the capture.
    }
  }

  return { ok: true, mode, format, bytes: data.length, width, height, data }
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
} as const

export interface ContentBlock {
  type: string
  text?: string
  attachment?: unknown
}

export function renderCapture(_args: unknown, value: unknown): ContentBlock[] {
  const result = (value ?? {}) as CaptureResult
  if (!result.ok) return [{ type: 'text', text: `Screen capture failed: ${result.error ?? 'unknown error'}` }]
  const size = result.width && result.height ? ` (${result.width}x${result.height})` : ''
  const blocks: ContentBlock[] = []
  if (result.attachment) blocks.push({ type: 'image', attachment: result.attachment })
  blocks.push({
    type: 'text',
    text: `Captured the screen: ${result.mode}${size}, ${result.bytes} bytes of ${result.format}.`,
  })
  return blocks
}

export function resolveSettings(config: unknown): CaptureSettings {
  const raw = (config ?? {}) as Record<string, unknown>
  const mode = raw.defaultMode as CaptureSettings['defaultMode'] | undefined
  const format = raw.imageFormat as ImageFormat | undefined
  return {
    defaultMode: mode === 'region' || mode === 'fullscreen' ? mode : CAPTURE_DEFAULTS.defaultMode,
    imageFormat: format === 'jpeg' || format === 'png' ? format : CAPTURE_DEFAULTS.imageFormat,
  }
}

export interface CaptureToolCtx {
  attachments?: { saveImage: (input: { data: Buffer; mediaType: string; name?: string }) => Promise<unknown> }
  tools: { register: (spec: Record<string, unknown>) => unknown }
  effect: (fn: () => unknown, label?: string) => unknown
  logger?: { warn: (m: string) => void }
}

/** The part of `apply` that is testable without a host. */
export function createCapturePlugin(options: { config: unknown; deps: CaptureDeps; logger?: { warn: (m: string) => void } }) {
  const readSettings = () => resolveSettings(options.config)
  return {
    readSettings,
    async capture(args: { mode?: string; region?: unknown; format?: string }) {
      return captureScreen(readSettings, options.deps, args ?? {})
    },
    /** Hand the bytes to the host's attachment store and produce the model value. */
    async execute(args: { mode?: string; region?: unknown; format?: string }, attachments?: CaptureToolCtx['attachments']) {
      const result = await captureScreen(readSettings, options.deps, args ?? {})
      if (!result.ok || !result.data) return result
      if (!attachments) {
        return { ...result, ok: false, error: 'host does not provide ctx.attachments, so the image cannot be delivered' }
      }
      try {
        const attachment = await attachments.saveImage({
          data: result.data,
          mediaType: MEDIA_TYPES[result.format],
          name: `screenshot-${result.mode}`,
        })
        // `data` must not leak into the model value: the tool contract says
        // execute returns only the canonical JSON value declared by output.schema.
        const { data: _bytes, ...rest } = result
        return { ...rest, ok: true, attachment }
      } catch (error) {
        const { data: _bytes, ...rest } = result
        return {
          ...rest,
          ok: false,
          error: `could not store the image: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    },
  }
}

export type CapturePlugin = ReturnType<typeof createCapturePlugin>

export function apply(ctx: unknown, config: unknown = {}): void {
  const host = ctx as { inject: (names: string[], fn: (t: CaptureToolCtx) => void) => void; logger?: { warn: (m: string) => void } }
  const logger = host.logger
  // The native modules load on first use, so plugin load never fails on them.
  let pluginPromise: Promise<CapturePlugin> | undefined
  const plugin = async (): Promise<CapturePlugin> => (pluginPromise ??= loadDeps().then((deps) => createCapturePlugin({ config, deps, logger })))

  host.inject(['tools'], (toolCtx) => {
    toolCtx.effect(() => {
      try {
        return toolCtx.tools.register({
          name: TOOL_NAME,
          description:
            'Capture the screen and return it as an image in this conversation. Use it when the user asks what is '
            + 'on screen, wants a screenshot, or refers to something visible on their desktop. Prefer fullscreen; '
            + 'for region mode pass an explicit rectangle.',
          parameters: TOOL_PARAMETERS,
          output: { schema: { type: 'json' }, render: renderCapture },
          async execute(args: { mode?: string; region?: unknown; format?: string }) {
            try {
              return (await plugin()).execute(args ?? {}, toolCtx.attachments)
            } catch (error) {
              // A failed native load must surface as a refusal, not a broken turn.
              logger?.warn?.(`[desktop-shell-capture] capture unavailable: ${String(error)}`)
              return {
                ok: false,
                mode: 'fullscreen',
                format: resolveSettings(config).imageFormat,
                bytes: 0,
                error: `screen capture unavailable: ${error instanceof Error ? error.message : String(error)}`,
              }
            }
          },
        })
      } catch (error) {
        logger?.warn?.(`[desktop-shell-capture] ${TOOL_NAME} registration skipped: ${String(error)}`)
        return () => {}
      }
    }, 'desktop-shell-capture: capture tool')
  })
}
