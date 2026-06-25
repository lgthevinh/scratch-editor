/**
 * Copyright 2026 Scratch Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ArduinoGenerator } from '../arduino'
import { Order } from './order'

/**
 * Register Arduino generators for the sensing blocks that survive into board
 * mode. Only the timer blocks remain in the board-mode palette — Scratch's timer
 * is seconds since reset, which maps onto the board's `millis()` uptime. The
 * host-only sensing blocks (mouse, keyboard, ask/answer, clock, online) are
 * hidden in board mode and intentionally have no firmware generator.
 * @param gen The Arduino generator to register on.
 */
export function registerSensing(gen: ArduinoGenerator): void {
  gen.forBlock.sensing_timer = () => ['millis() / 1000.0', Order.MULTIPLICATIVE]
  // The board has no reset, so resetting the timer has nothing to do.
  gen.forBlock.sensing_resettimer = () => '/* reset timer */'
}
