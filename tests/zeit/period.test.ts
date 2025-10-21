import { describe, it, expect } from "bun:test"
import { Zeit, Period, Timezone } from "../../src/zeit/index.ts"

describe("Period - Billing cycles and date ranges", () => {
  describe("Period creation", () => {
    it("should create a valid period", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(1000000)
      const end = factory.fromDatabase(2000000)
      const period = new Period(start, end)

      expect(period.startsAt.equals(start)).toBe(true)
      expect(period.endsAt.equals(end)).toBe(true)
    })

    it("should throw if end is before start", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(2000000)
      const end = factory.fromDatabase(1000000)

      expect(() => new Period(start, end)).toThrow()
    })

    it("should allow same start and end time", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const time = factory.fromDatabase(1000000)

      expect(() => new Period(time, time)).not.toThrow()
    })
  })

  describe("Period containment", () => {
    it("should check if zeit is within period", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(1000000)
      const middle = factory.fromDatabase(1500000)
      const end = factory.fromDatabase(2000000)
      const period = new Period(start, end)

      expect(period.contains(middle)).toBe(true)
    })

    it("should include start time", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(1000000)
      const end = factory.fromDatabase(2000000)
      const period = new Period(start, end)

      expect(period.contains(start)).toBe(true)
    })

    it("should exclude end time (exclusive boundary)", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(1000000)
      const end = factory.fromDatabase(2000000)
      const period = new Period(start, end)

      expect(period.contains(end)).toBe(false)
    })

    it("should exclude times outside period", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(1000000)
      const middle = factory.fromDatabase(1500000)
      const end = factory.fromDatabase(2000000)
      const before = factory.fromDatabase(500000)
      const after = factory.fromDatabase(3000000)
      const period = new Period(start, end)

      expect(period.contains(before)).toBe(false)
      expect(period.contains(after)).toBe(false)
    })
  })

  describe("Period duration", () => {
    it("should calculate duration in days", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0)
      const end = factory.fromDatabase(5 * 24 * 60 * 60 * 1000)
      const period = new Period(start, end)

      expect(period.getDuration("days")).toBe(5)
    })

    it("should calculate duration in hours", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0)
      const end = factory.fromDatabase(3 * 60 * 60 * 1000)
      const period = new Period(start, end)

      expect(period.getDuration("hours")).toBe(3)
    })

    it("should calculate duration in minutes", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0)
      const end = factory.fromDatabase(30 * 60 * 1000)
      const period = new Period(start, end)

      expect(period.getDuration("minutes")).toBe(30)
    })

    it("should calculate duration in seconds", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0)
      const end = factory.fromDatabase(45 * 1000)
      const period = new Period(start, end)

      expect(period.getDuration("seconds")).toBe(45)
    })

    it("should throw on unknown unit", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0)
      const end = factory.fromDatabase(1000000)
      const period = new Period(start, end)

      expect(() => period.getDuration("months" as any)).toThrow()
    })
  })

  describe("Period overlap", () => {
    it("should detect overlapping periods", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const period1 = new Period(
        factory.fromDatabase(1000000),
        factory.fromDatabase(2000000),
      )
      const period2 = new Period(
        factory.fromDatabase(1500000),
        factory.fromDatabase(2500000),
      )

      expect(period1.overlaps(period2)).toBe(true)
      expect(period2.overlaps(period1)).toBe(true)
    })

    it("should detect non-overlapping periods", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const period1 = new Period(
        factory.fromDatabase(1000000),
        factory.fromDatabase(2000000),
      )
      const period2 = new Period(
        factory.fromDatabase(2000000),
        factory.fromDatabase(3000000),
      )

      expect(period1.overlaps(period2)).toBe(false)
      expect(period2.overlaps(period1)).toBe(false)
    })

    it("should handle adjacent periods as non-overlapping", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const period1 = new Period(
        factory.fromDatabase(1000000),
        factory.fromDatabase(2000000),
      )
      const period2 = new Period(
        factory.fromDatabase(2000000),
        factory.fromDatabase(3000000),
      )

      expect(period1.overlaps(period2)).toBe(false)
    })
  })

  describe("Period intersection", () => {
    it("should find intersection of overlapping periods", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const period1 = new Period(
        factory.fromDatabase(1000000),
        factory.fromDatabase(2000000),
      )
      const period2 = new Period(
        factory.fromDatabase(1500000),
        factory.fromDatabase(2500000),
      )

      const intersection = period1.intersection(period2)

      expect(intersection).not.toBeNull()
      expect(intersection?.startsAt.toDatabase()).toBe(1500000)
      expect(intersection?.endsAt.toDatabase()).toBe(2000000)
    })

    it("should return null for non-overlapping periods", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const period1 = new Period(
        factory.fromDatabase(1000000),
        factory.fromDatabase(2000000),
      )
      const period2 = new Period(
        factory.fromDatabase(2000000),
        factory.fromDatabase(3000000),
      )

      const intersection = period1.intersection(period2)

      expect(intersection).toBeNull()
    })
  })

  describe("Period equality", () => {
    it("should check period equality", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start1 = factory.fromDatabase(1000000)
      const end1 = factory.fromDatabase(2000000)
      const start2 = factory.fromDatabase(1000000)
      const end2 = factory.fromDatabase(2000000)

      const period1 = new Period(start1, end1)
      const period2 = new Period(start2, end2)

      expect(period1.equals(period2)).toBe(true)
    })

    it("should detect unequal periods", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const period1 = new Period(
        factory.fromDatabase(1000000),
        factory.fromDatabase(2000000),
      )
      const period2 = new Period(
        factory.fromDatabase(1000000),
        factory.fromDatabase(3000000),
      )

      expect(period1.equals(period2)).toBe(false)
    })
  })

  describe("Billing cycles generation", () => {
    it("should generate daily cycles", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0)
      const cycles = start.cycles(3, { interval: "DAILY" })

      expect(cycles.length).toBe(3)
      expect(cycles[0].startsAt.equals(start)).toBe(true)

      // Each cycle should be 1 day
      for (let i = 0; i < cycles.length; i++) {
        const duration = cycles[i].getDuration("days")
        expect(duration).toBeCloseTo(1, 5)
      }
    })

    it("should generate weekly cycles", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0)
      const cycles = start.cycles(4, { interval: "WEEKLY" })

      expect(cycles.length).toBe(4)

      // Each cycle should be 7 days
      for (let i = 0; i < cycles.length; i++) {
        const duration = cycles[i].getDuration("days")
        expect(duration).toBeCloseTo(7, 5)
      }
    })

    it("should generate monthly cycles", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0) // 1970-01-01
      const cycles = start.cycles(3, { interval: "MONTHLY" })

      expect(cycles.length).toBe(3)
    })

    it("should generate quarterly cycles", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0)
      const cycles = start.cycles(2, { interval: "QUARTERLY" })

      expect(cycles.length).toBe(2)
    })

    it("should generate yearly cycles", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0)
      const cycles = start.cycles(2, { interval: "YEARLY" })

      expect(cycles.length).toBe(2)
    })

    it("should throw for invalid interval", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0)

      expect(() => start.cycles(1, { interval: "INVALID" as any })).toThrow()
    })

    it("should throw for invalid count", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0)

      expect(() => start.cycles(0, { interval: "MONTHLY" })).toThrow()
      expect(() => start.cycles(-1, { interval: "MONTHLY" })).toThrow()
    })

    it("should create consecutive periods", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0)
      const cycles = start.cycles(3, { interval: "DAILY" })

      // Each period's end should be the next period's start
      for (let i = 0; i < cycles.length - 1; i++) {
        expect(cycles[i].endsAt.equals(cycles[i + 1].startsAt)).toBe(true)
      }
    })
  })

  describe("Period string representation", () => {
    it("should provide readable string representation", () => {
      const factory = Zeit.withUserZone(Timezone.UTC)
      const start = factory.fromDatabase(0)
      const end = start.add({ days: 1 })
      const period = new Period(start, end)

      const str = period.toString()

      expect(str).toContain("Period(")
      expect(str).toContain("-")
    })
  })
})
