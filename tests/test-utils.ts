/**
 * Test utilities and fixtures
 * Shared helpers for all tests
 */

import { Database } from "../src/core/database.ts"
import { DatabaseConfig } from "../src/core/database-config.ts"
import type { DatabaseConnection } from "../src/types.ts"

/**
 * Create an in-memory test database
 * Uses minimal pragmas for speed
 */
export async function createTestDatabase(): Promise<Database> {
  const config = DatabaseConfig.minimal()
  const result = await Database.getInstance(":memory:", config)

  if (result.isError) {
    throw new Error(`Failed to create test database: ${result.error}`)
  }

  return result.value
}

/**
 * Initialize a test database with schema
 * @param db Database instance
 * @param schema SQL schema to execute
 */
export function initializeTestSchema(db: Database, schema: string): void {
  const connection = db.getConnection()
  connection.exec(schema)
}

/**
 * Reset a test database (clear all tables)
 * @param db Database instance
 * @param tables List of table names to clear
 */
export async function resetTestDatabase(
  db: Database,
  tables: string[]
): Promise<void> {
  const connection = db.getConnection()

  for (const table of tables) {
    try {
      connection.exec(`DELETE FROM ${table}`)
    } catch (_error) {
      // Table may not exist, ignore
    }
  }
}

/**
 * Clean up test database
 * @param db Database instance
 */
export function cleanupTestDatabase(db: Database): void {
  db.close()
  Database.reset()
}

/**
 * Create a test row object
 * Useful for factories in tests
 */
export function createTestRow(
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  return {
    id: "test-id",
    name: "Test Name",
    email: "test@example.com",
    createdAt: Date.now(),
    ...overrides,
  }
}

/**
 * Assertion helper: Assert result is not an error
 */
export function assertSuccess<T>(
  result: { isError: false; value: T } | { isError: true; error: string }
): T {
  if (result.isError) {
    throw new Error(`Expected success but got error: ${result.error}`)
  }
  return result.value
}

/**
 * Assertion helper: Assert result is an error
 */
export function assertError(
  result: { isError: false; value: unknown } | { isError: true; error: string }
): string {
  if (!result.isError) {
    throw new Error("Expected error but got success")
  }
  return result.error
}

/**
 * Test schema for User table
 */
export const USER_TEST_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at INTEGER NOT NULL
  )
`

/**
 * Test schema for Posts table
 */
export const POST_TEST_SCHEMA = `
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`

/**
 * Combined test schema with users and posts
 */
export const COMBINED_TEST_SCHEMA = `
  ${USER_TEST_SCHEMA};
  ${POST_TEST_SCHEMA};
`

/**
 * Test database setup helper
 * Creates database with specified schema
 */
export async function setupTestDb(schema: string): Promise<Database> {
  const db = await createTestDatabase()
  initializeTestSchema(db, schema)
  return db
}

/**
 * Test database teardown helper
 * Cleans up resources
 */
export async function teardownTestDb(db: Database): Promise<void> {
  cleanupTestDatabase(db)
}

/**
 * Fixture: Create test user row
 */
export function createTestUser(
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  return {
    id: "user-123",
    email: "alice@example.com",
    name: "Alice Smith",
    status: "active",
    created_at: Date.now(),
    ...overrides,
  }
}

/**
 * Fixture: Create test post row
 */
export function createTestPost(
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  return {
    id: "post-123",
    user_id: "user-123",
    title: "Test Post",
    content: "Test content",
    created_at: Date.now(),
    ...overrides,
  }
}

/**
 * Helper: Insert test user directly
 */
export function insertTestUser(
  connection: DatabaseConnection,
  user: Record<string, unknown> = {}
): void {
  const testUser = createTestUser(user)
  const stmt = connection.prepare(
    `INSERT INTO users (id, email, name, status, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
  stmt.run(
    testUser.id,
    testUser.email,
    testUser.name,
    testUser.status,
    testUser.created_at
  )
}

/**
 * Helper: Insert multiple test users
 */
export function insertTestUsers(
  connection: DatabaseConnection,
  count: number = 3
): void {
  for (let i = 1; i <= count; i++) {
    insertTestUser(connection, {
      id: `user-${i}`,
      email: `user${i}@example.com`,
      name: `User ${i}`,
    })
  }
}

/**
 * Helper: Get user count from database
 */
export function getUserCount(connection: DatabaseConnection): number {
  const stmt = connection.prepare("SELECT COUNT(*) as count FROM users")
  const result = stmt.get() as { count: number } | undefined
  return result?.count ?? 0
}
