# Timezone Type System - Usage Examples

After Phase 1 refactoring, the Timezone type system provides a modern, type-safe way to work with IANA timezone identifiers.

## Basic Usage

### Using Nested Timezone Access

```typescript
import { Zeit, Timezone } from "@dnl-fm/bun-sqlite/zeit"

// Europe
const berlinFactory = Zeit.withUserZone(Timezone.Europe.Berlin)
const berlinNow = berlinFactory.now()
console.log(berlinNow.getTimezone()) // "Europe/Berlin"

// Americas
const nyFactory = Zeit.withUserZone(Timezone.America.New_York)
const nyNow = nyFactory.now()
console.log(nyNow.getTimezone()) // "America/New_York"

// Asia
const tokyoFactory = Zeit.withUserZone(Timezone.Asia.Tokyo)
const tokyoNow = tokyoFactory.now()
console.log(tokyoNow.getTimezone()) // "Asia/Tokyo"

// UTC
const utcFactory = Zeit.withUserZone(Timezone.UTC)
const utcNow = utcFactory.now()
console.log(utcNow.getTimezone()) // "UTC"
```

## Type-Safe Timezone Handling

### Using TimezoneValue Type

```typescript
import { Zeit, type TimezoneValue } from "@dnl-fm/bun-sqlite/zeit"

// Function that accepts any valid timezone
function getUserTimeInTimezone(userId: string, timezone: TimezoneValue): string {
  const factory = Zeit.withUserZone(timezone)
  return factory.now().toUser()
}

// IDE provides autocomplete and type checking
getUserTimeInTimezone("user123", Timezone.Europe.Paris) // OK
getUserTimeInTimezone("user123", Timezone.America.Los_Angeles) // OK
getUserTimeInTimezone("user123", "America/New_York") // OK - still accepts strings
// getUserTimeInTimezone("user123", "Invalid/Timezone") // Type error!
```

## Working with Timezone Collections

### Iterating Over Regions

```typescript
import { Timezone } from "@dnl-fm/bun-sqlite/zeit"

// Get all European timezones
const europeanTimezones = Object.entries(Timezone.Europe)
europeanTimezones.forEach(([city, tz]) => {
  console.log(`${city}: ${tz}`)
  // London: Europe/London
  // Paris: Europe/Paris
  // Berlin: Europe/Berlin
  // etc.
})

// Get all American timezones
const americanTimezones = Object.values(Timezone.America)
americanTimezones.forEach(tz => {
  console.log(tz)
  // America/New_York
  // America/Los_Angeles
  // etc.
})

// Get all available timezones
const allRegions = ["America", "Europe", "Asia", "Australia", "Pacific", "Africa"]
const allTimezones = [
  ...Object.values(Timezone.America),
  ...Object.values(Timezone.Europe),
  ...Object.values(Timezone.Asia),
  ...Object.values(Timezone.Australia),
  ...Object.values(Timezone.Pacific),
  ...Object.values(Timezone.Africa),
  Timezone.UTC,
]
console.log(`Total timezones: ${allTimezones.length}`) // 29
```

## Database Integration

### Storing User Timezone Preference

```typescript
import { Zeit, Timezone, type TimezoneValue } from "@dnl-fm/bun-sqlite/zeit"

interface User {
  id: string
  email: string
  timezone: TimezoneValue // Strongly typed!
}

// Creating a user with timezone
const newUser: User = {
  id: "user-123",
  email: "user@example.com",
  timezone: Timezone.Europe.Berlin,
}

// When retrieving from database and passing back
function getUserLocalTime(user: User): string {
  const factory = Zeit.withUserZone(user.timezone)
  return factory.now().toUser()
}

console.log(getUserLocalTime(newUser)) // Returns current time in Berlin
```

## Billing Cycles in Different Timezones

```typescript
import { Zeit, Timezone } from "@dnl-fm/bun-sqlite/zeit"

// Create billing cycles in user's local timezone
const euFactory = Zeit.withUserZone(Timezone.Europe.London)
const billStart = euFactory.fromUser("2024-01-01T00:00:00")
const billEnd = billStart.add({ months: 1 })

// Generate monthly cycles in user's timezone
const cycles = billStart.cycles(12, { interval: "MONTHLY" })

console.log(`Billing cycles generated for user in London timezone`)
console.log(`First cycle: ${cycles[0].startsAt.toUser()} to ${cycles[0].endsAt.toUser()}`)
```

## Comparing Times Across Timezones

```typescript
import { Zeit, Timezone } from "@dnl-fm/bun-sqlite/zeit"

const timestamp = Date.now()

// Same moment, different displays
const londonTime = Zeit.withUserZone(Timezone.Europe.London)
  .fromDatabase(timestamp)
  .toUser()

const tokyoTime = Zeit.withUserZone(Timezone.Asia.Tokyo)
  .fromDatabase(timestamp)
  .toUser()

const nyTime = Zeit.withUserZone(Timezone.America.New_York)
  .fromDatabase(timestamp)
  .toUser()

console.log(`London: ${londonTime}`)
console.log(`Tokyo: ${tokyoTime}`)
console.log(`New York: ${nyTime}`)
// All represent the same instant, but display differently
```

