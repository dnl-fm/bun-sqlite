import { describe, it, expect } from "bun:test"
import { Zeit, Timezone } from "../../src/zeit/index.ts"

describe("Zeit - Timezone-aware datetime", () => {
  describe("Factory methods", () => {
    it("should create Zeit with user timezone", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const zeit = factory.fromDatabase(1000000)

      expect(zeit).toBeDefined()
      expect(zeit.getTimestamp()).toBe(1000000)
      expect(zeit.getTimezone()).toBe(Timezone.UTC)
    })

    it("should create Zeit from database timestamp", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const timestamp = 1695312000000 // 2023-09-21T12:00:00Z
      const zeit = factory.fromDatabase(timestamp)

      expect(zeit.toDatabase()).toBe(timestamp)
    })

    it("should get current time with now()", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const now = factory.now()
      const currentTime = Date.now()

      // Should be within 100ms
      expect(Math.abs(now.getTimestamp() - currentTime)).toBeLessThan(100)
    })

    it("should throw on invalid timestamp", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)

      expect(() => factory.fromDatabase(NaN)).toThrow()
      expect(() => factory.fromDatabase(Infinity)).toThrow()
    })

    it("should throw on invalid timezone", () => {
      expect(() => Zeit.withUserZone("")).toThrow()
    })
  })

  describe("Timezone conversions", () => {
    it("should convert UTC timestamp to database format", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const timestamp = 1695312000000
      const zeit = factory.fromDatabase(timestamp)

      expect(zeit.toDatabase()).toBe(timestamp)
    })

    it("should format as ISO string", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const zeit = factory.fromDatabase(0) // 1970-01-01T00:00:00Z

      const user = zeit.toUser()
      expect(user).toContain("1970-01-01")
      expect(user).toContain("00:00:00")
    })
  })

  describe("Date arithmetic", () => {
    it("should add days", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const zeit = factory.fromDatabase(0)
      const plus5days = zeit.add({ days: 5 })

      const diff = plus5days.diff(zeit)
      expect(diff).toBe(5 * 24 * 60 * 60 * 1000)
    })

    it("should add hours", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const zeit = factory.fromDatabase(0)
      const plus3hours = zeit.add({ hours: 3 })

      const diff = plus3hours.diff(zeit)
      expect(diff).toBe(3 * 60 * 60 * 1000)
    })

    it("should add minutes and seconds", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const zeit = factory.fromDatabase(0)
      const later = zeit.add({ minutes: 30, seconds: 45 })

      const diff = later.diff(zeit)
      expect(diff).toBe(30 * 60 * 1000 + 45 * 1000)
    })

    it("should add weeks", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const zeit = factory.fromDatabase(0)
      const plus2weeks = zeit.add({ weeks: 2 })

      const diff = plus2weeks.diff(zeit)
      expect(diff).toBe(2 * 7 * 24 * 60 * 60 * 1000)
    })

    it("should add negative durations (subtract)", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const zeit = factory.fromDatabase(1000000)
      const minus2days = zeit.add({ days: -2 })

      const diff = minus2days.diff(zeit)
      expect(diff).toBe(-2 * 24 * 60 * 60 * 1000)
    })

    it("should combine multiple duration components", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const zeit = factory.fromDatabase(0)
      const later = zeit.add({
        days: 1,
        hours: 2,
        minutes: 30,
      })

      const expectedMs = 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000 + 30 * 60 * 1000
      expect(later.diff(zeit)).toBe(expectedMs)
    })
  })

  describe("Comparison operations", () => {
    it("should check equality", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const zeit1 = factory.fromDatabase(1000000)
      const zeit2 = factory.fromDatabase(1000000)
      const zeit3 = factory.fromDatabase(2000000)

      expect(zeit1.equals(zeit2)).toBe(true)
      expect(zeit1.equals(zeit3)).toBe(false)
    })

    it("should check if before", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const earlier = factory.fromDatabase(1000000)
      const later = factory.fromDatabase(2000000)

      expect(earlier.isBefore(later)).toBe(true)
      expect(later.isBefore(earlier)).toBe(false)
      expect(earlier.isBefore(earlier)).toBe(false)
    })

    it("should check if after", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const earlier = factory.fromDatabase(1000000)
      const later = factory.fromDatabase(2000000)

      expect(later.isAfter(earlier)).toBe(true)
      expect(earlier.isAfter(later)).toBe(false)
      expect(earlier.isAfter(earlier)).toBe(false)
    })

    it("should calculate difference", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const zeit1 = factory.fromDatabase(1000000)
      const zeit2 = factory.fromDatabase(2000000)

      expect(zeit2.diff(zeit1)).toBe(1000000)
      expect(zeit1.diff(zeit2)).toBe(-1000000)
      expect(zeit1.diff(zeit1)).toBe(0)
    })
  })

  describe("Clone operation", () => {
    it("should create independent copy", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const original = factory.fromDatabase(1000000)
      const cloned = original.clone()

      expect(original.equals(cloned)).toBe(true)
      expect(original).not.toBe(cloned)
    })

    it("should preserve timezone when cloning", () => {
      const factory = Zeit.withUserZone("America/New_York")
      const original = factory.fromDatabase(1000000)
      const cloned = original.clone()

      expect(cloned.getTimezone()).toBe("America/New_York")
    })
  })

  describe("Business days", () => {
    it("should add business days (skip weekends)", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      // 2024-01-01 is a Monday
      const monday = factory.fromDatabase(new Date("2024-01-01T00:00:00Z").getTime())

      const result = monday.addBusinessDays(1)
      const diff = result.diff(monday)

      // Should be 1 day
      expect(diff).toBe(24 * 60 * 60 * 1000)
    })

    it("should add multiple business days skipping weekend", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      // Friday 2024-01-05
      const friday = factory.fromDatabase(new Date("2024-01-05T00:00:00Z").getTime())

      const result = friday.addBusinessDays(2)
      const diff = result.diff(friday)

      // Should be 4 days (skip Sat-Sun)
      expect(diff).toBe(4 * 24 * 60 * 60 * 1000)
    })

    it("should handle negative business days", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      // Monday 2024-01-08
      const monday = factory.fromDatabase(new Date("2024-01-08T00:00:00Z").getTime())

      const result = monday.addBusinessDays(-1)
      const diff = result.diff(monday)

      // Should be -3 days (skip Sat-Sun)
      expect(diff).toBe(-3 * 24 * 60 * 60 * 1000)
    })

    it("should return same date for 0 business days", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const time = factory.fromDatabase(1000000)
      const result = time.addBusinessDays(0)

      expect(result.equals(time)).toBe(true)
    })
  })

  describe("Instant access", () => {
    it("should return Date object for instant", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const zeit = factory.fromDatabase(1695312000000)
      const instant = zeit.getInstant()

      expect(instant instanceof Date).toBe(true)
      expect(instant.getTime()).toBe(1695312000000)
    })

    it("should allow Date operations on instant", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const zeit = factory.fromDatabase(1695312000000)
      const instant = zeit.getInstant()

      expect(instant.getUTCFullYear()).toBe(2023)
      expect(instant.getUTCMonth()).toBe(8) // September
      expect(instant.getUTCDate()).toBe(21)
    })
  })

  describe("User local time parsing", () => {
    it("should parse ISO string as user local time", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const zeit = factory.fromUser("2024-01-15T10:30:00")

      expect(zeit).toBeDefined()
      expect(zeit.getTimezone()).toBe(Timezone.UTC)
    })

    it("should throw on invalid ISO string", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)

      expect(() => factory.fromUser("invalid-date")).toThrow()
      expect(() => factory.fromUser("2024-13-01T00:00:00")).toThrow()
    })
  })
})
