/**
 * Zeit - Timezone-aware datetime for subscriptions and billing
 * Handles seamless conversion between user local time and UTC database storage
 */

import type { CycleOptions, Duration, IPeriod, TimezoneValue } from "./types.ts"
import { Period } from "./period.ts"

/**
 * Zeit represents a moment in time with timezone awareness
 * Internally stores UTC timestamp (milliseconds since epoch)
 * Converts transparently between user timezone and UTC
 */
export class Zeit {
  /**
   * UTC timestamp in milliseconds since epoch
   */
  private readonly utcTimestamp: number

  /**
   * User's timezone (IANA identifier)
   */
  private readonly userTimezone: string

  /**
   * Create a new Zeit instance
   * @param utcTimestamp - UTC timestamp in milliseconds
   * @param userTimezone - IANA timezone identifier
   */
  private constructor(utcTimestamp: number, userTimezone: string) {
    // Validate timestamp
    if (!Number.isFinite(utcTimestamp)) {
      throw new Error(`Invalid timestamp: ${utcTimestamp}`)
    }

    // Validate timezone
    if (typeof userTimezone !== "string" || !userTimezone.length) {
      throw new Error(`Invalid timezone: ${userTimezone}`)
    }

    this.utcTimestamp = Math.floor(utcTimestamp)
    this.userTimezone = userTimezone
  }

  /**
   * Create a Zeit instance for a specific user timezone
   * @param timezone - IANA timezone identifier (use TimezoneValue for autocomplete, or provide a string)
   * @returns A ZeitFactory to create Zeit instances in this timezone
   */
  static withUserZone(timezone: TimezoneValue | string): ZeitFactory {
    const tz = String(timezone)
    if (!tz || tz.length === 0) {
      throw new Error("Timezone cannot be empty")
    }
    return new ZeitFactory(tz)
  }

  /**
   * @internal Factory method for creating Zeit instances
   * @param utcTimestamp - UTC timestamp in milliseconds
   * @param userTimezone - IANA timezone identifier
   * @returns Zeit instance
   */
  static createInstance(utcTimestamp: number, userTimezone: string): Zeit {
    return new Zeit(utcTimestamp, userTimezone)
  }

  /**
   * Get the UTC timestamp (for database storage)
   * @returns Milliseconds since epoch
   */
  toDatabase(): number {
    return this.utcTimestamp
  }

