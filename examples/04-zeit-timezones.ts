/**
 * Zeit - Timezone-aware datetime for subscriptions and billing
 *
 * Zeit handles seamless conversion between user local time and UTC database storage,
 * perfect for subscription services, billing systems, and international applications.
 *
 * @example
 * // Create a timezone-aware factory
 * const userFactory = Zeit.withUserZone(Timezone.America.New_York)
 *
 * // Parse user's local time
 * const userTime = userFactory.fromUser("2024-10-21T10:30:00")
 *
 * // Store UTC timestamp in database
 * const dbTimestamp = userTime.toDatabase() // milliseconds
 *
 * // Display back in user's timezone
 * const displayTime = userTime.toUser() // ISO string
 *
 * // Generate billing cycles
 * const cycles = userTime.cycles(12, { interval: "MONTHLY" })
 */

import { Zeit, Timezone, Period } from "../src/index.ts"

/**
 * Example 1: Basic timezone conversion
 * Shows how to convert between user timezone and UTC storage
 */
export function example1_BasicTimezonConversion() {
  console.log("=== Example 1: Basic Timezone Conversion ===\n")

  // Create a factory for a specific user's timezone
  // Timezone now supports dot-chain access: Timezone.Region.City
  const userFactory = Zeit.withUserZone(Timezone.Europe.London)

  // User enters time in their local timezone
  const userTime = userFactory.fromUser("2024-10-21T14:30:00")
  console.log(`User's local time: ${userTime.toUser()}`)
  console.log(`UTC timestamp (for database): ${userTime.toDatabase()}\n`)

  // Load from database and display in user's timezone
  const fromDb = userFactory.fromDatabase(userTime.toDatabase())
  console.log(`Retrieved from DB: ${fromDb.toUser()}\n`)
}

/**
 * Example 2: Subscription billing cycles
 * Generates monthly billing periods with automatic month-end normalization
 */
export function example2_BillingCycles() {
  console.log("=== Example 2: Subscription Billing Cycles ===\n")

  // Using dot-chain access: Timezone.America.New_York
  const userFactory = Zeit.withUserZone(Timezone.America.New_York)

  // Start subscription on Jan 31
  const subscriptionStart = userFactory.fromUser("2024-01-31T00:00:00")
  console.log(`Subscription starts: ${subscriptionStart.toUser()}`)

  // Generate 3 monthly billing periods
  const billingCycles = subscriptionStart.cycles(3, { interval: "MONTHLY" })

  console.log("\nBilling periods:")
  for (let i = 0; i < billingCycles.length; i++) {
    const cycle = billingCycles[i]
    const duration = cycle.getDuration("days")
    console.log(
      `  Period ${i + 1}: ${cycle.startsAt.toUser()} → ${cycle.endsAt.toUser()}`,
    )
    console.log(`    Duration: ${duration.toFixed(1)} days\n`)
  }

  console.log("Note: Jan 31 → Feb 29 (leap year) → Mar 30 (month normalization)\n")
}

/**
 * Example 3: Period operations
 * Demonstrates checking if dates fall within periods and calculating durations
 */
export function example3_PeriodOperations() {
  console.log("=== Example 3: Period Operations ===\n")

  // UTC is a special case (not regional), accessible at root: Timezone.UTC
  const factory = Zeit.withUserZone(Timezone.UTC)

  // Create a billing period
  const start = factory.fromDatabase(new Date("2024-01-01T00:00:00Z").getTime())
  const end = factory.fromDatabase(new Date("2024-01-31T23:59:59Z").getTime())
  const period = new Period(start, end)

  console.log(`Period: ${period.startsAt.toUser()} to ${period.endsAt.toUser()}\n`)

  // Check if specific dates are within the period
  const testDates = [
    { date: "2024-01-15T12:00:00Z", description: "Mid-January" },
    { date: "2024-02-01T00:00:00Z", description: "February 1st" },
  ]

  console.log("Date containment checks:")
  for (const test of testDates) {
    const testZeit = factory.fromDatabase(new Date(test.date).getTime())
    const isContained = period.contains(testZeit)
    console.log(`  ${test.description}: ${isContained ? "✓ In period" : "✗ Not in period"}\n`)
  }

  console.log(`Period duration: ${period.getDuration("days")} days\n`)
}

/**
 * Example 4: Business day calculations
 * Shows how to add/subtract business days (skipping weekends)
 */
export function example4_BusinessDays() {
  console.log("=== Example 4: Business Day Calculations ===\n")

  const factory = Zeit.withUserZone(Timezone.UTC)

  // Friday, January 5, 2024
  const friday = factory.fromDatabase(new Date("2024-01-05T09:00:00Z").getTime())
  console.log(`Start date (Friday): ${friday.toUser()}`)

  // Add 5 business days (should land on Thursday, Jan 11)
  const dueDate = friday.addBusinessDays(5)
  console.log(`After 5 business days: ${dueDate.toUser()}\n`)

  // Calculate the actual calendar days passed
  const calendarDays = dueDate.diff(friday) / (24 * 60 * 60 * 1000)
  console.log(`Calendar days passed: ${calendarDays} days\n`)
}

/**
 * Example 5: Date arithmetic
 * Demonstrates adding durations to dates
 */
export function example5_DateArithmetic() {
  console.log("=== Example 5: Date Arithmetic ===\n")

  // Using dot-chain access: Timezone.Asia.Tokyo
  const factory = Zeit.withUserZone(Timezone.Asia.Tokyo)

  const now = factory.now()
  console.log(`Now: ${now.toUser()}\n`)

  // Add various durations
  const scenarios = [
    { duration: { days: 7 }, description: "Add 7 days (1 week)" },
    { duration: { months: 1 }, description: "Add 1 month" },
    { duration: { hours: 24, minutes: 30 }, description: "Add 24 hours 30 minutes" },
  ]

  console.log("Date arithmetic:")
  for (const scenario of scenarios) {
    const result = now.add(scenario.duration)
    console.log(`${scenario.description}:`)
    console.log(`  ${result.toUser()}\n`)
  }
}

/**
 * Example 6: Multi-timezone support
 * Shows handling the same moment in different timezones
 */
export function example6_MultiTimezone() {
  console.log("=== Example 6: Multi-Timezone Support ===\n")

  // Same instant in time, but displayed in different timezones
  // All using dot-chain access for better IDE autocomplete
  const nyFactory = Zeit.withUserZone(Timezone.America.New_York)
  const londonFactory = Zeit.withUserZone(Timezone.Europe.London)
  const tokyoFactory = Zeit.withUserZone(Timezone.Asia.Tokyo)

  // Create a time in NY
  const nyTime = nyFactory.fromUser("2024-10-21T09:00:00")
  const utcTimestamp = nyTime.toDatabase()

  console.log(`Event at: ${utcTimestamp}\n`)
  console.log("Same moment in different timezones:")
  console.log(`  New York: ${nyFactory.fromDatabase(utcTimestamp).toUser()}`)
  console.log(`  London: ${londonFactory.fromDatabase(utcTimestamp).toUser()}`)
  console.log(`  Tokyo: ${tokyoFactory.fromDatabase(utcTimestamp).toUser()}\n`)
}

// Run all examples
if (import.meta.main) {
  example1_BasicTimezonConversion()
  example2_BillingCycles()
  example3_PeriodOperations()
  example4_BusinessDays()
  example5_DateArithmetic()
  example6_MultiTimezone()
}
