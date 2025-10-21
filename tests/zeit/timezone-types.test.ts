import { describe, it, expect } from "bun:test"
import { Zeit, Timezone, type TimezoneValue } from "../../src/zeit/index.ts"

describe("Timezone type system refactoring", () => {
  describe("Nested const object structure", () => {
    it("should access American timezones via dot notation", () => {
      expect(Timezone.America.New_York).toBe("America/New_York")
      expect(Timezone.America.Los_Angeles).toBe("America/Los_Angeles")
      expect(Timezone.America.Denver).toBe("America/Denver")
      expect(Timezone.America.Chicago).toBe("America/Chicago")
      expect(Timezone.America.Anchorage).toBe("America/Anchorage")
      expect(Timezone.America.Toronto).toBe("America/Toronto")
      expect(Timezone.America.Mexico_City).toBe("America/Mexico_City")
      expect(Timezone.America.Sao_Paulo).toBe("America/Sao_Paulo")
      expect(Timezone.America.Buenos_Aires).toBe("America/Buenos_Aires")
    })

    it("should access European timezones via dot notation", () => {
      expect(Timezone.Europe.London).toBe("Europe/London")
      expect(Timezone.Europe.Paris).toBe("Europe/Paris")
      expect(Timezone.Europe.Berlin).toBe("Europe/Berlin")
      expect(Timezone.Europe.Amsterdam).toBe("Europe/Amsterdam")
      expect(Timezone.Europe.Moscow).toBe("Europe/Moscow")
      expect(Timezone.Europe.Istanbul).toBe("Europe/Istanbul")
    })

    it("should access Asian timezones via dot notation", () => {
      expect(Timezone.Asia.Tokyo).toBe("Asia/Tokyo")
      expect(Timezone.Asia.Shanghai).toBe("Asia/Shanghai")
      expect(Timezone.Asia.Hong_Kong).toBe("Asia/Hong_Kong")
      expect(Timezone.Asia.Bangkok).toBe("Asia/Bangkok")
      expect(Timezone.Asia.Singapore).toBe("Asia/Singapore")
      expect(Timezone.Asia.Dubai).toBe("Asia/Dubai")
      expect(Timezone.Asia.Kolkata).toBe("Asia/Kolkata")
    })

    it("should access Australian and Pacific timezones via dot notation", () => {
      expect(Timezone.Australia.Sydney).toBe("Australia/Sydney")
      expect(Timezone.Australia.Melbourne).toBe("Australia/Melbourne")
      expect(Timezone.Pacific.Auckland).toBe("Pacific/Auckland")
    })

    it("should access African timezones via dot notation", () => {
      expect(Timezone.Africa.Cairo).toBe("Africa/Cairo")
      expect(Timezone.Africa.Johannesburg).toBe("Africa/Johannesburg")
      expect(Timezone.Africa.Lagos).toBe("Africa/Lagos")
    })

    it("should access UTC special case", () => {
      expect(Timezone.UTC).toBe("UTC")
    })
  })

  describe("TimezoneValue type union", () => {
    it("should work with Zeit.withUserZone() using nested access", () => {
      // Test American timezone
      const factory1 = Zeit.withUserZone(Timezone.America.New_York)
      const zeit1 = factory1.now()
      expect(zeit1.getTimezone()).toBe("America/New_York")

      // Test European timezone
      const factory2 = Zeit.withUserZone(Timezone.Europe.Berlin)
      const zeit2 = factory2.now()
      expect(zeit2.getTimezone()).toBe("Europe/Berlin")

      // Test Asian timezone
      const factory3 = Zeit.withUserZone(Timezone.Asia.Tokyo)
      const zeit3 = factory3.now()
      expect(zeit3.getTimezone()).toBe("Asia/Tokyo")

      // Test UTC
      const factory4 = Zeit.withUserZone(Timezone.UTC)
      const zeit4 = factory4.now()
      expect(zeit4.getTimezone()).toBe("UTC")
    })

    it("should still accept string timezone directly", () => {
      const factory = Zeit.withUserZone("America/New_York")
      const zeit = factory.now()
      expect(zeit.getTimezone()).toBe("America/New_York")
    })

    it("should accept all timezone values from Timezone object", () => {
      const timezones: TimezoneValue[] = [
        Timezone.America.New_York,
        Timezone.America.Los_Angeles,
        Timezone.Europe.Berlin,
        Timezone.Europe.London,
        Timezone.Asia.Tokyo,
        Timezone.Asia.Shanghai,
        Timezone.Australia.Sydney,
        Timezone.Africa.Cairo,
        Timezone.UTC,
      ]

      // All should be valid strings
      expect(timezones.every((tz) => typeof tz === "string")).toBe(true)

      // All should work with Zeit.withUserZone()
      timezones.forEach((tz) => {
        const factory = Zeit.withUserZone(tz)
        const zeit = factory.now()
        expect(zeit.getTimezone()).toBe(tz)
      })
    })
  })

  describe("Backward compatibility", () => {
    it("should work with existing enum-style usage", () => {
      // These patterns should still work
      const tz1: TimezoneValue = Timezone.UTC
      const tz2: TimezoneValue = Timezone.Europe.Paris
      const tz3: TimezoneValue = Timezone.America.Los_Angeles

      const factory1 = Zeit.withUserZone(tz1)
      const factory2 = Zeit.withUserZone(tz2)
      const factory3 = Zeit.withUserZone(tz3)

      expect(factory1.now().getTimezone()).toBe("UTC")
      expect(factory2.now().getTimezone()).toBe("Europe/Paris")
      expect(factory3.now().getTimezone()).toBe("America/Los_Angeles")
    })

    it("should maintain IANA timezone identifier format", () => {
      const identifiers = [
        Timezone.America.New_York,
        Timezone.Europe.Berlin,
        Timezone.Asia.Tokyo,
        Timezone.Australia.Sydney,
        Timezone.Africa.Cairo,
        Timezone.UTC,
      ]

      identifiers.forEach((id) => {
        // All should contain "/" except UTC
        if (id !== "UTC") {
          expect(id.includes("/")).toBe(true)
        }

        // All should be non-empty strings
        expect(id.length).toBeGreaterThan(0)
      })
    })
  })

  describe("Type safety verification", () => {
    it("should ensure all timezone values are strings", () => {
      const regions = [
        ...Object.values(Timezone.America),
        ...Object.values(Timezone.Europe),
        ...Object.values(Timezone.Asia),
        ...Object.values(Timezone.Australia),
        ...Object.values(Timezone.Pacific),
        ...Object.values(Timezone.Africa),
      ]

      regions.forEach((region) => {
        expect(typeof region).toBe("string")
      })

      // UTC is special - it's directly a string
      expect(typeof Timezone.UTC).toBe("string")
    })

    it("should support literal type extraction", () => {
      // These specific assignments should work with strict literal types
      const newYork: "America/New_York" = Timezone.America.New_York
      const berlin: "Europe/Berlin" = Timezone.Europe.Berlin
      const tokyo: "Asia/Tokyo" = Timezone.Asia.Tokyo
      const utc: "UTC" = Timezone.UTC

      expect(newYork).toBe("America/New_York")
      expect(berlin).toBe("Europe/Berlin")
      expect(tokyo).toBe("Asia/Tokyo")
      expect(utc).toBe("UTC")
    })
  })

  describe("All timezone identifiers coverage", () => {
    it("should have all 29 timezones defined", () => {
      const timezones = [
        // Americas (9)
        Timezone.America.New_York,
        Timezone.America.Los_Angeles,
        Timezone.America.Denver,
        Timezone.America.Chicago,
        Timezone.America.Anchorage,
        Timezone.America.Toronto,
        Timezone.America.Mexico_City,
        Timezone.America.Sao_Paulo,
        Timezone.America.Buenos_Aires,
        // Europe (6)
        Timezone.Europe.London,
        Timezone.Europe.Paris,
        Timezone.Europe.Berlin,
        Timezone.Europe.Amsterdam,
        Timezone.Europe.Moscow,
        Timezone.Europe.Istanbul,
        // Asia (7)
        Timezone.Asia.Tokyo,
        Timezone.Asia.Shanghai,
        Timezone.Asia.Hong_Kong,
        Timezone.Asia.Bangkok,
        Timezone.Asia.Singapore,
        Timezone.Asia.Dubai,
        Timezone.Asia.Kolkata,
        // Australia (2)
        Timezone.Australia.Sydney,
        Timezone.Australia.Melbourne,
        // Pacific (1)
        Timezone.Pacific.Auckland,
        // Africa (3)
        Timezone.Africa.Cairo,
        Timezone.Africa.Johannesburg,
        Timezone.Africa.Lagos,
        // UTC (1)
        Timezone.UTC,
      ]

      expect(timezones.length).toBe(29)
      // All should be unique
      expect(new Set(timezones).size).toBe(29)
    })
  })
})
