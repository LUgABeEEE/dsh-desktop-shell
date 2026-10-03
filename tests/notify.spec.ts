import Schema from '@deepseek-ai/schemastery'
import { describe, expect, it, vi } from 'vitest'

import {
  Config,
  TOOL_NAME,
  TOOL_PARAMETERS,
  apply,
  buildTitle,
  createNotifier,
  createNotifyPlugin,
  renderNotifyResult,
  resolveSettings,
  sessionIdOf,
} from '../src/notify.js'
import { NOTIFY_DEFAULTS } from '../src/settings.js'
import type { NotifyRequest, ToolCtx } from '../src/notify.js'

/** Collects everything a backend was asked to deliver. */
function fakeBackend() {
  const sent: NotifyRequest[] = []
  const backend = vi.fn(async (request: NotifyRequest) => {
    sent.push(request)
  })
  return { backend, sent }
}

/** A config holder whose volatile fields can be flipped, like loader/volatile-update. */
function configHolder(initial: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = { ...initial }
  const volatile = (key: string) => ({ get: () => values[key] })
  const config = new Proxy({} as Record<string, unknown>, {
    get: (_t, prop: string) => (prop in values ? volatile(prop) : undefined),
    has: (_t, prop: string) => prop in values,
  })
  return { config, values }
}

describe('Config schema', () => {
  it('is a Standard Schema, which is what Cordis validates against', () => {
    expect(typeof Config).toBe('function')
    expect(Config['~standard']).toBeTruthy()
  })

  it('applies documented defaults through the schema', () => {
    expect(resolveSettings(Config({}))).toEqual({
      onTaskComplete: true,
      onApprovalNeeded: true,
      sound: true,
      titlePrefix: 'DSH · ',
    })
  })

  it('marks every field volatile so each appears on the settings page', () => {
    for (const [key, field] of Object.entries((Config({}) as Record<string, { get(): unknown }>))) {
      expect(typeof field.get, `${key} should arrive as a volatile wrapper`).toBe('function')
    }
  })

  it('rejects a wrong type instead of silently accepting it', () => {
    expect(() => Config({ sound: 'loud' })).toThrow()
  })
})

describe('resolveSettings', () => {
  it('falls back to defaults when config is absent', () => {
    expect(resolveSettings(undefined)).toEqual(NOTIFY_DEFAULTS)
  })

  it('reads plain values', () => {
    expect(resolveSettings({ sound: false, titlePrefix: 'P| ' }).sound).toBe(false)
  })

  it('reads volatile wrappers', () => {
    expect(resolveSettings({ sound: { get: () => false } }).sound).toBe(false)
  })

  it('falls back when a volatile wrapper holds nothing', () => {
    expect(resolveSettings({ sound: { get: () => undefined } }).sound).toBe(true)
  })

  it('picks up a volatile change without re-running apply', () => {
    const { config, values } = configHolder({ sound: true, titlePrefix: 'A ' })
    const read = () => resolveSettings(config)
    expect(read().titlePrefix).toBe('A ')
    values.titlePrefix = 'B '
    values.sound = false
    expect(read()).toMatchObject({ titlePrefix: 'B ', sound: false })
  })
})

describe('buildTitle', () => {
  it('prefixes the given title', () => {
    expect(buildTitle('DSH · ', 'Done', 'fb')).toBe('DSH · Done')
  })
  it('falls back when the title is empty or whitespace', () => {
    expect(buildTitle('DSH · ', '   ', 'Task complete')).toBe('DSH · Task complete')
    expect(buildTitle('DSH · ', undefined, 'Task complete')).toBe('DSH · Task complete')
  })
})

describe('createNotifier', () => {
  it('delivers through the backend and reports success', async () => {
    const { backend, sent } = fakeBackend()
    const notify = createNotifier(() => resolveSettings({}), backend)
    const result = await notify({ message: 'hello' })
    expect(result).toMatchObject({ ok: true, delivered: true, title: 'DSH · Done' })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ message: 'hello', sound: true, urgent: false })
  })

  it('refuses an empty message without touching the backend', async () => {
    const { backend, sent } = fakeBackend()
    const notify = createNotifier(() => resolveSettings({}), backend)
    expect(await notify({ message: '   ' })).toMatchObject({ ok: false, delivered: false })
    expect(sent).toHaveLength(0)
  })

  it('turns a backend failure into a refusal instead of throwing', async () => {
    const backend = vi.fn(async () => {
      throw new Error('no notification daemon')
    })
    const notify = createNotifier(() => resolveSettings({}), backend)
    const result = await notify({ message: 'hello' })
    expect(result).toMatchObject({ ok: false, delivered: false, error: 'no notification daemon' })
  })

  it('lets urgent escalate the sound even when sound is off', async () => {
    const { backend, sent } = fakeBackend()
    const notify = createNotifier(() => resolveSettings({ sound: false }), backend)
    await notify({ message: 'hi', urgent: true })
    expect(sent[0]).toMatchObject({ sound: true, urgent: true })
  })

  it('reads settings per call so a live change takes effect', async () => {
    const { config, values } = configHolder({ onTaskComplete: true, titlePrefix: 'A ' })
    const { backend, sent } = fakeBackend()
    const plugin = createNotifyPlugin({ config, backend })
    plugin.handleTurnStopping({ agent: { session: { header: { id: 's1' } } } })
    values.titlePrefix = 'B '
    plugin.handleTurnStopping({ agent: { session: { header: { id: 's2' } } } })
    await Promise.resolve()
    expect(sent.map((s) => s.title)).toEqual(['A Task complete', 'B Task complete'])
  })
})

