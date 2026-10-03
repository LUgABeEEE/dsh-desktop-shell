import { describe, expect, it } from 'vitest'

import * as capture from '../src/capture.js'
import * as clipboard from '../src/clipboard.js'
import * as hotkey from '../src/hotkey.js'
import * as notify from '../src/notify.js'

const subPlugins = [
  ['notify', notify],
  ['capture', capture],
  ['clipboard', clipboard],
  ['hotkey', hotkey],
] as const

describe('plugin exports', () => {
  it('each sub-plugin exports name / inject / apply', () => {
    for (const [label, mod] of subPlugins) {
      expect(typeof mod.name, `${label}.name`).toBe('string')
      expect(Array.isArray(mod.inject), `${label}.inject`).toBe(true)
      expect(typeof mod.apply, `${label}.apply`).toBe('function')
    }
  })

  it('sub-plugin names are unique', () => {
    const names = subPlugins.map(([, mod]) => mod.name)
    expect(new Set(names).size).toBe(4)
  })
})

// The host reads exactly one config export: `Config`, and it must be a Standard
// Schema. The M0 scaffold exported a plain JSON-Schema-like object under two
// names; a plain object is not a validator, so the row's settings page silently
// never appeared and no defaults were filled. These tests fail if that regresses.
describe('Config export', () => {
  it('each sub-plugin exports a Config', () => {
    for (const [label, mod] of subPlugins) {
      expect(mod.Config, `${label} is missing Config`).toBeTypeOf('function')
    }
  })

  it('each Config implements Standard Schema, which is what Cordis validates', () => {
    for (const [label, mod] of subPlugins) {
      const standard = (mod.Config as unknown as Record<string, unknown>)['~standard']
      expect(standard, `${label}.Config is not a Standard Schema`).toBeTruthy()
      expect((standard as { version?: number }).version).toBe(1)
    }
  })

  it('no sub-plugin exports the misleading ConfigSchema alias any more', () => {
    for (const [label, mod] of subPlugins) {
      expect('ConfigSchema' in mod, `${label} still exports ConfigSchema`).toBe(false)
    }
  })

  it('Config validates and fills defaults', () => {
    expect((notify.Config as (v: unknown) => unknown)({})).toBeTruthy()
    expect(() => (notify.Config as (v: unknown) => unknown)({ sound: 'loud' })).toThrow()
  })
})

// Settings pages only render fields marked `.volatile()`; a non-volatile field is
// invisible and unwritable from the UI. Keep every user-facing field volatile.
describe('volatile settings fields', () => {
  const isVolatileWrapper = (v: unknown) => typeof (v as { get?: unknown })?.get === 'function'

  it('every declared field arrives as a volatile wrapper', () => {
    for (const [label, mod] of subPlugins) {
      const parsed = (mod.Config as (v: unknown) => Record<string, unknown>)({})
      const keys = Object.keys(parsed)
      expect(keys.length, `${label}.Config declared no fields`).toBeGreaterThan(0)
      for (const key of keys) {
        expect(isVolatileWrapper(parsed[key]), `${label}.${key} is not volatile`).toBe(true)
      }
    }
  })
})