## Backward Compatibility

### String Timezones Still Work

```typescript
import { Zeit } from "@dnl-fm/bun-sqlite/zeit"

// Old code using raw strings still works
const factory1 = Zeit.withUserZone("Europe/Berlin")
const factory2 = Zeit.withUserZone("America/New_York")

// But new code gets autocomplete and type safety
import { Timezone } from "@dnl-fm/bun-sqlite/zeit"
const factory3 = Zeit.withUserZone(Timezone.Europe.Berlin)
const factory4 = Zeit.withUserZone(Timezone.America.New_York)
```

## IDE Autocomplete Examples

### Three-Level Autocomplete Chain

When typing in an IDE that supports TypeScript:

```typescript
// Level 1: Type "Timezone."
Timezone.
// Suggestions: America, Europe, Asia, Australia, Pacific, Africa, UTC

// Level 2: Type "Timezone.Europe."
Timezone.Europe.
// Suggestions: London, Paris, Berlin, Amsterdam, Moscow, Istanbul

// Level 3: Full type and value available
Timezone.Europe.Berlin
// Type: "Europe/Berlin" (literal type)
// Value: "Europe/Berlin"
```

## All Available Timezones

### Americas (9)
- `Timezone.America.New_York` → "America/New_York"
- `Timezone.America.Los_Angeles` → "America/Los_Angeles"
- `Timezone.America.Denver` → "America/Denver"
- `Timezone.America.Chicago` → "America/Chicago"
- `Timezone.America.Anchorage` → "America/Anchorage"
- `Timezone.America.Toronto` → "America/Toronto"
- `Timezone.America.Mexico_City` → "America/Mexico_City"
- `Timezone.America.Sao_Paulo` → "America/Sao_Paulo"
- `Timezone.America.Buenos_Aires` → "America/Buenos_Aires"

### Europe (6)
- `Timezone.Europe.London` → "Europe/London"
- `Timezone.Europe.Paris` → "Europe/Paris"
- `Timezone.Europe.Berlin` → "Europe/Berlin"
- `Timezone.Europe.Amsterdam` → "Europe/Amsterdam"
- `Timezone.Europe.Moscow` → "Europe/Moscow"
- `Timezone.Europe.Istanbul` → "Europe/Istanbul"

### Asia (7)
- `Timezone.Asia.Tokyo` → "Asia/Tokyo"
- `Timezone.Asia.Shanghai` → "Asia/Shanghai"
- `Timezone.Asia.Hong_Kong` → "Asia/Hong_Kong"
- `Timezone.Asia.Bangkok` → "Asia/Bangkok"
- `Timezone.Asia.Singapore` → "Asia/Singapore"
- `Timezone.Asia.Dubai` → "Asia/Dubai"
- `Timezone.Asia.Kolkata` → "Asia/Kolkata"

### Australia (2)
- `Timezone.Australia.Sydney` → "Australia/Sydney"
- `Timezone.Australia.Melbourne` → "Australia/Melbourne"

### Pacific (1)
- `Timezone.Pacific.Auckland` → "Pacific/Auckland"

### Africa (3)
- `Timezone.Africa.Cairo` → "Africa/Cairo"
- `Timezone.Africa.Johannesburg` → "Africa/Johannesburg"
- `Timezone.Africa.Lagos` → "Africa/Lagos"

### UTC (1)
- `Timezone.UTC` → "UTC"

## Migration Guide

### From Old Enum Usage

```typescript
// OLD - No longer works with dot notation
Timezone["Europe/Berlin"] // ERROR - string index no longer supported

// NEW - Use dot notation
Timezone.Europe.Berlin // CORRECT

// OLD - Enum iteration
Object.values(Timezone)

// NEW - Navigate by region
Object.values(Timezone.Europe)
Object.values(Timezone.America)
```

## Type Safety Benefits

### Before (Enum)
```typescript
// Any string accepted - no type safety
Zeit.withUserZone("Europe/Berlin") // OK
Zeit.withUserZone("Invalid/Zone") // Also accepted!
```

### After (Nested Object + Union Type)
```typescript
import { Timezone, type TimezoneValue } from "@dnl-fm/bun-sqlite/zeit"

// Type-safe - only valid timezones
Zeit.withUserZone(Timezone.Europe.Berlin) // OK ✓
Zeit.withUserZone(Timezone.America.New_York) // OK ✓

// IDE and TypeScript catch errors
Zeit.withUserZone(Timezone.Invalid.Zone) // ERROR ✗ - Property does not exist
Zeit.withUserZone("Invalid/Zone") // Still works for backward compat, but no autocomplete

// In function signatures
function handleUserRequest(userTimezone: TimezoneValue) {
  // Only valid timezone values accepted
  // Prevents invalid strings from being passed
}
```
