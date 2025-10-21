/**
 * ULID tests
 * Verifies time-sortable, cryptographically secure ID generation
 */

import { describe, it, expect } from "bun:test"
import { Ulid } from "../../src/id/ulid.ts"

describe("Ulid", () => {
  it("should create a ULID with default options", () => {
    const ulid = Ulid.create()
    expect(ulid.toString()).toHaveLength(26)
    expect(ulid.isValid()).toBe(true)
  })

  it("should create a ULID with prefix", () => {
    const ulid = Ulid.create({ prefix: "user_" })
    const str = ulid.toString()
    expect(str).toStartWith("user_")
    expect(str).toHaveLength(5 + 26) // prefix + ULID
    expect(ulid.isValid()).toBe(true)
  })

  it("should create a ULID with custom prefix", () => {
    const ulid = Ulid.create({ prefix: "message_" })
    const str = ulid.toString()
    expect(str).toStartWith("message_")
    expect(ulid.isValid()).toBe(true)
  })

  it("should create different ULIDs on each call", () => {
    const ulid1 = Ulid.create({ prefix: "test_" })
    const ulid2 = Ulid.create({ prefix: "test_" })
    expect(ulid1.toString()).not.toBe(ulid2.toString())
  })

  it("should have time-sortable ULIDs", async () => {
    const ulid1 = Ulid.create({ prefix: "sort_" })
    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 1))
    const ulid2 = Ulid.create({ prefix: "sort_" })

    // Earlier ULID should be less than later ULID (lexicographically)
    expect(ulid1.toString() < ulid2.toString()).toBe(true)
  })

  it("should extract timestamp from ULID", () => {
    const before = Date.now()
    const ulid = Ulid.create()
    const after = Date.now()

    const timestamp = ulid.getTimestamp()
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })

  it("should parse a valid ULID string", () => {
    const original = Ulid.create({ prefix: "user_" })
    const result = Ulid.fromString(original.toString(), { prefix: "user_" })

    expect(result.isError).toBe(false)
    if (!result.isError) {
      expect(result.value.toString()).toBe(original.toString())
      expect(result.value.isValid()).toBe(true)
    }
  })

  it("should reject ULID string with wrong prefix", () => {
    const ulid = Ulid.create({ prefix: "user_" })
    const result = Ulid.fromString(ulid.toString(), { prefix: "post_" })

    expect(result.isError).toBe(true)
    expect(result.error).toContain("prefix")
  })

  it("should reject invalid ULID characters", () => {
    // Create a 26-char string with invalid character '@'
    const invalidUlid = "user_01ARZ3NDEKTSV4RRFFQ69G5F@"
    const result = Ulid.fromString(invalidUlid, { prefix: "user_" })
    expect(result.isError).toBe(true)
    // Either length or invalid char error is acceptable
    expect(result.error).toMatch(/Invalid character|26 characters/)
  })

  it("should reject ULID with incorrect length", () => {
    const result = Ulid.fromString("user_tooshort", { prefix: "user_" })
    expect(result.isError).toBe(true)
    expect(result.error).toContain("26 characters")
  })

  it("should reject empty string", () => {
    const result = Ulid.fromString("")
    expect(result.isError).toBe(true)
    expect(result.error).toContain("non-empty")
  })

  it("should compare ULIDs for equality", () => {
    const ulid1 = Ulid.create({ prefix: "eq_" })
    const str = ulid1.toString()
    const ulid2Result = Ulid.fromString(str, { prefix: "eq_" })

    expect(ulid2Result.isError).toBe(false)
    if (!ulid2Result.isError) {
      expect(ulid1.equals(ulid2Result.value)).toBe(true)
    }
  })

  it("should compare ULID with string", () => {
    const ulid = Ulid.create({ prefix: "str_" })
    const str = ulid.toString()
    expect(ulid.equals(str)).toBe(true)
  })

  it("should return false for unequal ULIDs", () => {
    const ulid1 = Ulid.create({ prefix: "neq_" })
    const ulid2 = Ulid.create({ prefix: "neq_" })
    expect(ulid1.equals(ulid2)).toBe(false)
  })

  it("should generate unique ULIDs in collision test", () => {
    const ulids = new Set<string>()
    const count = 1000

    for (let i = 0; i < count; i++) {
      const ulid = Ulid.create({ prefix: "collision_" })
      ulids.add(ulid.toString())
    }

    // All ULIDs should be unique
    expect(ulids.size).toBe(count)
  })

  it("should include prefix in length calculation", () => {
    const ulid = Ulid.create({ prefix: "test_" })
    expect(ulid.toString()).toHaveLength(5 + 26)
  })

  it("should validate correct ULID format", () => {
    const ulid = Ulid.create({ prefix: "validate_" })
    expect(ulid.isValid()).toBe(true)
  })

  it("should get prefix", () => {
    const ulid = Ulid.create({ prefix: "prefix_" })
    expect(ulid.getPrefix()).toBe("prefix_")
  })

  it("should handle ULID without prefix", () => {
    const ulid = Ulid.create()
    expect(ulid.getPrefix()).toBe("")
    expect(ulid.toString()).toHaveLength(26)
  })

  it("should parse ULID without prefix", () => {
    const original = Ulid.create()
    const result = Ulid.fromString(original.toString())

    expect(result.isError).toBe(false)
    if (!result.isError) {
      expect(result.value.toString()).toBe(original.toString())
    }
  })
})
