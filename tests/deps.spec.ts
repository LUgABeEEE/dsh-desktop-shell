import { describe, expect, it } from 'vitest'

/**
 * Integration guard for the real third-party modules.
 *
 * The unit tests inject fake backends, which means they cannot catch a broken
 * ESM interop shape in a dependency. That is not hypothetical: `clipboardy` v5
 * exposes `read()`, and the plugin was written against a guessed `readText()`.
 * Unit tests were green and the plugin still failed the moment it loaded the
 * real module. These tests load the real modules and assert the members the
 * plugin actually depends on exist.
 *
 * They only assert shape and that the callables are functions — they never fire
 * a real notification, and the capture/clipboard calls are skipped where they
 * would touch the desktop.
 */

describe('node-notifier', () => {
  it('exposes notify()', async () => {
    const mod = (await import('node-notifier')) as unknown as {
      default?: { notify?: unknown }
      notify?: unknown
    }
    const notifier = mod.default ?? mod
    expect(typeof notifier.notify).toBe('function')
  })
})

describe('clipboardy', () => {
  it('exposes read() on the default export, which is what loadClipboardDeps uses', async () => {
    const mod = (await import('clipboardy')) as unknown as { default?: { read?: unknown } }
    expect(typeof mod.default?.read).toBe('function')
    // The name the plugin used to guess must not exist, or the next reader will
    // "fix" the plugin back to it.
    expect((mod.default as { readText?: unknown })?.readText).toBeUndefined()
  })

  it('loadClipboardDeps resolves to a working reader', async () => {
    const { loadClipboardDeps, readClipboard } = await import('../src/clipboard.js')
    const deps = await loadClipboardDeps()
    const result = await readClipboard(deps)
    // Whatever is on the clipboard right now, reading must not throw.
    expect(result.ok).toBe(true)
    expect(typeof result.text).toBe('string')
  })
})

describe('screenshot-desktop', () => {
  it('default export is callable', async () => {
    const mod = (await import('screenshot-desktop')) as unknown as { default?: unknown }
    expect(typeof mod.default).toBe('function')
  })
})

describe('sharp', () => {
  it('is callable for cropping', async () => {
    const mod = (await import('sharp')) as unknown as { default?: unknown }
    expect(typeof mod.default).toBe('function')
  })

  it('loads the native binary and reports dimensions', async () => {
    const sharp = (await import('sharp')).default
    const png = await sharp({
      create: { width: 4, height: 3, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer()
    const meta = await sharp(png).metadata()
    expect(meta.width).toBe(4)
    expect(meta.height).toBe(3)
  })
})

describe('@deepseek-ai/schemastery', () => {
  it('provides the Schema used by every Config export', async () => {
    const Schema = (await import('@deepseek-ai/schemastery')).default
    expect(typeof Schema.object).toBe('function')
    const parsed = Schema.object({ a: Schema.boolean().default(true).volatile() })({})
    expect(typeof parsed.a.get).toBe('function')
    expect(parsed.a.get()).toBe(true)
  })
})

describe('built output', () => {
  it('every published entry loads and exposes a Standard Schema Config', async () => {
    for (const entry of ['index', 'notify', 'capture', 'clipboard', 'hotkey']) {
      const mod = (await import(`../lib/${entry}.js`)) as unknown as {
        name?: unknown
        inject?: unknown
        apply?: unknown
        Config?: { ['~standard']?: unknown }
      }
      expect(typeof mod.name, `${entry}.name`).toBe('string')
      expect(Array.isArray(mod.inject), `${entry}.inject`).toBe(true)
      expect(typeof mod.apply, `${entry}.apply`).toBe('function')
      if (entry !== 'index') {
        expect(mod.Config?.['~standard'], `${entry}.Config is not a Standard Schema`).toBeTruthy()
      }
    }
  })
})
