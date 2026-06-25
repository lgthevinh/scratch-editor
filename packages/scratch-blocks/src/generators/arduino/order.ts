/**
 * Copyright 2026 Scratch Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Operator precedence for the Arduino (C++) generator. Lower binds tighter, so
 * `valueToCode` wraps a child expression in parentheses when its order is
 * greater than the order the surrounding operator asks for. `ATOMIC` never needs
 * parentheses; `NONE` is the loosest context (a whole statement), so nothing is
 * parenthesized against it.
 */
export enum Order {
  ATOMIC = 0,
  UNARY = 2,
  MULTIPLICATIVE = 3,
  ADDITIVE = 4,
  RELATIONAL = 6,
  EQUALITY = 7,
  LOGICAL_AND = 11,
  LOGICAL_OR = 12,
  NONE = 99,
}
