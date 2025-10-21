/**
 * Example 1: Basic Usage of @dnl-fm/bun-sqlite
 * Demonstrates core features: Database, Query, Repository patterns, and Zeit timezone handling
 */

import {
  Database,
  Query,
  BaseRepository,
  Zeit,
  Timezone,
  Ulid,
} from "../src/index.ts";
import { UserId } from "./value-objects.ts";

// ============================================================================
// STEP 1: Create a simple entity
// ============================================================================

interface User {
  id: UserId; // Type-safe UserId value object
  email: string;
  name: string;
  createdAt: Zeit; // Complex value object with full timezone awareness
}

// ============================================================================
// STEP 2: Create a repository for the entity
// ============================================================================

class UserRepository extends BaseRepository<User, UserId> {
  constructor(db: Database) {
    super(db.getConnection(), "users");
  }

  /**
   * Implement required mapRow method to convert DB rows to entities
   */
  mapRow(row: unknown): User {
    const r = row as Record<string, unknown>;
    // Reconstruct Zeit from stored UTC timestamp and timezone metadata
    const userTimezone = r.timezone as string;
    const zeitFactory = Zeit.withUserZone(userTimezone);

    return {
      id: UserId.fromString(r.id as string),
      email: r.email as string,
      name: r.name as string,
      createdAt: zeitFactory.fromDatabase(r.created_at as number),
    };
  }

  /**
   * Custom business methods
   */
  findByEmail(email: string) {
    const query = Query.create("SELECT * FROM users WHERE email = :email", {
      email,
    });

    if (query.isError) {
      return query;
    }

    return this.findOneByQuery(query.value);
  }

  saveUser(user: User) {
    const query = Query.create(
      `INSERT INTO users (id, email, name, created_at, timezone)
       VALUES (:id, :email, :name, :createdAt, :timezone)`,
      {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toDatabase(), // Extract UTC timestamp from Zeit
        timezone: user.createdAt.getTimezone(), // Extract timezone from Zeit
      },
    );

    if (query.isError) {
      return query;
    }

    return this.insert(query.value);
  }
}

// ============================================================================
// STEP 3: Use the database and repository
// ============================================================================

async function main() {
  // Create database
  const dbResult = await Database.getInstance(":memory:");

  if (dbResult.isError) {
    console.error("Failed to initialize database:", dbResult.error);
    return;
  }

  const db = dbResult.value;

  // Initialize schema
  db.getConnection().exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      timezone TEXT NOT NULL
    )
  `);

  // Create repository
  const userRepo = new UserRepository(db);

  // ========================================================================
  // Using Query value objects with named placeholders
  // ========================================================================

  // Create a user using Query value object
  // Generate a type-safe user ID using the UserId value object
  const userId = UserId.create();

  // Create timezone-aware timestamp for user creation (Berlin timezone)
  // Note: Timezone now supports dot-chain access: Timezone.Europe.Berlin
  const userTimezone = Timezone.Europe.Berlin;
  const zeitFactory = Zeit.withUserZone(userTimezone);
  const createdAt = zeitFactory.now();

  const user: User = {
    id: userId,
    email: "alice@example.com",
    name: "Alice",
    createdAt, // Store as Zeit object - contains all timezone context
  };

  const saveResult = userRepo.saveUser(user);
  if (saveResult.isError) {
    console.error("Failed to save user:", saveResult.error);
  } else {
    console.log("✓ User saved successfully");
  }

  // ========================================================================
  // Find user by ID
  // ========================================================================

  const findResult = userRepo.findById(userId);
  if (!findResult.isError && findResult.value) {
    const foundUser = findResult.value;
    console.log("✓ Found user:", foundUser.name);

    // Time value objects provide full comparison power
    console.log(`  Created: ${foundUser.createdAt.toUser()}`);
    console.log(`  Timezone: ${foundUser.createdAt.getTimezone()}`);

    // Can compare Zeit instances directly
    const nowFactory = Zeit.withUserZone(foundUser.createdAt.getTimezone());
    const now = nowFactory.now();
    if (foundUser.createdAt.isBefore(now)) {
      const ageInMillis = now.diff(foundUser.createdAt);
      const ageInDays = Math.floor(ageInMillis / (24 * 60 * 60 * 1000));
      console.log(`  Account age: ${ageInDays} days`);
    }
  }

  // ========================================================================
  // Find user by email (custom method using Query)
  // ========================================================================

  const emailResult = userRepo.findByEmail("alice@example.com");
  if (!emailResult.isError && emailResult.value) {
    console.log("✓ Found by email:", emailResult.value.email);
  }

  // ========================================================================
  // Find all users
  // ========================================================================

  const allResult = userRepo.findAll();
  if (!allResult.isError) {
    console.log(`✓ Total users: ${allResult.value.length}`);
  }

  // ========================================================================
  // Update using Query with named placeholders
  // ========================================================================

  const updateQuery = Query.create(
    "UPDATE users SET name = :name WHERE id = :id",
    { name: "Alice Smith", id: userId },
  );

  if (!updateQuery.isError) {
    const updateResult = userRepo.update(updateQuery.value);
    if (!updateResult.isError && updateResult.value > 0) {
      console.log("✓ User updated successfully");
    }
  }

  // ========================================================================
  // Delete using Query
  // ========================================================================

  // First create another user to delete (with different timezone)
  const bobTimezone = Timezone.America.New_York;
  const bobFactory = Zeit.withUserZone(bobTimezone);
  const deleteUser: User = {
    id: Ulid.create({ prefix: "user_" }).toString(),
    email: "bob@example.com",
    name: "Bob",
    createdAt: bobFactory.now(),
  };
  userRepo.saveUser(deleteUser);

  const deleteQuery = Query.create("DELETE FROM users WHERE id = :id", {
    id: deleteUser.id,
  });

  if (!deleteQuery.isError) {
    const deleteResult = userRepo.delete(deleteQuery.value);
    if (!deleteResult.isError && deleteResult.value > 0) {
      console.log("✓ User deleted successfully");
    }
  }

  // ========================================================================
  // Count users
  // ========================================================================

  const countResult = userRepo.count();
  if (!countResult.isError) {
    console.log(`✓ Total users after delete: ${countResult.value}`);
  }

  // ========================================================================
  // Query using complex WHERE clause
  // ========================================================================

  const complexQuery = Query.create(
    "SELECT * FROM users WHERE name LIKE :pattern",
    { pattern: "%Smith%" },
  );

  if (!complexQuery.isError) {
    const result = userRepo.findByQuery(complexQuery.value);
    if (!result.isError) {
      console.log(`✓ Found ${result.value.length} users matching pattern`);
    }
  }

  // ========================================================================
  // Error handling: missing parameter
  // ========================================================================

  const invalidQuery = Query.create(
    "SELECT * FROM users WHERE email = :email AND status = :status",
    { email: "test@example.com" }, // Missing :status parameter
  );

  if (invalidQuery.isError) {
    console.log("✓ Caught validation error:", invalidQuery.error);
  }

  // ========================================================================
  // Error handling: extra parameter
  // ========================================================================

  const extraParamQuery = Query.create(
    "SELECT * FROM users WHERE email = :email",
    { email: "test@example.com", unused: "param" },
  );

  if (extraParamQuery.isError) {
    console.log("✓ Caught extra param error:", extraParamQuery.error);
  }

  // Close database
  db.close();
  console.log("\n✓ Example completed successfully!");
}

// Run example
main().catch(console.error);