  /**
   * Get ISO string in user's local timezone (for display)
   * @returns ISO 8601 string in user's timezone
   */
  toUser(): string {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: this.userTimezone,
      hour12: false,
    })

    const parts = formatter.formatToParts(new Date(this.utcTimestamp))
    const values: Record<string, string> = {}

    for (const { type, value } of parts) {
      if (type !== "literal") {
        values[type] = value
      }
    }

    // Format: YYYY-MM-DDTHH:mm:ss
    return `${values.year || "1970"}-${values.month || "01"}-${values.day || "01"}T${values.hour || "00"}:${values.minute || "00"}:${values.second || "00"}`
  }

  /**
   * Get the underlying Temporal.Instant for advanced operations
   * @returns Date object representing this instant
   */
  getInstant(): Date {
    return new Date(this.utcTimestamp)
  }

  /**
   * Get the UTC timestamp
   * @returns Milliseconds since epoch
   */
  getTimestamp(): number {
    return this.utcTimestamp
  }

  /**
   * Get the timezone
   * @returns IANA timezone identifier
   */
  getTimezone(): string {
    return this.userTimezone
  }

  /**
   * Create an immutable copy of this Zeit
   * @returns New Zeit instance with same timestamp and timezone
   */
  clone(): Zeit {
    return new Zeit(this.utcTimestamp, this.userTimezone)
  }

  /**
   * Add duration to this Zeit
   * @param duration - Duration to add
   * @returns New Zeit instance with duration added
   */
  add(duration: Duration): Zeit {
    let timestamp = this.utcTimestamp

    // Convert to milliseconds and add
    if (duration.years || duration.months) {
      // For months and years, we need to work with the date
      const date = new Date(timestamp)
      const formatter = new Intl.DateTimeFormat("sv-SE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: this.userTimezone,
      })

      const parts = formatter.formatToParts(date)
      const values: Record<string, string> = {}
      for (const { type, value } of parts) {
        if (type !== "literal") {
          values[type] = value
        }
      }

      let year = parseInt(values.year || "1970", 10)
      let month = parseInt(values.month || "01", 10)
      let day = parseInt(values.day || "01", 10)

      year += duration.years || 0
      month += duration.months || 0

      // Handle month overflow
      while (month > 12) {
        month -= 12
        year += 1
      }
      while (month < 1) {
        month += 12
        year -= 1
      }

      // Normalize day for end-of-month dates
      const daysInMonth = this.getDaysInMonth(year, month)
      if (day > daysInMonth) {
        day = daysInMonth
      }

      // Parse time components from the current user time
      const userTimeStr = this.toUser().split("T")[1] || "00:00:00"
      const timeParts = userTimeStr.split(":")
      const hour = parseInt(timeParts[0] || "0", 10)
      const minute = parseInt(timeParts[1] || "0", 10)
      const secondAndMs = (timeParts[2] || "0").split(".")
      const second = parseInt(secondAndMs[0] || "0", 10)
      const millisecond = parseInt((secondAndMs[1] || "0").padEnd(3, "0").slice(0, 3), 10)

      // Use the shared helper to convert local date/time to UTC
      timestamp = this.localDateToUtcTimestamp(year, month, day, hour, minute, second, millisecond)
    }

    if (duration.weeks) {
      timestamp += duration.weeks * 7 * 24 * 60 * 60 * 1000
    }
    if (duration.days) {
      timestamp += duration.days * 24 * 60 * 60 * 1000
    }
    if (duration.hours) {
      timestamp += duration.hours * 60 * 60 * 1000
    }
    if (duration.minutes) {
      timestamp += duration.minutes * 60 * 1000
    }
    if (duration.seconds) {
      timestamp += duration.seconds * 1000
    }
    if (duration.milliseconds) {
      timestamp += duration.milliseconds
    }

    return new Zeit(timestamp, this.userTimezone)
  }

  /**
   * Add business days (skip weekends)
   * @param count - Number of business days to add
   * @returns New Zeit instance moved forward by business days
   */
  addBusinessDays(count: number): Zeit {
    if (count === 0) {
      return this.clone()
    }

    let current = this.clone()
    const direction = count > 0 ? 1 : -1
    let remaining = Math.abs(count)

    while (remaining > 0) {
      current = current.add({ days: direction })
      const dayOfWeek = new Date(current.utcTimestamp).getUTCDay()

      // Skip if Saturday (6) or Sunday (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        remaining -= 1
      }
    }

    return current
  }

  /**
   * Generate billing cycles
   * @param count - Number of periods to generate
   * @param options - Cycle options (interval)
   * @returns Array of Period instances
   */
  cycles(count: number, options: CycleOptions): IPeriod[] {
    if (count < 1) {
      throw new Error("Cycle count must be at least 1")
    }

    const periods: IPeriod[] = []
    let current = this.clone()

    for (let i = 0; i < count; i++) {
      const periodStart = current.clone()
      let periodEnd: Zeit

      if (options.interval === "DAILY") {
        periodEnd = periodStart.add({ days: 1 })
      } else if (options.interval === "WEEKLY") {
        periodEnd = periodStart.add({ weeks: 1 })
      } else if (options.interval === "MONTHLY") {
        periodEnd = this.addMonthWithNormalization(periodStart, 1)
      } else if (options.interval === "QUARTERLY") {
        periodEnd = this.addMonthWithNormalization(periodStart, 3)
      } else if (options.interval === "YEARLY") {
        periodEnd = this.addMonthWithNormalization(periodStart, 12)
      } else {
        throw new Error(`Unknown interval: ${options.interval}`)
      }

      periods.push(new Period(periodStart, periodEnd))
      current = periodEnd
    }

    return periods
  }

  /**
   * Check if this Zeit is equal to another
   * @param other - Other Zeit instance
   * @returns True if timestamps are equal
   */
  equals(other: Zeit): boolean {
    return this.utcTimestamp === other.utcTimestamp
  }

  /**
   * Check if this Zeit is before another
   * @param other - Other Zeit instance
   * @returns True if this is before other
   */
  isBefore(other: Zeit): boolean {
    return this.utcTimestamp < other.utcTimestamp
  }

  /**
   * Check if this Zeit is after another
   * @param other - Other Zeit instance
   * @returns True if this is after other
   */
  isAfter(other: Zeit): boolean {
    return this.utcTimestamp > other.utcTimestamp
  }

  /**
   * Get difference in milliseconds to another Zeit
   * @param other - Other Zeit instance
   * @returns Milliseconds difference
   */
  diff(other: Zeit): number {
    return this.utcTimestamp - other.utcTimestamp
  }

  // Private helper methods

  /**
   * Convert local date/time components to UTC timestamp
   * This is a shared helper used by both add() and addMonthWithNormalization()
   * to ensure consistent timezone handling.
   * @param year - Year
   * @param month - Month (1-12)
   * @param day - Day (1-31)
   * @param hour - Hour (0-23)
   * @param minute - Minute (0-59)
   * @param second - Second (0-59)
   * @param millisecond - Millisecond (0-999)
   * @returns UTC timestamp in milliseconds
   */
  private localDateToUtcTimestamp(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    millisecond: number = 0,
  ): number {
    // Create a UTC date from the components
    const utcTimestamp = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond))
      .getTime()

    // Get the timezone offset for this date
    const offset = this.getTimezoneOffset(new Date(utcTimestamp))

    // Adjust for timezone offset: subtract the offset to get the true UTC time
    // that represents the local time in the user's timezone
    return utcTimestamp - offset * 60 * 1000
  }

  /**
   * Get number of days in a month
   * @param year - Year
   * @param month - Month (1-12)
   * @returns Number of days
   */
  private getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate()
  }

  /**
   * Add months with end-of-month normalization
   * E.g., Jan 31 + 1 month = Feb 28/29 (not Mar 3)
   * @param zeit - Starting Zeit
   * @param months - Months to add
   * @returns New Zeit instance
   */
  private addMonthWithNormalization(zeit: Zeit, months: number): Zeit {
    const date = new Date(zeit.utcTimestamp)
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: this.userTimezone,
    })

    const parts = formatter.formatToParts(date)
    const values: Record<string, string> = {}
    for (const { type, value } of parts) {
      if (type !== "literal") {
        values[type] = value
      }
    }

    let year = parseInt(values.year || "1970", 10)
    let month = parseInt(values.month || "01", 10)
    let day = parseInt(values.day || "01", 10)
    const originalDay = day

    // Add months
    month += months
    while (month > 12) {
      month -= 12
      year += 1
    }
    while (month < 1) {
      month += 12
      year -= 1
    }

    // Normalize day for month-end
    const daysInNewMonth = this.getDaysInMonth(year, month)
    day = Math.min(originalDay, daysInNewMonth)

    // Parse time components from the input Zeit
    const userTimeStr = zeit.toUser().split("T")[1] || "00:00:00"
    const timeParts = userTimeStr.split(":")
    const hour = parseInt(timeParts[0] || "0", 10)
    const minute = parseInt(timeParts[1] || "0", 10)
    const secondAndMs = (timeParts[2] || "0").split(".")
    const second = parseInt(secondAndMs[0] || "0", 10)
    const millisecond = parseInt((secondAndMs[1] || "0").padEnd(3, "0").slice(0, 3), 10)

    // Use the shared helper to convert local date/time to UTC
    const timestamp = this.localDateToUtcTimestamp(year, month, day, hour, minute, second, millisecond)

    return Zeit.createInstance(timestamp, this.userTimezone)
  }

  /**
   * Get timezone offset in minutes from UTC
   * @param date - Date to check offset for
   * @returns Offset in minutes (positive = east of UTC)
   */
  private getTimezoneOffset(date: Date): number {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: this.userTimezone,
      timeZoneName: "shortOffset",
    })

    const parts = formatter.formatToParts(date)
    const offsetPart = parts.find((p) => p.type === "timeZoneName")

    if (!offsetPart) {
      return 0
    }

    const offsetStr = offsetPart.value
    const match = offsetStr.match(/([+-])(\d{1,2}):(\d{2})/)

    if (!match) {
      return 0
    }

    const sign = (match[1] || "+") === "+" ? 1 : -1
    const hours = parseInt(match[2] || "0", 10)
    const minutes = parseInt(match[3] || "0", 10)

    return sign * (hours * 60 + minutes)
  }
}

