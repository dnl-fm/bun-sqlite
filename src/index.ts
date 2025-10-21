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
export { MigrationRunner } from "./migrations/migration-runner.ts"
export type { MigrationModule } from "./migrations/migration-runner.ts"

// Type exports
export type {
  Result,
  SQLitePragma,
  QueryResult,
  PreparedStatement,
  RunResult,
  Migration,
  AppliedMigration,
  MigrationRunnerOptions,
  EntityId,
  RowMapper,
} from "./types.ts"
