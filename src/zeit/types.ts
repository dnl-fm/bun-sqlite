/**
 * Types and interfaces for Zeit datetime module
 */

/**
 * Forward reference to Zeit class to avoid circular imports
 */
export type ZeitLike = {
  toDatabase(): number
  getTimestamp(): number
  getTimezone(): string
}

/**
 * Interval for billing cycles
 */
export type BillingInterval = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"

/**
 * Options for generating billing cycles
 */
export interface CycleOptions {
  interval: BillingInterval
}

/**
 * A billing period with start and end times
 */
export interface IPeriod {
  startsAt: ZeitLike
  endsAt: ZeitLike
  contains(zeit: ZeitLike): boolean
  getDuration(unit: "days" | "hours" | "minutes" | "seconds"): number
}

/**
 * Duration object for date arithmetic
 */
export interface Duration {
  years?: number
  months?: number
  weeks?: number
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
  milliseconds?: number
}

/**
 * IANA timezone identifiers organized by region
 * Provides dot-chain access: Timezone.Europe.Berlin, Timezone.America.New_York, etc
 * https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
 */
export const Timezone = {
  // Americas
  America: {
    New_York: "America/New_York",
    Los_Angeles: "America/Los_Angeles",
    Denver: "America/Denver",
    Chicago: "America/Chicago",
    Anchorage: "America/Anchorage",
    Toronto: "America/Toronto",
    Mexico_City: "America/Mexico_City",
    Sao_Paulo: "America/Sao_Paulo",
    Buenos_Aires: "America/Buenos_Aires",
  },

  // Europe
  Europe: {
    London: "Europe/London",
    Paris: "Europe/Paris",
    Berlin: "Europe/Berlin",
    Amsterdam: "Europe/Amsterdam",
    Moscow: "Europe/Moscow",
    Istanbul: "Europe/Istanbul",
  },

  // Asia
  Asia: {
    Tokyo: "Asia/Tokyo",
    Shanghai: "Asia/Shanghai",
    Hong_Kong: "Asia/Hong_Kong",
    Bangkok: "Asia/Bangkok",
    Singapore: "Asia/Singapore",
    Dubai: "Asia/Dubai",
    Kolkata: "Asia/Kolkata",
  },

  // Australia
  Australia: {
    Sydney: "Australia/Sydney",
    Melbourne: "Australia/Melbourne",
  },

  // Pacific
  Pacific: {
    Auckland: "Pacific/Auckland",
  },

  // Africa
  Africa: {
    Cairo: "Africa/Cairo",
    Johannesburg: "Africa/Johannesburg",
    Lagos: "Africa/Lagos",
  },

  // UTC (special case - not regional)
  UTC: "UTC",
} as const

/**
 * Extract all timezone string values from the nested Timezone structure
 * Results in a union type of all valid timezone identifiers
 * Example: "America/New_York" | "Europe/Berlin" | "UTC"
 */
type ExtractTimezones<T> = T extends string
  ? T
  : T extends object
    ? { [K in keyof T]: ExtractTimezones<T[K]> }[keyof T]
    : never

export type TimezoneValue = ExtractTimezones<typeof Timezone>
