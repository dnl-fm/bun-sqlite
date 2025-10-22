#!/usr/bin/env bun
/**
 * Migration CLI for bun-sqlite
 *
 * Usage:
 *   bun migrate.ts                         # Run pending migrations
 *   bun migrate.ts status                  # Show migration status
 *   bun migrate.ts generate <name>         # Generate new migration file
 *   bun migrate.ts down                    # Rollback the last applied migration
 *   bun migrate.ts down <version>          # Rollback a specific migration
 *   bun migrate.ts --help                  # Show this help message
 *
 * Environment variables:
 *   DATABASE_URL              - Path to application database (default: ./data.db)
 *   MIGRATIONS_DIR            - Path to migrations directory (default: ./migrations)
 *   MIGRATIONS_DB_PATH        - Path to migrations tracking database (default: ./.migrations.db)
 */

import { mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join } from "node:path"

import type { MigrationRunner as MigrationRunnerType } from "../src/index.ts"
import { Database, MigrationRunner, loadMigrations } from "../src/index.ts"

const args = process.argv.slice(2)
const command = args[0] || "migrate"

const databaseUrl = process.env.DATABASE_URL || "./data.db"
const migrationsDir = process.env.MIGRATIONS_DIR || "./migrations"
const migrationsDbPath = process.env.MIGRATIONS_DB_PATH || "./.migrations.db"

async function main() {
  // Handle generate command (doesn't need database)
  if (command === "generate") {
    const migrationName = args[1]
    if (!migrationName) {
      console.error("❌ Migration name required")
      console.log("Usage: bun migrate.ts generate <migration_name>")
      console.log("Example: bun migrate.ts generate create_users")
      process.exit(1)
    }
    await handleGenerate(migrationName, migrationsDir)
    return
  }

  // Handle help command
  if (command === "--help" || command === "-h" || command === "help") {
    showHelp()
    return
  }

  let db: Awaited<ReturnType<typeof Database.getInstance>>["value"] | null = null
  let runner: MigrationRunnerType | null = null
  let hasError = false

  try {
    // Initialize application database
    const dbResult = await Database.getInstance(databaseUrl)
    if (dbResult.isError) {
      console.error("❌ Failed to initialize database:", dbResult.error)
      hasError = true
      return
    }
    db = dbResult.value

    // Load migrations from directory
    const migrationsResult = await loadMigrations(migrationsDir)
    if (migrationsResult.isError) {
      console.error("❌ Failed to load migrations:", migrationsResult.error)
      hasError = true
      return
    }

    // Create migration runner
    runner = new MigrationRunner(
      db.getConnection(),
      migrationsResult.value,
      { migrationsDbPath }
    )

    // Handle commands
    if (command === "status") {
      await handleStatus(runner)
    } else if (command === "down") {
      const version = args[1]
      if (version) {
        await handleRollbackSpecific(runner, version)
      } else {
        await handleRollbackLast(runner)
      }
    } else if (command === "migrate" || command === "") {
      await handleMigrate(runner)
    } else {
      console.error(`❌ Unknown command: ${command}`)
      console.log("Run 'bun migrate.ts --help' for usage information")
      hasError = true
      return
    }
  } catch (error) {
    console.error("❌ Migration error:", error)
    hasError = true
  } finally {
    if (runner) {
      runner.close()
    }
    if (db) {
      db.close()
    }
    if (hasError) {
      process.exit(1)
    }
  }
}

/**
 * Generate a new migration file
 */
async function handleGenerate(name: string, migrationsDir: string) {
  // Validate migration name
  const validNamePattern = /^[a-z0-9_]+$/
  if (!validNamePattern.test(name)) {
    console.error("❌ Invalid migration name")
    console.log("Migration names must contain only lowercase letters, numbers, and underscores")
    console.log("Example: create_users, add_posts_table, update_user_email")
    process.exit(1)
  }

  // Generate ISO timestamp
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const hours = String(now.getHours()).padStart(2, "0")
  const minutes = String(now.getMinutes()).padStart(2, "0")
  const seconds = String(now.getSeconds()).padStart(2, "0")
  const timestamp = `${year}${month}${day}T${hours}${minutes}${seconds}`
  const fileName = `${timestamp}_${name}.ts`

  try {
    // Create migrations directory if it doesn't exist
    if (!existsSync(migrationsDir)) {
      await mkdir(migrationsDir, { recursive: true })
      console.log(`✓ Created migrations directory: ${migrationsDir}`)
    }

    const filePath = join(migrationsDir, fileName)

    // Check if file already exists
    if (existsSync(filePath)) {
      console.error("❌ Migration file already exists:", filePath)
      process.exit(1)
    }

    // Create migration template
    const template = `import type { DatabaseConnection } from "@dnl-fm/bun-sqlite"

/**
 * Migration: ${name}
 * Generated: ${new Date().toISOString()}
 */

export async function up(db: DatabaseConnection): Promise<void> {
  // Add your migration logic here
  // Example: db.exec(\`CREATE TABLE ...\`)
}

export async function down(db: DatabaseConnection): Promise<void> {
  // Add your rollback logic here
  // Example: db.exec(\`DROP TABLE ...\`)
}
`

    // Write migration file
    await Bun.write(filePath, template)

    console.log(`✅ Migration created: ${fileName}`)
    console.log(`   Path: ${filePath}`)
    console.log(`   Next: Edit the file to add your migration logic`)
  } catch (error) {
    console.error("❌ Failed to generate migration:", error)
    process.exit(1)
  }
}

