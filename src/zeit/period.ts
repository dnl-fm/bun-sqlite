/**
 * Period - Represents a billing period or date range
 */

import type { IPeriod } from "./types.ts"
import type { Zeit } from "./zeit.ts"

/**
 * Period represents a contiguous time span between two Zeit instances
 * Supports operations like checking if a date is within the period or calculating duration
 */
export class Period implements IPeriod {
  /**
   * Start of the period (inclusive)
   */
  readonly startsAt: Zeit

  /**
   * End of the period (exclusive)
   */
  readonly endsAt: Zeit

  /**
   * Create a new Period
   * @param startsAt - Start Zeit (inclusive)
   * @param endsAt - End Zeit (exclusive)
   */
  constructor(startsAt: Zeit, endsAt: Zeit) {
    if (endsAt.isBefore(startsAt)) {
      throw new Error("Period end time must be after start time")
    }

    this.startsAt = startsAt
    this.endsAt = endsAt
  }

  /**
   * Check if a Zeit falls within this period
   * @param zeit - Zeit to check
   * @returns True if zeit is within [startsAt, endsAt)
   */
  contains(zeit: Zeit): boolean {
    return (
      (zeit.isAfter(this.startsAt) || zeit.equals(this.startsAt)) &&
      zeit.isBefore(this.endsAt)
    )
  }

  /**
   * Get the duration of this period
   * @param unit - Unit to return (days, hours, minutes, seconds)
   * @returns Duration in the specified unit
   */
  getDuration(unit: "days" | "hours" | "minutes" | "seconds"): number {
    const diffMs = this.endsAt.diff(this.startsAt)

    switch (unit) {
      case "days":
        return diffMs / (24 * 60 * 60 * 1000)
      case "hours":
        return diffMs / (60 * 60 * 1000)
      case "minutes":
        return diffMs / (60 * 1000)
      case "seconds":
        return diffMs / 1000
      default:
        throw new Error(`Unknown unit: ${unit}`)
    }
  }

  /**
   * Check if another period overlaps with this one
   * @param other - Other period to check
   * @returns True if periods overlap
   */
  overlaps(other: Period): boolean {
    return this.startsAt.isBefore(other.endsAt) && other.startsAt.isBefore(this.endsAt)
  }

  /**
   * Get intersection with another period if they overlap
   * @param other - Other period to intersect with
   * @returns New Period for the intersection, or null if no overlap
   */
  intersection(other: Period): Period | null {
    if (!this.overlaps(other)) {
      return null
    }

    const start = this.startsAt.isAfter(other.startsAt) ? this.startsAt : other.startsAt
    const end = this.endsAt.isBefore(other.endsAt) ? this.endsAt : other.endsAt

    return new Period(start, end)
  }

  /**
   * Check if this period equals another
   * @param other - Other period to compare
   * @returns True if both periods have same start and end
   */
  equals(other: Period): boolean {
    return this.startsAt.equals(other.startsAt) && this.endsAt.equals(other.endsAt)
  }

  /**
   * Get string representation
   * @returns Period description
   */
  toString(): string {
    return `Period(${this.startsAt.toUser()} - ${this.endsAt.toUser()})`
  }
}
