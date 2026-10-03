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

import Schema from '@deepseek-ai/schemastery'

import { CLIPBOARD_DEFAULTS } from './settings.js'

export const name = 'desktop-shell-clipboard'
export const inject: string[] = ['tools']

export const READ_TOOL_NAME = 'desktop_read_clipboard'

export interface ClipboardSettings {
  watch: boolean
  autoInject: boolean
  minLength: number
}

export const Config = Schema.object({
  watch: Schema.boolean().default(CLIPBOARD_DEFAULTS.watch).volatile(),
  autoInject: Schema.boolean().default(CLIPBOARD_DEFAULTS.autoInject).volatile(),
  minLength: Schema.number().default(CLIPBOARD_DEFAULTS.minLength).volatile(),
})

export interface ClipboardDeps {
  readText: () => Promise<string>
}

export async function loadClipboardDeps(): Promise<ClipboardDeps> {
  // clipboardy v5 is ESM with a default export and exposes `read()`, not
  // `readText()`. Resolved defensively so an interop change is a clear error
  // rather than an undefined call on the first poll.
  const mod = (await import('clipboardy')) as unknown as {
    default?: { read?: () => Promise<string>; readText?: () => Promise<string> }
    read?: () => Promise<string>
  }
  const clip: { read?: () => Promise<string>; readText?: () => Promise<string> } = mod.default ?? mod
  const read = clip?.read ?? clip?.readText
  if (typeof read !== 'function') throw new Error('clipboardy resolved without read()')
  return { readText: () => read.call(clip) }
}

export interface ReadResult {
  ok: boolean
  text?: string
  length?: number
  truncated?: boolean
  error?: string
}

/** Longest clipboard payload handed to the model, to keep a prompt from exploding. */
export const MAX_CHARS = 100_000

