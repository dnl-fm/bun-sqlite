/**
 * Example: Creating Simple Value Objects for Type-Safe IDs
 *
 * This example demonstrates how to build your own value objects
 * for entity IDs. Value objects provide:
 * - Type safety at compile time
 * - Domain modeling clarity
 * - Reusable ID logic
 *
 * You can adapt this pattern for any entity type (PostId, ProductId, etc.)
 */

import { Ulid } from "../src/index.ts"

/**
 * UserId - A simple value object for user identifiers
 * Demonstrates the pattern for creating type-safe ID objects
 */
export class UserId {
  private constructor(private readonly value: string) {}

  /**
   * Create a new UserId with a generated ULID
   */
  static create(): UserId {
    const ulid = Ulid.create({ prefix: "user_" })
    return new UserId(ulid.toString())
  }

  /**
   * Create a UserId from an existing string (with validation)
   */
  static fromString(value: string): UserId {
    if (!value.startsWith("user_")) {
      throw new Error(`Invalid UserId: "${value}" must start with "user_"`)
    }
    return new UserId(value)
  }

  /**
   * Get the string representation
   */
  toString(): string {
    return this.value
  }

  /**
   * Serialize for JSON
   */
  toJSON(): string {
    return this.value
  }

  /**
   * Compare two UserIds
   */
  equals(other: UserId | string): boolean {
    const otherValue = typeof other === "string" ? other : other.toString()
    return this.value === otherValue
  }
}

/**
 * Example: Using UserId in a repository
 */
import { Database, Query, BaseRepository, Zeit, Timezone } from "../src/index.ts"

interface User {
  id: UserId
  email: string
  name: string
  createdAt: Zeit
}

class UserRepository extends BaseRepository<User, UserId> {
  constructor(db: Database) {
    super(db.getConnection(), "users")
  }

  mapRow(row: unknown): User {
    const r = row as Record<string, unknown>
    const userTimezone = r.timezone as string
    const zeitFactory = Zeit.withUserZone(userTimezone)

    return {
      id: UserId.fromString(r.id as string),
      email: r.email as string,
      name: r.name as string,
      createdAt: zeitFactory.fromDatabase(r.created_at as number),
    }
  }

  saveUser(user: User) {
    const query = Query.create(
      `INSERT INTO users (id, email, name, created_at, timezone)
       VALUES (:id, :email, :name, :createdAt, :timezone)`,
      {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toDatabase(),
        timezone: user.createdAt.getTimezone(),
      }
    )

    if (query.isError) {
      return query
    }

    return this.insert(query.value)
  }
}

// Example usage
async function main() {
  // Initialize database
  const dbResult = await Database.getInstance(":memory:")
  if (dbResult.isError) {
    console.error("Failed to initialize database")
    return
  }

  const db = dbResult.value

  // Create table
  db.getConnection().exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      timezone TEXT NOT NULL
    )
  `)

  const userRepo = new UserRepository(db)

  // Create a user with type-safe UserId
  const userId = UserId.create()
  const userTimezone = Timezone.Europe.Berlin
  const zeitFactory = Zeit.withUserZone(userTimezone)

  const user: User = {
    id: userId,
    email: "alice@example.com",
    name: "Alice",
    createdAt: zeitFactory.now(),
  }

  const saveResult = userRepo.saveUser(user)
  if (saveResult.isError) {
    console.error("Failed to save user:", saveResult.error)
  } else {
    console.log(`✓ User saved with ID: ${user.id.toString()}`)
  }

  // Find user by ID (type-safe)
  const findResult = userRepo.findById(userId)
  if (!findResult.isError && findResult.value) {
    console.log(`✓ Found user: ${findResult.value.name}`)
    console.log(`  Created at (user timezone): ${findResult.value.createdAt.toUser()}`)
  }

  // Parse existing ID from string
  const existingId = UserId.fromString(userId.toString())
  console.log(`✓ Parsed existing ID: ${existingId.toString()}`)

  db.close()
}

main()
