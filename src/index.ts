/**
 * @dnl-fm/bun-sqlite
 * SQLite abstraction for Bun with migrations, named placeholders, and type-safe repositories
 */

// Core exports
export { Database } from "./core/database.ts"
export { DatabaseConfig, DEFAULT_PRAGMAS } from "./core/database-config.ts"
export type { DatabaseConnection } from "./types.ts"

// Query exports
export { Query } from "./query/query.ts"

// Repository exports
export { BaseRepository } from "./repository/base-repository.ts"

// Migration exports
export { MigrationRunner, loadMigrations } from "./migrations/index.ts"
export {
  MigrationFileInfo,
  MigrationValidator,
  MigrationCollisionDetector,
  MigrationLoader,
  MigrationsDatabaseManager,
} from "./migrations/index.ts"
export type { MigrationModule, MigrationRunnerOptions } from "./migrations/index.ts"

// ID exports
export { Ulid, NanoId } from "./id/index.ts"
export type { Id, IdGenerationOptions } from "./id/index.ts"

// Zeit exports
export { Zeit, ZeitFactory, Period } from "./zeit/index.ts"
export type { BillingInterval, CycleOptions, Duration, IPeriod } from "./zeit/index.ts"
export { Timezone } from "./zeit/index.ts"

// Type exports
export type {
  Result,
  SQLitePragma,
  QueryResult,
  PreparedStatement,
  RunResult,
  Migration,
  AppliedMigration,
  EntityId,
  RowMapper,
} from "./types.ts"