/**
 * Factory for creating Zeit instances in a specific timezone
 */
export class ZeitFactory {
  constructor(private readonly timezone: string) {}

  /**
   * Parse an ISO 8601 string in user local time
   * @param isoString - ISO 8601 string (e.g., "2024-03-01T10:00:00")
   * @returns Zeit instance representing that local time as UTC
   */
  fromUser(isoString: string): Zeit {
    // Parse the ISO string (assuming it's in user timezone)
    const date = new Date(isoString)

    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid date string: ${isoString}`)
    }

    // The date is treated as local time in the user's timezone
    // We need to find the UTC timestamp that corresponds to this local time
    const timestamp = this.localToUtc(date)

    return Zeit.createInstance(timestamp, this.timezone)
  }

  /**
   * Load a UTC timestamp from database
   * @param timestamp - UTC timestamp in milliseconds
   * @returns Zeit instance representing that UTC time
   */
  fromDatabase(timestamp: number): Zeit {
    return Zeit.createInstance(timestamp, this.timezone)
  }

  /**
   * Get current time in user's timezone
   * @returns Zeit instance for now
   */
  now(): Zeit {
    return Zeit.createInstance(Date.now(), this.timezone)
  }

  /**
   * Convert local time to UTC
   * @param date - Date parsed from local time string
   * @returns UTC timestamp
   */
  private localToUtc(date: Date): number {
    // This is a simplified approach: parse the string as UTC, then adjust
    const utcTime = date.getTime()

    // Get the offset between this timezone and UTC for this date
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: this.timezone,
      hour12: false,
    })

    const parts = formatter.formatToParts(new Date(utcTime))
    const values: Record<string, string> = {}
    for (const { type, value } of parts) {
      if (type !== "literal") {
        values[type] = value
      }
    }

    const localDateString = `${values.year || "1970"}-${values.month || "01"}-${values.day || "01"}T${values.hour || "00"}:${values.minute || "00"}:${values.second || "00"}`
    const localDate = new Date(localDateString)

    // The difference tells us the offset
    const offset = localDate.getTime() - utcTime

    return utcTime + offset
  }
}
