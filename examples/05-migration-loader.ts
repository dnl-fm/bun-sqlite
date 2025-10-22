/**
 * Migration Loader Example
 *
 * Demonstrates the complete migration discovery and execution system:
 * - Automatically discovers migrations from a directory
 * - Validates migration files (timestamp format, structure)
 * - Detects collision (duplicate timestamps)
 * - Tracks applied migrations in a separate .migrations.db file
 * - Executes migrations in timestamp order
 *
 * Migration File Format:
 * - Filename: YYYYMMDDTHHMMSS_description.ts
 * - Example: 20251022T143045_create_users.ts
 * - Description: lowercase alphanumeric and underscores only
 */

import { Database, MigrationRunner, loadMigrations } from "../src/index.ts"

// Migration module example
const exampleMigration = {
  up: (db: any) => {
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)
  },
  down: (db: any) => {
    db.exec("DROP TABLE IF EXISTS users")
  },
}

async function main() {
  console.log("Migration Loader Example")
  console.log("=======================\n")

  // Step 1: Initialize application database
  console.log("1. Initializing application database...")
  const dbResult = await Database.getInstance("./example-app.db")
  if (dbResult.isError) {
    console.error("Failed to initialize database:", dbResult.error)
    process.exit(1)
  }
  const db = dbResult.value
  const connection = db.getConnection()
  console.log("   ✓ Database initialized\n")

  // Step 2: Load migrations from directory
  console.log("2. Loading migrations from ./migrations directory...")
  const migrationsResult = await loadMigrations("./migrations")

  if (migrationsResult.isError) {
    console.error("Failed to load migrations:", migrationsResult.error)
    connection.close()
    db.close()
    process.exit(1)
  }

  const migrations = migrationsResult.value
  const versions = Object.keys(migrations).sort()

  console.log(`   ✓ Loaded ${versions.length} migration(s)`)
  if (versions.length > 0) {
    versions.forEach((v, i) => {
      console.log(`     ${i + 1}. ${v}`)
    })
  }
  console.log()

  // Step 3: Initialize migration runner
  console.log("3. Initializing migration runner...")
  const runner = new MigrationRunner(connection, migrations, {
    migrationsDbPath: "./.migrations.db",
  })

  const initResult = await runner.initialize()
  if (initResult.isError) {
    console.error("Failed to initialize runner:", initResult.error)
    connection.close()
    db.close()
    process.exit(1)
  }
  console.log("   ✓ Runner initialized\n")

  // Step 4: Check migration status
  console.log("4. Checking migration status...")
  const statusResult = await runner.status()

  if (statusResult.isError) {
    console.error("Failed to get status:", statusResult.error)
    connection.close()
    db.close()
    runner.close()
    process.exit(1)
  }

  const { applied, pending } = statusResult.value
  console.log(`   Applied: ${applied.length}`)
  applied.forEach(v => console.log(`     - ${v}`))
  console.log(`   Pending: ${pending.length}`)
  pending.forEach(v => console.log(`     - ${v}`))
  console.log()

  // Step 5: Run migrations
  console.log("5. Running pending migrations...")
  const migrateResult = await runner.migrate()

  if (migrateResult.isError) {
    console.error("Failed to run migrations:", migrateResult.error)
    connection.close()
    db.close()
    runner.close()
    process.exit(1)
  }

  const count = migrateResult.value
  console.log(`   ✓ Executed ${count} migration(s)\n`)

  // Step 6: Verify final status
  console.log("6. Verifying final status...")
  const finalStatusResult = await runner.status()

  if (finalStatusResult.isError) {
    console.error("Failed to get final status:", finalStatusResult.error)
    connection.close()
    db.close()
    runner.close()
    process.exit(1)
  }

  const finalStatus = finalStatusResult.value
  console.log(`   Applied: ${finalStatus.applied.length}`)
  finalStatus.applied.forEach(v => console.log(`     - ${v}`))
  console.log(`   Pending: ${finalStatus.pending.length}\n`)

  // Cleanup
  console.log("7. Cleaning up...")
  runner.close()
  connection.close()
  db.close()
  console.log("   ✓ Resources closed\n")

  console.log("Migration workflow completed successfully!")
}

main().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})
