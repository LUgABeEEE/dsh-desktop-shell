import { describe, expect, it, vi } from 'vitest'

import {
  Config,
  TOOL_NAME,
  isRegion,
  captureScreen,
  createCapturePlugin,
  renderCapture,
  resolveSettings,
} from '../src/capture.js'
import type { CaptureDeps, CaptureResult } from '../src/capture.js'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02])

function deps(overrides: Partial<CaptureDeps> = {}): CaptureDeps {
  return {
    screenshot: vi.fn(async () => PNG),
    crop: vi.fn(async (data) => data),
    measure: vi.fn(async () => ({ width: 1920, height: 1080 })),
    ...overrides,
  }
}

const defaults = () => resolveSettings({})

describe('capture Config', () => {
  it('is a Standard Schema with volatile fields', () => {
    expect(Config['~standard']).toBeTruthy()
    const parsed = Config({}) as Record<string, { get(): unknown }>
    expect(Object.keys(parsed).sort()).toEqual(['defaultMode', 'imageFormat'])
    for (const key of Object.keys(parsed)) expect(typeof parsed[key]!.get).toBe('function')
  })

  it('rejects the unsupported window mode at config level', () => {
    expect(() => Config({ defaultMode: 'window' })).toThrow()
  })
})

describe('isRegion', () => {
  it('accepts a well-formed rect', () => {
    expect(isRegion({ x: 0, y: 0, width: 10, height: 10 })).toBe(true)
  })
  it('rejects partial, zero-sized and non-finite rects', () => {
    expect(isRegion({ x: 0, y: 0, width: 10 })).toBe(false)
    expect(isRegion({ x: 0, y: 0, width: 0, height: 10 })).toBe(false)
    expect(isRegion({ x: Number.NaN, y: 0, width: 1, height: 1 })).toBe(false)
    expect(isRegion(null)).toBe(false)
    expect(isRegion('x')).toBe(false)
  })
})

