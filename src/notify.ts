/**
 * B — native OS notifications (P0).
 *
 * Every integration point below was verified against the vendored Cordis/DSH
 * source and against plugins actually installed in this desktop profile, not
 * assumed. The corrections that matter when editing this file:
 *
 *   - the tool spec field is `parameters` (JSON Schema) — there is no `schema`
 *   - `output: { schema, render }` is MANDATORY; `execute` returns the canonical
 *     JSON value and `render` turns it into content blocks
 *   - `Config` must be a Schemastery schema (Standard Schema). A plain object is
 *     silently not a validator and the row's settings page never appears
 *   - `.volatile()` fields reach `apply` as a wrapper; read them with `.get()`
 *   - `agent/turn-stopping` is a *serial* event: `{ agent, turn, signal }`, no
 *     `next()`, and it is awaited — so never block it on a notification
 *   - approvals surface through the `approval/request` waterfall, which is the
 *     accurate seam; guessing tool names in `tools/pre-execute` is not
 *
 * Design rule: a notification must never break an agent turn or take the host
 * down. Every backend call is contained and every hook swallows its errors.
 */

import Schema from '@deepseek-ai/schemastery'

import { NOTIFY_DEFAULTS, readConfigField } from './settings.js'

export const name = 'desktop-shell-notify'
export const inject: string[] = ['tools']

/** Resolved (plain) settings, after volatile wrappers have been read. */
export interface NotifySettings {
  onTaskComplete: boolean
  onApprovalNeeded: boolean
  sound: boolean
  titlePrefix: string
}

/**
 * Settings schema. Cordis validates this through the Standard Schema interface
 * and fills defaults from it; every field is `.volatile()` so each one shows up
 * as an editable field on the settings page (the form id is the `desktop-shell-notify`
 * entry id from cordis.patch.yml). Volatile also means a change does NOT remount
 * the fiber, which is why settings are read at use time rather than captured in
 * `apply`.
 */
export const Config = Schema.object({
  onTaskComplete: Schema.boolean().default(NOTIFY_DEFAULTS.onTaskComplete).volatile(),
  onApprovalNeeded: Schema.boolean().default(NOTIFY_DEFAULTS.onApprovalNeeded).volatile(),
  sound: Schema.boolean().default(NOTIFY_DEFAULTS.sound).volatile(),
  titlePrefix: Schema.string().default(NOTIFY_DEFAULTS.titlePrefix).volatile(),
})

/**
 * Tool name registered with the host. Deliberately our own rather than `notify`:
 * dsh's registry is layered and a host tool of the same name would shadow ours.
 */
export const TOOL_NAME = 'desktop_notify'

export interface NotifyRequest {
  title: string
  message: string
  sound: boolean
  urgent: boolean
}

/** Everything a backend must do. Minimal so tests can substitute one. */
export type NotifyBackend = (request: NotifyRequest) => Promise<void>

export interface NotifyResult {
  ok: boolean
  delivered: boolean
  title: string
  /** Present on failure; the tool reports the refusal rather than throwing. */
  error?: string
}

export interface NotifyInput {
  title?: string
  message?: string
  urgent?: boolean
}

export function resolveSettings(config: unknown): NotifySettings {
  const raw = (config ?? {}) as Record<string, unknown>
  return {
    onTaskComplete: readConfigField(raw.onTaskComplete as never, NOTIFY_DEFAULTS.onTaskComplete),
    onApprovalNeeded: readConfigField(raw.onApprovalNeeded as never, NOTIFY_DEFAULTS.onApprovalNeeded),
    sound: readConfigField(raw.sound as never, NOTIFY_DEFAULTS.sound),
    titlePrefix: readConfigField(raw.titlePrefix as never, NOTIFY_DEFAULTS.titlePrefix),
  }
}

/**
 * `urgent` is not uniformly supported by OS backends (Windows Focus Assist can
 * drop a toast regardless), so it only escalates sound and is passed through to
 * backends that understand `urgency`. See PLAN.md §6.
 */
export function buildTitle(prefix: string, title: string | undefined, fallback: string): string {
  const body = (title ?? '').trim() || fallback
  return `${prefix}${body}`
}

/**
 * Lazily load node-notifier. The host ships no notification service and does not
 * bundle node-notifier, so this is a real runtime dependency — but it is imported
 * on first use rather than at module load so a broken install degrades to
 * "notifications unavailable" instead of failing the whole plugin row.
 */
