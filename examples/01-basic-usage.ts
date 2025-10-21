/**
 * Example 1: Basic Usage of @dnl-fm/bun-sqlite
 * Demonstrates core features: Database, Query, and Repository patterns
 */

import { Database, Query, BaseRepository } from "../src/index.ts"

// ============================================================================
// STEP 1: Create a simple entity
// ============================================================================

interface User {
  id: string
  email: string
  name: string
  createdAt: number
}

// ============================================================================
// STEP 2: Create a repository for the entity
// ============================================================================

class UserRepository extends BaseRepository<User, string> {
  constructor(db: Database) {
    super(db.getConnection(), "users")
  }

  /**
   * Implement required mapRow method to convert DB rows to entities
   */
  mapRow(row: unknown): User {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      email: r.email as string,
      name: r.name as string,
      createdAt: r.created_at as number,
    }
  }

  /**
   * Custom business methods
   */
  findByEmail(email: string) {
    const query = Query.create(
      "SELECT * FROM users WHERE email = :email",
      { email }
    )

    if (query.isError) {
      return query
    }

    return this.findOneByQuery(query.value)
  }

  saveUser(user: User) {
    const query = Query.create(
      `INSERT INTO users (id, email, name, created_at)
       VALUES (:id, :email, :name, :createdAt)`,
      {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      }
    )

    if (query.isError) {
      return query
    }

    return this.insert(query.value)
  }
}

// ============================================================================
// STEP 3: Use the database and repository
// ============================================================================

async function main() {
  // Create database
  const dbResult = await Database.getInstance(":memory:")

  if (dbResult.isError) {
    console.error("Failed to initialize database:", dbResult.error)
    return
  }

  const db = dbResult.value

  // Initialize schema
  db.getConnection().exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)

  // Create repository
  const userRepo = new UserRepository(db)

  // ========================================================================
  // Using Query value objects with named placeholders
  // ========================================================================

  // Create a user using Query value object
  const user: User = {
    id: "user-1",
    email: "alice@example.com",
    name: "Alice",
    createdAt: Date.now(),
  }

  const saveResult = userRepo.saveUser(user)
  if (saveResult.isError) {
    console.error("Failed to save user:", saveResult.error)
  } else {
    console.log("✓ User saved successfully")
  }

  // ========================================================================
  // Find user by ID
  // ========================================================================

  const findResult = userRepo.findById("user-1")
  if (!findResult.isError && findResult.value) {
    console.log("✓ Found user:", findResult.value.name)
  }

  // ========================================================================
  // Find user by email (custom method using Query)
  // ========================================================================

  const emailResult = userRepo.findByEmail("alice@example.com")
  if (!emailResult.isError && emailResult.value) {
    console.log("✓ Found by email:", emailResult.value.email)
  }

  // ========================================================================
  // Find all users
  // ========================================================================

  const allResult = userRepo.findAll()
  if (!allResult.isError) {
    console.log(`✓ Total users: ${allResult.value.length}`)
  }

  // ========================================================================
  // Update using Query with named placeholders
  // ========================================================================

  const updateQuery = Query.create(
    "UPDATE users SET name = :name WHERE id = :id",
    { name: "Alice Smith", id: "user-1" }
  )

  if (!updateQuery.isError) {
    const updateResult = userRepo.update(updateQuery.value)
    if (!updateResult.isError && updateResult.value > 0) {
      console.log("✓ User updated successfully")
    }
  }

  // ========================================================================
  // Delete using Query
  // ========================================================================

  // First create another user to delete
  const deleteUser: User = {
    id: "user-2",
    email: "bob@example.com",
    name: "Bob",
    createdAt: Date.now(),
  }
  userRepo.saveUser(deleteUser)

  const deleteQuery = Query.create(
    "DELETE FROM users WHERE id = :id",
    { id: "user-2" }
  )

  if (!deleteQuery.isError) {
    const deleteResult = userRepo.delete(deleteQuery.value)
    if (!deleteResult.isError && deleteResult.value > 0) {
      console.log("✓ User deleted successfully")
    }
  }

  // ========================================================================
  // Count users
  // ========================================================================

  const countResult = userRepo.count()
  if (!countResult.isError) {
    console.log(`✓ Total users after delete: ${countResult.value}`)
  }

  // ========================================================================
  // Query using complex WHERE clause
  // ========================================================================

  const complexQuery = Query.create(
    "SELECT * FROM users WHERE name LIKE :pattern",
    { pattern: "%Smith%" }
  )

  if (!complexQuery.isError) {
    const result = userRepo.findByQuery(complexQuery.value)
    if (!result.isError) {
      console.log(`✓ Found ${result.value.length} users matching pattern`)
    }
  }

  // ========================================================================
  // Error handling: missing parameter
  // ========================================================================

  const invalidQuery = Query.create(
    "SELECT * FROM users WHERE email = :email AND status = :status",
    { email: "test@example.com" } // Missing :status parameter
  )

  if (invalidQuery.isError) {
    console.log("✓ Caught validation error:", invalidQuery.error)
  }

  // ========================================================================
  // Error handling: extra parameter
  // ========================================================================

  const extraParamQuery = Query.create(
    "SELECT * FROM users WHERE email = :email",
    { email: "test@example.com", unused: "param" }
  )

  if (extraParamQuery.isError) {
    console.log("✓ Caught extra param error:", extraParamQuery.error)
  }

  // Close database
  db.close()
  console.log("\n✓ Example completed successfully!")
}

// Run example
main().catch(console.error)