/**
 * Run pending migrations
 */
async function handleMigrate(runner: MigrationRunnerType) {
  console.log("🔄 Running migrations...")

  const result = await runner.migrate()
  if (result.isError) {
    console.error("❌ Migration failed:", result.error)
    process.exit(1)
  }

  const count = result.value
  if (count === 0) {
    console.log("✅ No pending migrations")
  } else {
    console.log(`✅ Successfully applied ${count} migration${count === 1 ? "" : "s"}`)
  }
}

/**
 * Rollback the last applied migration
 */
async function handleRollbackLast(runner: MigrationRunnerType) {
  console.log("↩️  Rolling back the last applied migration...")

  const result = await runner.rollbackLast()
  if (result.isError) {
    console.error("❌ Rollback failed:", result.error)
    process.exit(1)
  }

  const count = result.value
  if (count === 0) {
    console.log("✅ No applied migrations to rollback")
  } else {
    console.log(`✅ Successfully rolled back 1 migration`)
  }
}

/**
 * Rollback a specific migration by version
 */
async function handleRollbackSpecific(runner: MigrationRunnerType, version: string) {
  console.log(`↩️  Rolling back migration: ${version}`)

  const result = await runner.rollback(version)
  if (result.isError) {
    console.error("❌ Rollback failed:", result.error)
    process.exit(1)
  }

  console.log(`✅ Successfully rolled back migration: ${version}`)
}

/**
 * Show migration status
 */
async function handleStatus(runner: MigrationRunnerType) {
  const statusResult = await runner.status()
  if (statusResult.isError) {
    console.error("❌ Failed to get status:", statusResult.error)
    process.exit(1)
  }

  const status = statusResult.value
  console.log("\n📊 Migration Status")
  console.log("━".repeat(40))

  if (status.applied.length === 0) {
    console.log("Applied:   0 migrations")
  } else {
    console.log(`Applied:   ${status.applied.length} migration${status.applied.length === 1 ? "" : "s"}`)
    status.applied.forEach((version) => {
      console.log(`  ✓ ${version}`)
    })
  }

  if (status.pending.length === 0) {
    console.log("Pending:   0 migrations")
  } else {
    console.log(`Pending:   ${status.pending.length} migration${status.pending.length === 1 ? "" : "s"}`)
    status.pending.forEach((version) => {
      console.log(`  ⏳ ${version}`)
    })
  }

  console.log(`${"━".repeat(40)}\n`)
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Migration CLI for bun-sqlite

Commands:
  bun migrate.ts                         Run pending migrations
  bun migrate.ts status                  Show migration status
  bun migrate.ts generate <name>         Generate new migration file
  bun migrate.ts down                    Rollback the last applied migration
  bun migrate.ts down <version>          Rollback a specific migration by version
  bun migrate.ts --help                  Show this message

Environment Variables:
  DATABASE_URL               Path to application database (default: ./data.db)
  MIGRATIONS_DIR             Path to migrations directory (default: ./migrations)
  MIGRATIONS_DB_PATH         Path to migrations tracking database (default: ./.migrations.db)

Examples:
  # Generate a new migration
  bun migrate.ts generate create_users
  bun migrate.ts generate add_posts_table

  # Run migrations
  bun migrate.ts
  DATABASE_URL=./db/app.db bun migrate.ts

  # Check status
  MIGRATIONS_DIR=./db/migrations bun migrate.ts status

  # Rollback migrations
  bun migrate.ts down
  bun migrate.ts down 20251022T143045_create_users
  `)
}

// Run main function
main()
