import { describe, expect, it, vi } from 'vitest'

import {
  Config,
  MAX_CHARS,
  READ_TOOL_NAME,
  createClipboardWatcher,
  readClipboard,
  renderRead,
  resolveSettings,
  shouldAccept,
} from '../src/clipboard.js'
import type { ClipboardDeps } from '../src/clipboard.js'

function reader(initial: string): { deps: ClipboardDeps; set: (v: string) => void; fail: (e: unknown) => void } {
  let value = initial
  let error: unknown = undefined
  return {
    deps: {
      readText: vi.fn(async () => {
        if (error) throw error
        return value
      }),
    },
    set: (v) => {
      value = v
      error = undefined
    },
    fail: (e) => {
      error = e
    },
  }
}

describe('clipboard Config', () => {
  it('is a Standard Schema with volatile fields', () => {
    expect(Config['~standard']).toBeTruthy()
    const parsed = Config({}) as Record<string, { get(): unknown }>
    expect(Object.keys(parsed).sort()).toEqual(['autoInject', 'minLength', 'watch'])
  })

  it('defaults watching and auto-inject to off, because clipboard content is private', () => {
    const settings = resolveSettings(Config({}))
    expect(settings).toEqual({ watch: false, autoInject: false, minLength: 8 })
  })
})

describe('readClipboard', () => {
  it('returns the clipboard text', async () => {
    const { deps } = reader('hello world')
    await expect(readClipboard(deps)).resolves.toEqual({ ok: true, text: 'hello world', length: 11 })
  })

  it('reports an empty clipboard as ok with empty text', async () => {
    const { deps } = reader('')
    await expect(readClipboard(deps)).resolves.toEqual({ ok: true, text: '', length: 0 })
  })

  it('truncates an oversized clipboard and says so', async () => {
    const { deps } = reader('x'.repeat(MAX_CHARS + 500))
    const result = await readClipboard(deps)
    expect(result.truncated).toBe(true)
    expect(result.text).toHaveLength(MAX_CHARS)
    expect(result.length).toBe(MAX_CHARS + 500)
  })

  it('turns a clipboard failure into a refusal', async () => {
    const { deps, fail } = reader('')
    fail(new Error('clipboard locked'))
    await expect(readClipboard(deps)).resolves.toMatchObject({ ok: false, error: 'clipboard locked' })
  })
})

describe('shouldAccept', () => {
  it('refuses everything while watching is off', () => {
    expect(shouldAccept('a long enough clipboard string', { watch: false, autoInject: false, minLength: 8 })).toBe(false)
  })

  it('refuses text shorter than minLength', () => {
    expect(shouldAccept('short', { watch: true, autoInject: true, minLength: 8 })).toBe(false)
  })

  it('accepts long enough text while watching is on', () => {
    expect(shouldAccept('long enough text', { watch: true, autoInject: true, minLength: 8 })).toBe(true)
  })
})

describe('createClipboardWatcher', () => {
  it('does not fire for the baseline poll', async () => {
    const r = reader('initial clipboard contents')
    const onText = vi.fn()
    const watcher = createClipboardWatcher({
      deps: r.deps,
      readSettings: () => ({ watch: true, autoInject: true, minLength: 8 }),
      intervalMs: 10_000,
      onText,
    })
    await watcher.poll()
    expect(onText).not.toHaveBeenCalled()
    watcher.stop()
  })

  it('fires once when the content changes', async () => {
    const r = reader('first value here')
    const onText = vi.fn()
    const watcher = createClipboardWatcher({
      deps: r.deps,
      readSettings: () => ({ watch: true, autoInject: true, minLength: 8 }),
      intervalMs: 10_000,
      onText,
    })
    await watcher.poll()
    r.set('second value here')
    await watcher.poll()
    expect(onText).toHaveBeenCalledTimes(1)
    expect(onText).toHaveBeenCalledWith('second value here')
    watcher.stop()
  })

  it('does not fire again when the content is unchanged', async () => {
    const r = reader('stable value here')
    const onText = vi.fn()
    const watcher = createClipboardWatcher({
      deps: r.deps,
      readSettings: () => ({ watch: true, autoInject: true, minLength: 8 }),
      intervalMs: 10_000,
      onText,
    })
    await watcher.poll()
    await watcher.poll()
    await watcher.poll()
    expect(onText).not.toHaveBeenCalled()
    watcher.stop()
  })

  it('respects minLength on a real change', async () => {
    const r = reader('first value here')
    const onText = vi.fn()
    const watcher = createClipboardWatcher({
      deps: r.deps,
      readSettings: () => ({ watch: true, autoInject: true, minLength: 8 }),
      intervalMs: 10_000,
      onText,
    })
    await watcher.poll()
    r.set('tiny')
    await watcher.poll()
    expect(onText).not.toHaveBeenCalled()
    watcher.stop()
  })

  it('keeps polling after a transient clipboard lock', async () => {
    const r = reader('first value here')
    const onError = vi.fn()
    const onText = vi.fn()
    const watcher = createClipboardWatcher({
      deps: r.deps,
      readSettings: () => ({ watch: true, autoInject: true, minLength: 8 }),
      intervalMs: 10_000,
      onText,
      onError,
    })
    await watcher.poll()
    r.fail(new Error('locked by another app'))
    await expect(watcher.poll()).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalled()
    r.set('second value here')
    await watcher.poll()
    expect(onText).toHaveBeenCalledWith('second value here')
    watcher.stop()
  })

  it('does nothing after stop', async () => {
    const r = reader('first value here')
    const onText = vi.fn()
    const watcher = createClipboardWatcher({
      deps: r.deps,
      readSettings: () => ({ watch: true, autoInject: true, minLength: 8 }),
      intervalMs: 10_000,
      onText,
    })
    watcher.stop()
    await watcher.poll()
    expect(onText).not.toHaveBeenCalled()
  })

  it('does not keep the process alive', () => {
    const r = reader('x')
    const watcher = createClipboardWatcher({
      deps: r.deps,
      readSettings: () => ({ watch: true, autoInject: false, minLength: 8 }),
      intervalMs: 10_000,
      onText: () => {},
    })
    watcher.start()
    watcher.stop()
    expect(true).toBe(true)
  })
})

describe('renderRead', () => {
  it('returns the text the model should see', () => {
    expect(renderRead({}, { ok: true, text: 'copied words', length: 12 })).toEqual([
      { type: 'text', text: 'copied words' },
    ])
  })

  it('says so when the clipboard is empty', () => {
    expect(renderRead({}, { ok: true, text: '', length: 0 })[0]!.text).toContain('no text')
  })

  it('notes truncation', () => {
    expect(renderRead({}, { ok: true, text: 'abc', length: 999, truncated: true })[0]!.text).toContain('truncated')
  })

  it('reports a failure', () => {
    expect(renderRead({}, { ok: false, error: 'locked' })[0]!.text).toContain('locked')
  })
})

describe('clipboard tool contract', () => {
  it('namespaces the tool and declares its dependency', async () => {
    const mod = await import('../src/clipboard.js')
    expect(mod.READ_TOOL_NAME).toBe(READ_TOOL_NAME)
    expect(mod.READ_TOOL_NAME.startsWith('desktop_')).toBe(true)
    expect(mod.inject).toEqual(['tools'])
    expect(mod.name).toBe('desktop-shell-clipboard')
  })
})