describe('captureScreen', () => {
  it('captures the full screen and reports size', async () => {
    const result = await captureScreen(defaults, deps(), {})
    expect(result).toMatchObject({ ok: true, mode: 'fullscreen', format: 'png', bytes: PNG.length })
    expect(result.width).toBe(1920)
    expect(result.data).toBe(PNG)
  })

  it('rejects window mode with an explanation instead of silently full-screening', async () => {
    const result = await captureScreen(defaults, deps(), { mode: 'window' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('window mode is not supported')
  })

  it('rejects an unknown mode', async () => {
    const result = await captureScreen(defaults, deps(), { mode: 'nope' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('unknown mode')
  })

  it('asks for a region when region mode has no rect', async () => {
    const result = await captureScreen(defaults, deps(), { mode: 'region' })
    expect(result).toMatchObject({ ok: false, needsRegion: true })
    expect(result.error).toContain('drag-to-select')
  })

  it('crops when region mode has a rect', async () => {
    const d = deps()
    const result = await captureScreen(defaults, d, { mode: 'region', region: { x: 5, y: 5, width: 100, height: 50 } })
    expect(result.ok).toBe(true)
    expect(d.crop).toHaveBeenCalledWith(PNG, { x: 5, y: 5, width: 100, height: 50 })
  })

  it('reports a crop failure without throwing', async () => {
    const d = deps({ crop: vi.fn(async () => { throw new Error('bad rect') }) })
    const result = await captureScreen(defaults, d, { mode: 'region', region: { x: 0, y: 0, width: 1, height: 1 } })
    expect(result).toMatchObject({ ok: false })
    expect(result.error).toContain('crop failed')
  })

  it('fails cleanly when sharp is missing and region is requested', async () => {
    const d = deps({ crop: undefined })
    const result = await captureScreen(defaults, d, { mode: 'region', region: { x: 0, y: 0, width: 1, height: 1 } })
    expect(result).toMatchObject({ ok: false })
    expect(result.error).toContain('sharp')
  })

  it('reports a screenshot failure without throwing', async () => {
    const d = deps({ screenshot: vi.fn(async () => { throw new Error('no display') }) })
    const result = await captureScreen(defaults, d, {})
    expect(result).toMatchObject({ ok: false })
    expect(result.error).toContain('capture failed')
  })

  it('still succeeds when measuring dimensions fails', async () => {
    const d = deps({ measure: vi.fn(async () => { throw new Error('bad header') }) })
    const result = await captureScreen(defaults, d, {})
    expect(result.ok).toBe(true)
    expect(result.width).toBeUndefined()
  })

  it('honours the format argument', async () => {
    const result = await captureScreen(defaults, deps(), { format: 'jpeg' })
    expect(result.format).toBe('jpeg')
  })
})

describe('createCapturePlugin.execute', () => {
  it('stores bytes in the host attachment store and returns no raw data', async () => {
    const saveImage = vi.fn(async () => ({ attachmentId: 'abc' }))
    const plugin = createCapturePlugin({ config: {}, deps: deps() })
    const result = (await plugin.execute({}, { saveImage })) as CaptureResult

    expect(saveImage).toHaveBeenCalledTimes(1)
    expect(saveImage.mock.calls[0]![0]).toMatchObject({ mediaType: 'image/png', name: 'screenshot-fullscreen' })
    expect(result.attachment).toEqual({ attachmentId: 'abc' })
    // The tool contract says execute returns only the canonical JSON value.
    expect(result.data).toBeUndefined()
  })

  it('uses the jpeg media type for jpeg captures', async () => {
    const saveImage = vi.fn(async () => ({ attachmentId: 'x' }))
    const plugin = createCapturePlugin({ config: {}, deps: deps() })
    await plugin.execute({ format: 'jpeg' }, { saveImage })
    expect(saveImage.mock.calls[0]![0]).toMatchObject({ mediaType: 'image/jpeg' })
  })

  it('explains itself when the host has no attachments service', async () => {
    const plugin = createCapturePlugin({ config: {}, deps: deps() })
    const result = await plugin.execute({}, undefined)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('ctx.attachments')
  })

  it('turns a store failure into a refusal', async () => {
    const saveImage = vi.fn(async () => { throw new Error('disk full') })
    const plugin = createCapturePlugin({ config: {}, deps: deps() })
    const result = await plugin.execute({}, { saveImage })
    expect(result).toMatchObject({ ok: false })
    expect(result.error).toContain('disk full')
  })
})

describe('renderCapture', () => {
  it('emits an image block plus a text summary on success', () => {
    const blocks = renderCapture({}, { ok: true, mode: 'region', format: 'png', bytes: 10, width: 4, height: 5, attachment: { id: 1 } })
    expect(blocks[0]).toEqual({ type: 'image', attachment: { id: 1 } })
    expect(blocks[1]!.text).toContain('region (4x5)')
  })

  it('never emits an image block on failure', () => {
    const blocks = renderCapture({}, { ok: false, mode: 'fullscreen', format: 'png', bytes: 0, error: 'nope' })
    expect(blocks.every((b) => b.type === 'text')).toBe(true)
    expect(blocks[0]!.text).toContain('nope')
  })
})

describe('capture tool contract', () => {
  it('declares parameters and a mandatory output', async () => {
    const mod = await import('../src/capture.js')
    expect(mod.TOOL_NAME).toBe(TOOL_NAME)
    expect(mod.TOOL_PARAMETERS.required).toBeUndefined()
    expect(mod.TOOL_PARAMETERS.properties.mode.enum).toEqual(['fullscreen', 'region'])
  })

  it('declares tools as a hard dependency', async () => {
    const mod = await import('../src/capture.js')
    expect(mod.inject).toEqual(['tools'])
    expect(mod.name).toBe('desktop-shell-capture')
  })
})