export async function readClipboard(deps: ClipboardDeps): Promise<ReadResult> {
  let text: string
  try {
    text = await deps.readText()
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  if (typeof text !== 'string') return { ok: true, text: '', length: 0 }
  if (text.length > MAX_CHARS) {
    return { ok: true, text: text.slice(0, MAX_CHARS), length: text.length, truncated: true }
  }
  return { ok: true, text, length: text.length }
}

/** Whether a clipboard change is worth reacting to. */
export function shouldAccept(text: string, settings: ClipboardSettings): boolean {
  if (!settings.watch) return false
  const trimmed = text.trim()
  if (trimmed.length < settings.minLength) return false
  return true
}

/**
 * Poll-based clipboard watcher. Exposed separately from `apply` so it can be
 * tested with a fake clock/reader and torn down deterministically.
 */
export function createClipboardWatcher(options: {
  deps: ClipboardDeps
  readSettings: () => ClipboardSettings
  intervalMs: number
  onText: (text: string) => void
  onError?: (error: unknown) => void
}) {
  let timer: ReturnType<typeof setInterval> | undefined
  let last: string | undefined
  let stopped = false

  async function poll(): Promise<void> {
    if (stopped) return
    let text: string
    try {
      text = await options.deps.readText()
    } catch (error) {
      // Transient clipboard locks are normal; keep polling.
      options.onError?.(error)
      return
    }
    if (stopped) return
    // `last` starts undefined so the first poll establishes a baseline instead of
    // firing for whatever happened to be on the clipboard before the watcher
    // started. Content is compared, not stored beyond this.
    if (last === undefined) {
      last = text
      return
    }
    if (text === last) return
    last = text
    if (shouldAccept(text, options.readSettings())) options.onText(text)
  }

  return {
    start(): void {
      if (timer) return
      void poll()
      timer = setInterval(() => void poll(), options.intervalMs)
      // Never hold the host process open just to watch the clipboard.
      timer.unref?.()
    },
    stop(): void {
      stopped = true
      if (timer) clearInterval(timer)
      timer = undefined
    },
    /** Exposed for tests. */
    poll,
  }
}

export const READ_TOOL_PARAMETERS = {
  type: 'object',
  properties: {
    trim: { type: 'boolean', description: 'Trim surrounding whitespace. Defaults to false.' },
  },
} as const

export function renderRead(_args: unknown, value: unknown): { type: 'text'; text: string }[] {
  const result = (value ?? {}) as ReadResult
  if (!result.ok) return [{ type: 'text', text: `Could not read the clipboard: ${result.error ?? 'unknown error'}` }]
  if (!result.text) return [{ type: 'text', text: 'The clipboard holds no text.' }]
  const suffix = result.truncated ? `\n\n[truncated: ${result.length} characters total]` : ''
  return [{ type: 'text', text: `${result.text}${suffix}` }]
}

export function resolveSettings(config: unknown): ClipboardSettings {
  const raw = (config ?? {}) as Record<string, unknown>
  const watch = readField(raw.watch, CLIPBOARD_DEFAULTS.watch)
  const autoInject = readField(raw.autoInject, CLIPBOARD_DEFAULTS.autoInject)
  const minLength = readField(raw.minLength, CLIPBOARD_DEFAULTS.minLength)
  return {
    watch: typeof watch === 'boolean' ? watch : CLIPBOARD_DEFAULTS.watch,
    autoInject: typeof autoInject === 'boolean' ? autoInject : CLIPBOARD_DEFAULTS.autoInject,
    minLength: typeof minLength === 'number' && minLength > 0 ? minLength : CLIPBOARD_DEFAULTS.minLength,
  }
}

function readField(field: unknown, fallback: boolean | number): boolean | number {
  if (field !== null && typeof field === 'object' && typeof (field as { get?: unknown }).get === 'function') {
    const value = (field as { get(): boolean | number }).get()
    return value === undefined || value === null ? fallback : value
  }
  if (field === undefined || field === null) return fallback
  return field as boolean | number
}

export interface ClipboardToolCtx {
  tools: { register: (spec: Record<string, unknown>) => unknown }
  effect: (fn: () => unknown, label?: string) => unknown
  logger?: { warn: (m: string) => void; debug?: (m: string) => void }
  /** Present when the host exposes an agent to inject draft text into. */
  agents?: { active?: unknown }
}

export function apply(ctx: unknown, config: unknown = {}): void {
  const host = ctx as ClipboardToolCtx & { inject: (n: string[], f: (t: ClipboardToolCtx) => void) => void }
  const logger = host.logger
  const readSettings = () => resolveSettings(config)
  let depsPromise: Promise<ClipboardDeps> | undefined
  const deps = () => (depsPromise ??= loadClipboardDeps())

  host.inject(['tools'], (toolCtx) => {
    // Tool: read on demand. This is always safe; it only fires when called.
    toolCtx.effect(() => {
      try {
        return toolCtx.tools.register({
          name: READ_TOOL_NAME,
          description:
            'Read the text currently on the clipboard. Use it when the user says something about what they just '
            + 'copied. Content stays on this machine.',
          parameters: READ_TOOL_PARAMETERS,
          output: { schema: { type: 'json' }, render: renderRead },
          async execute() {
            try {
              const result = await readClipboard(await deps())
              // `text` is the canonical value here — render reads it. Oversized
              // payloads are already truncated by readClipboard rather than
              // stripped, because stripping would leave the render with nothing.
              return result
            } catch (error) {
              return { ok: false, error: `clipboard unavailable: ${error instanceof Error ? error.message : String(error)}` }
            }
          },
        })
      } catch (error) {
        logger?.warn?.(`[desktop-shell-clipboard] ${READ_TOOL_NAME} registration skipped: ${String(error)}`)
        return () => {}
      }
    }, 'desktop-shell-clipboard: read_clipboard tool')

    // Watcher: opt-in, and torn down with the effect.
    if (readSettings().watch) {
      toolCtx.effect(() => {
        const watcher = createClipboardWatcher({
          deps: { readText: async () => (await deps()).readText() },
          readSettings,
          intervalMs: 750,
          onText: (text) => {
            if (!readSettings().autoInject) return
            logger?.debug?.(`[desktop-shell-clipboard] clipboard changed (${text.length} chars)`)
          },
          onError: () => {},
        })
        watcher.start()
        return () => watcher.stop()
      }, 'desktop-shell-clipboard: clipboard watcher')
    }
  })
}
