/**
 * Example 2: Database Migrations
 * Demonstrates migration tracking and versioning for schema changes
 */

import { Database, MigrationRunner } from "../src/index.ts"

// ============================================================================
// STEP 1: Define migrations
// ============================================================================

const migrations = {
  "001_create_users_table": {
    up: (db) => {
      db.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `)
    },
    down: (db) => {
      db.exec("DROP TABLE IF EXISTS users")
    },
  },

  "002_create_posts_table": {
    up: (db) => {
      db.exec(`
        CREATE TABLE posts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `)
    },
    down: (db) => {
      db.exec("DROP TABLE IF EXISTS posts")
    },
  },

  "003_add_tags_table": {
    up: (db) => {
      db.exec(`
        CREATE TABLE tags (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL
        )
      `)

      db.exec(`
        CREATE TABLE post_tags (
          post_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          PRIMARY KEY (post_id, tag_id),
          FOREIGN KEY (post_id) REFERENCES posts(id),
          FOREIGN KEY (tag_id) REFERENCES tags(id)
        )
      `)
    },
    down: (db) => {
      db.exec("DROP TABLE IF EXISTS post_tags")
      db.exec("DROP TABLE IF EXISTS tags")
    },
  },
}

// ============================================================================
// STEP 2: Run migrations
// ============================================================================

async function main() {
  // Create database
  const dbResult = await Database.getInstance(":memory:")

  if (dbResult.isError) {
    console.error("Failed to initialize database:", dbResult.error)
    return
  }

  const db = dbResult.value

  // Create migration runner
  const runner = new MigrationRunner(db.getConnection(), migrations)

  // ========================================================================
  // Initialize migration tracking
  // ========================================================================

  console.log("Initializing migration system...")
  const initResult = await runner.initialize()
  if (initResult.isError) {
    console.error("Failed to initialize:", initResult.error)
    return
  }
  console.log("✓ Migration system initialized\n")

  // ========================================================================
  // Check migration status before running
  // ========================================================================

  let statusResult = await runner.status()
  if (!statusResult.isError) {
    console.log("Status before migration:")
    console.log(`  Applied: ${statusResult.value.applied.length}`)
    console.log(`  Pending: ${statusResult.value.pending.length}\n`)
  }

  // ========================================================================
  // Run all pending migrations
  // ========================================================================

  console.log("Running migrations...")
  const migrateResult = await runner.migrate()

  if (migrateResult.isError) {
    console.error("Failed to run migrations:", migrateResult.error)
    return
  }

  console.log(`✓ ${migrateResult.value} migration(s) applied\n`)

  // ========================================================================
  // Check status after migrations
  // ========================================================================

  statusResult = await runner.status()
  if (!statusResult.isError) {
    console.log("Status after migration:")
    console.log(`  Applied: ${statusResult.value.applied.map((v) => `"${v}"`).join(", ")}`)
    console.log(`  Pending: ${statusResult.value.pending.length}\n`)
  }

  // ========================================================================
  // Verify tables were created
  // ========================================================================

  const tables = db
    .getConnection()
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_migrations'`
    )
    .all() as { name: string }[]

  console.log("✓ Database schema created:")
  tables.forEach((table) => {
    console.log(`  - ${table.name}`)
  })

  // ========================================================================
  // Running migrations again should be no-op
  // ========================================================================

  console.log("\nRunning migrations again (should be no-op)...")
  const secondMigrateResult = await runner.migrate()

  if (!secondMigrateResult.isError) {
    console.log(`✓ ${secondMigrateResult.value} migration(s) applied (expected: 0)`)
  }

  // Close database
  db.close()
  console.log("\n✓ Migration example completed successfully!")
}

// Run example
main().catch(console.error)