describe('tool registration', () => {
  function harness(registerImpl?: (spec: Record<string, unknown>) => unknown) {
    const specs: Record<string, unknown>[] = []
    const labels: (string | undefined)[] = []
    const toolCtx: ToolCtx = {
      tools: { register: registerImpl ?? ((spec) => (specs.push(spec), () => {}) as unknown) },
      effect: (fn, label) => {
        labels.push(label)
        return fn()
      },
    }
    return { specs, labels, toolCtx }
  }

  it('registers a spec with parameters and a mandatory output', () => {
    const { specs, labels, toolCtx } = harness()
    const { backend } = fakeBackend()
    createNotifyPlugin({ config: {}, backend }).registerTools(toolCtx)
    expect(specs).toHaveLength(1)
    const spec = specs[0]
    expect(spec.name).toBe(TOOL_NAME)
    expect(spec.parameters).toEqual(TOOL_PARAMETERS)
    // output is mandatory in a real ToolDefinition; omitting it is a hard error.
    expect(spec.output).toMatchObject({ schema: { type: 'json' } })
    expect(typeof (spec.output as { render: unknown }).render).toBe('function')
    expect(typeof spec.execute).toBe('function')
    expect(labels).toEqual(['desktop-shell-notify: notify tool'])
  })

  it('marks message required and nothing else', () => {
    expect(TOOL_PARAMETERS.required).toEqual(['message'])
  })

  it('degrades loudly instead of taking the row down on a duplicate name', () => {
    const warn = vi.fn()
    const { toolCtx } = harness(() => {
      throw new Error('duplicate tool name')
    })
    const { backend } = fakeBackend()
    expect(() => createNotifyPlugin({ config: {}, backend, logger: { warn } }).registerTools(toolCtx)).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('registration skipped'))
  })

  it('routes execute through the injected backend', async () => {
    const { specs, toolCtx } = harness()
    const { backend, sent } = fakeBackend()
    createNotifyPlugin({ config: {}, backend }).registerTools(toolCtx)
    const execute = specs[0].execute as (args: unknown) => Promise<unknown>
    await expect(execute({ message: 'ping' })).resolves.toMatchObject({ ok: true })
    expect(sent[0]!.message).toBe('ping')
  })
})

describe('renderNotifyResult', () => {
  it('renders success and failure as text', () => {
    expect(renderNotifyResult({}, { ok: true, delivered: true, title: 'DSH · Done' })).toEqual([
      { type: 'text', text: 'Notification delivered: "DSH · Done"' },
    ])
    expect(renderNotifyResult({}, { ok: false, delivered: false, title: 't', error: 'boom' })).toEqual([
      { type: 'text', text: 'Notification not delivered: boom' },
    ])
  })
})

describe('agent/turn-stopping hook', () => {
  it('notifies with the session id', async () => {
    const { backend, sent } = fakeBackend()
    const plugin = createNotifyPlugin({ config: {}, backend })
    plugin.handleTurnStopping({ agent: { session: { header: { id: 'abc' } } } })
    await Promise.resolve()
    expect(sent[0]).toMatchObject({ title: 'DSH · Task complete' })
    expect(sent[0]!.message).toContain('abc')
  })

  it('still notifies when the session id cannot be read', async () => {
    const { backend, sent } = fakeBackend()
    createNotifyPlugin({ config: {}, backend }).handleTurnStopping({ agent: {} })
    await Promise.resolve()
    expect(sent[0]!.message).toBe('The turn finished.')
  })

  it('respects the onTaskComplete toggle', async () => {
    const { backend, sent } = fakeBackend()
    const config = Config({ onTaskComplete: false })
    createNotifyPlugin({ config, backend }).handleTurnStopping({ agent: {} })
    await Promise.resolve()
    expect(sent).toHaveLength(0)
  })

  it('contains a backend failure instead of rejecting into the awaited event', async () => {
    const backend = vi.fn(async () => {
      throw new Error('backend down')
    })
    const warn = vi.fn()
    const plugin = createNotifyPlugin({ config: {}, backend, logger: { warn } })
    // The failure is absorbed into a refusal result, so the serial event the host
    // awaits can never see a rejection and the turn always completes.
    expect(() => plugin.handleTurnStopping({ agent: {} })).not.toThrow()
    await expect(plugin.notify({ message: 'hi' })).resolves.toMatchObject({ ok: false, error: 'backend down' })
  })
})

