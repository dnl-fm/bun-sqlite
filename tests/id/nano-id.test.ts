/**
 * NanoID tests
 * Verifies cryptographically secure compact ID generation
 */

import { describe, it, expect } from "bun:test"
import { NanoId } from "../../src/id/nano-id.ts"

describe("NanoId", () => {
  it("should create a NanoID with default options", () => {
    const nanoid = NanoId.create()
    expect(nanoid.toString()).toHaveLength(NanoId.DEFAULT_LENGTH)
    expect(nanoid.isValid()).toBe(true)
  })

  it("should have default length of 21", () => {
    const nanoid = NanoId.create()
    expect(nanoid.getRandomPart()).toHaveLength(21)
  })

  it("should create a NanoID with prefix", () => {
    const nanoid = NanoId.create({ prefix: "msg_" })
    const str = nanoid.toString()
    expect(str).toStartWith("msg_")
    expect(str).toHaveLength(4 + 21) // prefix + random part
    expect(nanoid.isValid()).toBe(true)
  })

  it("should create a NanoID with custom prefix", () => {
    const nanoid = NanoId.create({ prefix: "post_" })
    const str = nanoid.toString()
    expect(str).toStartWith("post_")
    expect(nanoid.isValid()).toBe(true)
  })

  it("should create a NanoID with custom length", () => {
    const nanoid = NanoId.create({ length: 12 })
    expect(nanoid.toString()).toHaveLength(12)
  })

  it("should create a NanoID with custom prefix and length", () => {
    const nanoid = NanoId.create({ prefix: "id_", length: 15 })
    const str = nanoid.toString()
    expect(str).toStartWith("id_")
    expect(str).toHaveLength(3 + 15) // prefix length + custom length
  })

  it("should create different NanoIDs on each call", () => {
    const nanoid1 = NanoId.create({ prefix: "test_" })
    const nanoid2 = NanoId.create({ prefix: "test_" })
    expect(nanoid1.toString()).not.toBe(nanoid2.toString())
  })

  it("should use URL-safe characters only", () => {
    const nanoid = NanoId.create()
    const str = nanoid.getRandomPart()
    const urlSafeChars = "_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

    for (const char of str) {
      expect(urlSafeChars).toContain(char)
    }
  })

  it("should parse a valid NanoID string", () => {
    const original = NanoId.create({ prefix: "user_" })
    const result = NanoId.fromString(original.toString(), { prefix: "user_" })

    expect(result.isError).toBe(false)
    if (!result.isError) {
      expect(result.value.toString()).toBe(original.toString())
      expect(result.value.isValid()).toBe(true)
    }
  })

  it("should reject NanoID string with wrong prefix", () => {
    const nanoid = NanoId.create({ prefix: "user_" })
    const result = NanoId.fromString(nanoid.toString(), { prefix: "post_" })

    expect(result.isError).toBe(true)
    expect(result.error).toContain("prefix")
  })

  it("should reject invalid NanoID characters", () => {
    const result = NanoId.fromString("user_!@#$%^&*()")
    expect(result.isError).toBe(true)
    expect(result.error).toContain("Invalid character")
  })

  it("should reject empty string", () => {
    const result = NanoId.fromString("")
    expect(result.isError).toBe(true)
    expect(result.error).toContain("non-empty")
  })

  it("should compare NanoIDs for equality", () => {
    const nanoid1 = NanoId.create({ prefix: "eq_" })
    const str = nanoid1.toString()
    const nanoid2Result = NanoId.fromString(str, { prefix: "eq_" })

    expect(nanoid2Result.isError).toBe(false)
    if (!nanoid2Result.isError) {
      expect(nanoid1.equals(nanoid2Result.value)).toBe(true)
    }
  })

  it("should compare NanoID with string", () => {
    const nanoid = NanoId.create({ prefix: "str_" })
    const str = nanoid.toString()
    expect(nanoid.equals(str)).toBe(true)
  })

  it("should return false for unequal NanoIDs", () => {
    const nanoid1 = NanoId.create({ prefix: "neq_" })
    const nanoid2 = NanoId.create({ prefix: "neq_" })
    expect(nanoid1.equals(nanoid2)).toBe(false)
  })

  it("should generate unique NanoIDs in collision test", () => {
    const nanoids = new Set<string>()
    const count = 1000

    for (let i = 0; i < count; i++) {
      const nanoid = NanoId.create({ prefix: "collision_" })
      nanoids.add(nanoid.toString())
    }

    // All NanoIDs should be unique
    expect(nanoids.size).toBe(count)
  })

  it("should validate correct NanoID format", () => {
    const nanoid = NanoId.create({ prefix: "validate_" })
    expect(nanoid.isValid()).toBe(true)
  })

  it("should get prefix", () => {
    const nanoid = NanoId.create({ prefix: "prefix_" })
    expect(nanoid.getPrefix()).toBe("prefix_")
  })

  it("should get random part", () => {
    const nanoid = NanoId.create({ prefix: "rnd_" })
    expect(nanoid.getRandomPart()).toHaveLength(NanoId.DEFAULT_LENGTH)
  })

  it("should handle NanoID without prefix", () => {
    const nanoid = NanoId.create()
    expect(nanoid.getPrefix()).toBe("")
    expect(nanoid.toString()).toHaveLength(NanoId.DEFAULT_LENGTH)
  })

  it("should parse NanoID without prefix", () => {
    const original = NanoId.create()
    const result = NanoId.fromString(original.toString())

    expect(result.isError).toBe(false)
    if (!result.isError) {
      expect(result.value.toString()).toBe(original.toString())
    }
  })

  it("should work with very short lengths", () => {
    const nanoid = NanoId.create({ length: 4 })
    expect(nanoid.toString()).toHaveLength(4)
    expect(nanoid.isValid()).toBe(true)
  })

  it("should work with very long lengths", () => {
    const nanoid = NanoId.create({ length: 100 })
    expect(nanoid.toString()).toHaveLength(100)
    expect(nanoid.isValid()).toBe(true)
  })
})
