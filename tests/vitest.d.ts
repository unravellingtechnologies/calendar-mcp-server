/// <reference types="vitest" />
import { expect, test, describe, it, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'

declare global {
  const expect: typeof expect
  const test: typeof test
  const describe: typeof describe
  const it: typeof it
  const beforeEach: typeof beforeEach
  const afterEach: typeof afterEach
  const beforeAll: typeof beforeAll
  const afterAll: typeof afterAll
}
