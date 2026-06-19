/**
 * Copyright 2026 Scratch Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest'
import { sanitizeValueForType } from '../../src/blocks/data'

// Tests for the set/change variable block value enforcement: literal values are constrained to
// the selected variable's data type ('int' | 'float' | 'string').

describe('sanitizeValueForType', () => {
  it('keeps only integers for int variables', () => {
    expect(sanitizeValueForType('42', 'int')).toBe('42')
    expect(sanitizeValueForType('3.5', 'int')).toBe('35')
    expect(sanitizeValueForType('12abc', 'int')).toBe('12')
    expect(sanitizeValueForType('-7', 'int')).toBe('-7')
    // A minus is only valid as a leading sign; interior minuses are dropped.
    expect(sanitizeValueForType('1-2-3', 'int')).toBe('123')
  })

  it('allows a single decimal point for float variables', () => {
    expect(sanitizeValueForType('3.5', 'float')).toBe('3.5')
    expect(sanitizeValueForType('3.5.2', 'float')).toBe('3.52')
    expect(sanitizeValueForType('1.2abc', 'float')).toBe('1.2')
    expect(sanitizeValueForType('-0.5', 'float')).toBe('-0.5')
  })

  it('accepts numbers and text for string variables', () => {
    expect(sanitizeValueForType('hello', 'string')).toBe('hello')
    expect(sanitizeValueForType('hi42', 'string')).toBe('hi42')
    expect(sanitizeValueForType('3.5', 'string')).toBe('3.5')
  })

  it('defaults unknown data types to integer behavior', () => {
    expect(sanitizeValueForType('1.2abc', '')).toBe('12')
  })
})
