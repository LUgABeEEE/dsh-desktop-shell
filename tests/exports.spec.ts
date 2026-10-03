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
    for (const [, mod] of subPlugins) {
      expect(typeof mod.name).toBe('string')
      expect(Array.isArray(mod.inject)).toBe(true)
      expect(typeof mod.apply).toBe('function')
    }
  })

  it('sub-plugin names are unique', () => {
    const names = subPlugins.map(([, mod]) => mod.name)
    expect(new Set(names).size).toBe(4)
  })
})

// Regression guard for the M0 defect: the committed lib/*.js were hand-written
// and exported `Config`, while src/*.ts exported `ConfigSchema`, so the build
// silently changed the export name and the settings page could stop resolving.
// Both names are now exported; this test fails if either is dropped.
describe('settings schema exports', () => {
  it('each sub-plugin exports a Config schema object', () => {
    for (const [label, mod] of subPlugins) {
      expect(mod.Config, `${label} is missing a Config schema`).toBeTypeOf('object')
      expect(mod.Config.type, `${label}.Config.type`).toBe('object')
      expect(mod.Config.properties, `${label}.Config.properties`).toBeTypeOf('object')
    }
  })

  it('ConfigSchema is an alias of the same object, not a copy', () => {
    for (const [label, mod] of subPlugins) {
      expect(mod.ConfigSchema, `${label}.ConfigSchema`).toBe(mod.Config)
    }
  })

  it('schema defaults match the documented defaults', () => {
    expect(notify.Config.properties.onTaskComplete.default).toBe(true)
    expect(notify.Config.properties.onApprovalNeeded.default).toBe(true)
    expect(notify.Config.properties.sound.default).toBe(true)
    expect(notify.Config.properties.titlePrefix.default).toBe('DSH · ')

    expect(capture.Config.properties.defaultMode.default).toBe('region')
    expect(capture.Config.properties.imageFormat.default).toBe('png')

    // Clipboard watching is opt-in: watching must stay off by default (PLAN.md §6).
    expect(clipboard.Config.properties.watch.default).toBe(false)
    expect(clipboard.Config.properties.autoInject.default).toBe(false)
    expect(clipboard.Config.properties.minLength.default).toBe(8)

    expect(hotkey.Config.properties.hotkey.default).toBe('Alt+Space')
    expect(hotkey.Config.properties.behavior.default).toBe('toggle')
  })
})