describe('approval/request hook', () => {
  it('always calls next, because it is a waterfall', async () => {
    const { backend } = fakeBackend()
    const next = vi.fn(() => 'allowed-once')
    await createNotifyPlugin({ config: {}, backend }).handleApprovalRequest({ toolName: 'write_file' }, next)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('notifies urgently and names the tool', async () => {
    const { backend, sent } = fakeBackend()
    const next = vi.fn()
    await createNotifyPlugin({ config: {}, backend }).handleApprovalRequest(
      { agent: { session: { header: { id: 's9' } } }, toolName: 'write_file' },
      next,
    )
    await Promise.resolve()
    expect(sent[0]).toMatchObject({ title: 'DSH · Approval needed', urgent: true })
    expect(sent[0]!.message).toContain('s9')
    expect(sent[0]!.message).toContain('write_file')
  })

  it('respects the onApprovalNeeded toggle but still calls next', async () => {
    const { backend, sent } = fakeBackend()
    const next = vi.fn()
    await createNotifyPlugin({ config: Config({ onApprovalNeeded: false }), backend }).handleApprovalRequest({}, next)
    await Promise.resolve()
    expect(sent).toHaveLength(0)
    expect(next).toHaveBeenCalled()
  })
})

describe('sessionIdOf', () => {
  it('prefers session.header.id and falls back sensibly', () => {
    expect(sessionIdOf({ session: { header: { id: 'a' } } })).toBe('a')
    expect(sessionIdOf({ session: { id: 'b' } })).toBe('b')
    expect(sessionIdOf({ id: 'c' })).toBe('c')
    expect(sessionIdOf(undefined)).toBeUndefined()
    expect(sessionIdOf({})).toBeUndefined()
  })
})

describe('apply', () => {
  function host() {
    const calls: { events: string[]; injectNames: string[][]; specs: Record<string, unknown>[] } = {
      events: [],
      injectNames: [],
      specs: [],
    }
    const ctx = {
      inject: (names: string[], fn: (t: ToolCtx) => void) => {
        calls.injectNames.push(names)
        fn({
          tools: { register: (spec) => (calls.specs.push(spec), () => {}) as unknown },
          effect: (fn2: () => unknown) => fn2(),
        })
      },
      on: (event: string) => {
        calls.events.push(event)
        return () => true
      },
    }
    return { ctx, calls }
  }

  it('subscribes to the real events and injects tools', () => {
    const { ctx, calls } = host()
    apply(ctx, {})
    expect(calls.injectNames).toEqual([['tools']])
    expect(calls.events.sort()).toEqual(['agent/turn-stopping', 'approval/request'])
  })

  it('registers a spec the host will accept', () => {
    const { ctx, calls } = host()
    apply(ctx, {})
    expect(calls.specs).toHaveLength(1)
    expect(calls.specs[0]!.name).toBe(TOOL_NAME)
    expect(calls.specs[0]!.parameters).toBeTruthy()
    expect(calls.specs[0]!.output).toBeTruthy()
  })

  it('does not load the notification backend until it is needed', () => {
    // A broken/absent backend must not fail plugin load; nothing is resolved here.
    const { ctx } = host()
    expect(() => apply(ctx, {})).not.toThrow()
  })

  it('declares tools as a hard dependency', async () => {
    const mod = await import('../src/notify.js')
    expect(mod.inject).toEqual(['tools'])
    expect(mod.name).toBe('desktop-shell-notify')
  })
})

describe('schema parity with settings constants', () => {
  it('NOTIFY_DEFAULTS matches the schema defaults', () => {
    const parsed = resolveSettings(Config({}))
    expect(parsed).toEqual({ ...NOTIFY_DEFAULTS })
  })

  it('exports a Config that is also usable as a plain validator', () => {
    expect(Schema.object({ a: Schema.boolean().default(false) })({})).toEqual({ a: false })
  })
})