export async function loadNodeNotifierBackend(): Promise<NotifyBackend> {
  const mod = await import('node-notifier')
  // Interop: the package is CJS, so under NodeNext the callable may sit on
  // `default` or directly on the namespace.
  const candidate = (mod as { default?: { notify?: unknown } }).default ?? (mod as { notify?: unknown })
  const notify = candidate?.notify
  if (typeof notify !== 'function') {
    throw new Error('node-notifier resolved without a notify() function')
  }
  const send = notify as (options: Record<string, unknown>) => void
  return (request) =>
    new Promise<void>((resolve, reject) => {
      try {
        send({
          title: request.title,
          message: request.message,
          sound: request.sound,
          wait: false,
          ...(request.urgent ? { urgency: 'critical' } : {}),
        })
        resolve()
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
}

/**
 * Build the notification service around a backend. This is the unit-testable
 * core; `apply` below only wires it into the host.
 */
export function createNotifier(readSettings: () => NotifySettings, backend: NotifyBackend) {
  return async function send(input: NotifyInput): Promise<NotifyResult> {
    const settings = readSettings()
    const message = (input.message ?? '').toString()
    if (!message.trim()) {
      return { ok: false, delivered: false, title: settings.titlePrefix, error: 'message must not be empty' }
    }
    const urgent = input.urgent === true
    const title = buildTitle(settings.titlePrefix, input.title, urgent ? 'Needs attention' : 'Done')
    try {
      // urgent escalates the sound even when normal notifications are muted.
      await backend({ title, message, sound: settings.sound || urgent, urgent })
      return { ok: true, delivered: true, title }
    } catch (error) {
      return {
        ok: false,
        delivered: false,
        title,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

export type NotifyFn = ReturnType<typeof createNotifier>

export interface MinimalLogger {
  warn: (message: string) => void
  debug?: (message: string) => void
  error?: (message: string) => void
}

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolCtx {
  tools: { register: (spec: Record<string, unknown>) => unknown }
  effect: (fn: () => unknown, label?: string) => unknown
  logger?: MinimalLogger
}

export interface HostCtx {
  inject: (names: string[], fn: (ctx: ToolCtx) => void) => void
  on: (event: string, handler: (...args: never[]) => unknown) => unknown
  logger?: MinimalLogger
}

/** Read a session id off an agent without assuming its exact internal shape. */
export function sessionIdOf(agent: unknown): string | undefined {
  const a = agent as { session?: { header?: { id?: string }; id?: string }; id?: string } | undefined
  return a?.session?.header?.id ?? a?.session?.id ?? a?.id
}

export const TOOL_PARAMETERS = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short notification title. Omit to use a default.' },
    message: { type: 'string', description: 'Body text shown in the notification.' },
    urgent: { type: 'boolean', description: 'Escalate: plays the sound even when muted. Use sparingly.' },
  },
  required: ['message'],
} as const

export function renderNotifyResult(_args: unknown, value: unknown): TextBlock[] {
  const result = (value ?? {}) as NotifyResult
  const text = result.ok
    ? `Notification delivered: "${result.title}"`
    : `Notification not delivered: ${result.error ?? 'unknown error'}`
  return [{ type: 'text', text }]
}

/**
 * The plugin's behaviour, independent of the host. Kept separate from `apply` so
 * tests can drive it with a fake backend and never pop a real notification.
 */
export function createNotifyPlugin(options: { config: unknown; backend: NotifyBackend; logger?: MinimalLogger }) {
  const { logger } = options
  const readSettings = () => resolveSettings(options.config)
  const notify = createNotifier(readSettings, options.backend)

  /** Fire-and-forget: used from hooks that must not block the agent. */
  const fire = (input: NotifyInput, label: string) => {
    notify(input).catch((error: unknown) => logger?.warn?.(`[desktop-shell-notify] ${label} failed: ${String(error)}`))
  }

  function registerTools(toolCtx: ToolCtx): void {
    toolCtx.effect(() => {
      try {
        return toolCtx.tools.register({
          name: TOOL_NAME,
          description:
            'Send a native operating-system notification. Use it when a task finishes while the user is looking '
            + 'elsewhere, when the user must approve something, or when the user explicitly asks to be notified. '
            + 'Text stays on the local machine.',
          parameters: TOOL_PARAMETERS,
          output: { schema: { type: 'json' }, render: renderNotifyResult },
          execute: (args: NotifyInput) => notify(args ?? {}),
        })
      } catch (error) {
        // A duplicate name or a host-side surface change must not take down the
        // whole row; modlens takes the same degrade-loudly approach.
        logger?.warn?.(`[desktop-shell-notify] ${TOOL_NAME} registration skipped: ${String(error)}`)
        return () => {}
      }
    }, 'desktop-shell-notify: notify tool')
  }

  /**
   * Turn finished. `agent/turn-stopping` is a *serial* event that the host awaits
   * before the turn boundary commits, so this deliberately does not await the
   * notification.
   */
  function handleTurnStopping(payload: { agent?: unknown } | undefined): void {
    if (!readSettings().onTaskComplete) return
    const sessionId = sessionIdOf(payload?.agent)
    fire(
      {
        title: 'Task complete',
        message: sessionId ? `Session ${sessionId} finished its turn.` : 'The turn finished.',
      },
      'turn notification',
    )
  }

  /**
   * The user is being asked to decide something. This is the accurate seam:
   * `approval/request` only fires when the host actually gates on the user,
   * unlike guessing at tool names in `tools/pre-execute`. Always call next() —
   * it is a waterfall.
   */
  async function handleApprovalRequest(req: { agent?: unknown; toolName?: string } | undefined, next: () => unknown) {
    try {
      if (readSettings().onApprovalNeeded) {
        const sessionId = sessionIdOf(req?.agent)
        const what = req?.toolName ? ` (${req.toolName})` : ''
        fire(
          {
            title: 'Approval needed',
            message: sessionId ? `Session ${sessionId} is waiting on you${what}.` : `The agent is waiting on you${what}.`,
            urgent: true,
          },
          'approval notification',
        )
      }
    } catch (error) {
      logger?.warn?.(`[desktop-shell-notify] approval hook failed: ${String(error)}`)
    }
    return next()
  }

  return { notify, registerTools, handleTurnStopping, handleApprovalRequest }
}

export type NotifyPlugin = ReturnType<typeof createNotifyPlugin>

export function apply(ctx: unknown, config: unknown = {}): void {
  const host = ctx as HostCtx
  const logger = host.logger

  // Resolved once and reused, so a broken backend surfaces as a single logged
  // warning rather than an exception on every turn.
  let backendPromise: Promise<NotifyBackend> | undefined
  const backend = (): Promise<NotifyBackend> => {
    backendPromise ??= loadNodeNotifierBackend().catch((error: unknown) => {
      logger?.warn?.(`[desktop-shell-notify] notifications unavailable: ${String(error)}`)
      throw error
    })
    return backendPromise
  }

  // The backend is resolved lazily, so a host that never triggers a notification
  // never pays for it, and a missing install cannot fail plugin load.
  let plugin: NotifyPlugin | undefined
  const ensure = async (): Promise<NotifyPlugin | undefined> => {
    if (plugin) return plugin
    try {
      plugin = createNotifyPlugin({ config, backend: await backend(), logger })
      return plugin
    } catch {
      // Report as a failed delivery rather than throwing, so the agent turn
      // continues and the model can tell the user why nothing appeared.
      return undefined
    }
  }

  // Tool: the model can raise a notification on demand (PLAN.md §4.2).
  host.inject(['tools'], (toolCtx) => {
    toolCtx.effect(() => {
      try {
        return toolCtx.tools.register({
          name: TOOL_NAME,
          description:
            'Send a native operating-system notification. Use it when a task finishes while the user is looking '
            + 'elsewhere, when the user must approve something, or when the user explicitly asks to be notified. '
            + 'Text stays on the local machine.',
          parameters: TOOL_PARAMETERS,
          output: { schema: { type: 'json' }, render: renderNotifyResult },
          execute: async (args: NotifyInput) => {
            const ready = await ensure()
            if (!ready) {
              return {
                ok: false,
                delivered: false,
                title: resolveSettings(config).titlePrefix,
                error: 'notification backend unavailable',
              } satisfies NotifyResult
            }
            return ready.notify(args ?? {})
          },
        })
      } catch (error) {
        // A duplicate name or a host-side surface change must not take down the
        // whole row; modlens takes the same degrade-loudly approach.
        logger?.warn?.(`[desktop-shell-notify] ${TOOL_NAME} registration skipped: ${String(error)}`)
        return () => {}
      }
    }, 'desktop-shell-notify: notify tool')
  })

  host.on('agent/turn-stopping', ((payload: { agent?: unknown }) => {
    void ensure().then((ready) => ready?.handleTurnStopping(payload))
  }) as (...args: never[]) => unknown)

  host.on('approval/request', (async (req: { agent?: unknown; toolName?: string }, next: () => unknown) => {
    // next() must run even if the backend is broken; the approval decision is
    // the host's, not ours.
    const ready = await ensure()
    if (!ready) return next()
    return ready.handleApprovalRequest(req, next)
  }) as (...args: never[]) => unknown)
}
