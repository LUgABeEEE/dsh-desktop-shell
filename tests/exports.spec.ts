import { describe, expect, it } from 'vitest'

import * as capture from '../src/capture.js'
import * as clipboard from '../src/clipboard.js'
import * as hotkey from '../src/hotkey.js'
import * as notify from '../src/notify.js'

describe('plugin exports', () => {
  it('each sub-plugin exports name / inject / apply', () => {
    for (const mod of [notify, capture, clipboard, hotkey]) {
      expect(typeof mod.name).toBe('string')
      expect(Array.isArray(mod.inject)).toBe(true)
      expect(typeof mod.apply).toBe('function')
    }
  })

  it('sub-plugin names are unique', () => {
    const names = [notify.name, capture.name, clipboard.name, hotkey.name]
    expect(new Set(names).size).toBe(4)
  })
})
