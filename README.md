# @dnl-fm/bun-sqlite

A modern SQLite abstraction layer for Bun with type-safe repositories, named placeholder queries, and built-in migration support. Designed for performance and developer experience.

## Features

✅ **Named Placeholder Queries** - Type-safe query builder with `:paramName` syntax
✅ **Type-Safe Repositories** - Generic `BaseRepository` with full CRUD operations
✅ **ID Generation** - ULID (time-sortable) and NanoID support with prefixes
✅ **Migration System** - Track and manage database schema changes
✅ **Singleton Pattern** - Efficient database connection management
✅ **Result Pattern** - No exceptions, all operations return Result types
✅ **Pragma Configuration** - Pre-configured for WAL mode, optimal sync settings
✅ **Zero Dependencies** - Uses Bun's native SQLite
✅ **TypeScript Strict Mode** - Full TypeScript 5.9+ support
✅ **BiomeJS Linting** - Code quality and formatting enforced
✅ **Comprehensive JSDoc** - Full type documentation
✅ **90%+ Test Coverage** - Thoroughly tested

## Installation

```bash
# With Bun (recommended)
bun add @dnl-fm/bun-sqlite

# With npm
npm install @dnl-fm/bun-sqlite

# With yarn
yarn add @dnl-fm/bun-sqlite
```

## Quick Start

```typescript
import { Database, Query, BaseRepository } from "@dnl-fm/bun-sqlite"

// Initialize database
const result = await Database.getInstance("./data.db")
if (result.isError) {
  console.error("Failed to initialize database:", result.error)
  process.exit(1)
}
const db = result.value

// Create tables
db.getConnection().exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
  )
`)

// Type-safe repository
interface User {
  id: string
  email: string
  name: string
}

class UserRepository extends BaseRepository<User, string> {
  mapRow(row: unknown): User {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      email: r.email as string,
      name: r.name as string,
    }
  }
}

const userRepo = new UserRepository(db.getConnection(), "users")

// Create with named placeholders
const insertQuery = Query.create(
  "INSERT INTO users (id, email, name) VALUES (:id, :email, :name)",
  {
    id: "user-1",
    email: "alice@example.com",
    name: "Alice",
  }
)

if (!insertQuery.isError) {
  const insertResult = userRepo.insert(insertQuery.value)
  console.log(`✓ Inserted user (${insertResult.value} rows)`)
}

// Read
const findResult = userRepo.findById("user-1")
if (!findResult.isError && findResult.value) {
  console.log(`✓ Found user: ${findResult.value.name}`)
}

// Update with named placeholders
const updateQuery = Query.create(
  "UPDATE users SET name = :name WHERE id = :id",
  { name: "Alice Smith", id: "user-1" }
)

if (!updateQuery.isError) {
  userRepo.update(updateQuery.value)
}

// Delete
const deleteQuery = Query.create(
  "DELETE FROM users WHERE id = :id",
  { id: "user-1" }
)

if (!deleteQuery.isError) {
  userRepo.delete(deleteQuery.value)
}
```

## Examples

Check the `/examples` directory for complete working examples:

- **[01-basic-usage.ts](./examples/01-basic-usage.ts)** - Core database operations, queries, and error handling
- **[02-migrations.ts](./examples/02-migrations.ts)** - Database migrations and schema versioning
- **[03-advanced-queries.ts](./examples/03-advanced-queries.ts)** - Complex queries, repositories, and statistics

Run examples with:

```bash
bun run examples/01-basic-usage.ts
bun run examples/02-migrations.ts
bun run examples/03-advanced-queries.ts
```

## ID Generation

Generate unique, reliable entity identifiers without relying on SQLite auto-increment. Choose between ULID (time-sortable) or NanoID (compact).

### ULID - Universally Unique Lexicographically Sortable Identifier

Time-ordered, cryptographically random IDs suitable for most use cases:

```typescript
import { Ulid } from "@dnl-fm/bun-sqlite"

// Generate ULID with prefix
const userId = Ulid.create({ prefix: "user_" }).toString()
// Result: user_01ARZ3NDEKTSV4RRFFQ69G5FAV

// Parse existing ULID
const result = Ulid.fromString("user_01ARZ3NDEKTSV4RRFFQ69G5FAV")
if (!result.isError) {
  const ulid = result.value
  const timestamp = ulid.getTimestamp() // Get creation time
}
```

**Benefits:**
- ✅ Time-sortable (lexicographically sorted by creation time)
- ✅ Cryptographically random (26 characters)
- ✅ Prefix support (`user_`, `post_`, `message_`, etc.)
- ✅ Extract timestamp from ID without database query

### NanoID - Compact URL-Safe Identifier

Smaller, simpler alternative when you don't need time-sorting:

```typescript
import { NanoId } from "@dnl-fm/bun-sqlite"

// Generate NanoID with prefix
const postId = NanoId.create({ prefix: "post_" }).toString()
// Result: post_V1StGXR8_Z5jdHi6B-myT

// Customize length
const shortId = NanoId.create({ prefix: "id_", length: 12 }).toString()
// Result: id_a1B2c3D4e5F6

// Parse existing NanoID
const result = NanoId.fromString("post_V1StGXR8_Z5jdHi6B-myT")
if (!result.isError) {
  const nanoid = result.value
  const prefix = nanoid.getPrefix()
}
```

**Benefits:**
- ✅ Compact (default 21 characters)
- ✅ URL-safe characters
- ✅ Customizable length
- ✅ Cryptographically random

### ID Validation in Repositories

Enforce that all inserted entities have IDs:

```typescript
// Using insertWithId() for strict ID validation
const query = Query.create(
  "INSERT INTO users (id, name) VALUES (:id, :name)",
  { id: userId, name: "Alice" }
)

if (!query.isError) {
  const result = userRepo.insertWithId(query.value)
  if (result.isError) {
    console.error("Missing or invalid ID:", result.error)
  }
}

// Backward compatible - insert() works without validation
const result = userRepo.insert(query.value)
```

## API Documentation

### Database

```typescript
// Get or create singleton instance
const result = await Database.getInstance(path?: string, config?: DatabaseConfig)

// Get current instance
const db = Database.getCurrentInstance()

// Query operations
db.query(sql: string, params?: unknown[]): unknown[]
db.queryOne(sql: string, params?: unknown[]): unknown | undefined
db.run(sql: string, params?: unknown[]): number

// Connection
db.getConnection(): DatabaseConnection
db.close(): void
db.isConnected(): boolean
```

### Query

Named placeholder queries with validation:

```typescript
// Create with parameters
const result = Query.create(sql: string, params?: Record<string, unknown>)

// Simple query without parameters
const result = Query.simple(sql: string)

// Query methods
query.getOriginalSql(): string
query.getPositionalSql(): string
query.getParams(): unknown[]
query.getNamedParams(): Record<string, unknown>
query.hasParams(): boolean
query.validate(): Result<void>
```

### BaseRepository

Generic type-safe CRUD operations:

```typescript
class UserRepository extends BaseRepository<User, string> {
  constructor(connection: DatabaseConnection, tableName: string) {
    super(connection, tableName)
  }

  mapRow(row: unknown): User {
    // Required: implement row mapping
  }
}

// CRUD operations
repo.findById(id: TId): Result<TEntity | null>
repo.findAll(): Result<TEntity[]>
repo.findByQuery(query: Query): Result<TEntity[]>
repo.findOneByQuery(query: Query): Result<TEntity | null>
repo.count(): Result<number>
repo.countByQuery(query: Query): Result<number>
repo.exists(id: TId): Result<boolean>

// Mutations
repo.insert(query: Query): Result<number>
repo.update(query: Query): Result<number>
repo.delete(query: Query): Result<number>
repo.deleteById(id: TId): Result<boolean>

// Raw operations
repo.queryRaw(query: Query): Result<unknown[]>

// Transactions
repo.beginTransaction(): void
repo.commit(): void
repo.rollback(): void
```

### MigrationRunner

Versioned schema migrations:

```typescript
const migrations = {
  "001_initial_schema": {
    up: (db) => {
      db.exec("CREATE TABLE users (...)")
    },
    down: (db) => {
      db.exec("DROP TABLE users")
    },
  },
}

const runner = new MigrationRunner(db.getConnection(), migrations)

// Initialize tracking table
await runner.initialize()

// Run pending migrations
const result = await runner.migrate()

// Get status
const status = await runner.status()
```

## Configuration

### DatabaseConfig

Customize pragma settings:

```typescript
import { DatabaseConfig, DEFAULT_PRAGMAS } from "@dnl-fm/bun-sqlite"

const config = new DatabaseConfig({
  "journal_mode": "WAL",
  "synchronous": "NORMAL",
  "cache_size": 10000,
  ...DEFAULT_PRAGMAS,
})

const db = await Database.getInstance(":memory:", config)
```

## Error Handling

All operations return a `Result` type for safe error handling:

```typescript
type Result<T> =
  | { isError: false; value: T }
  | { isError: true; error: string }

// Usage
const result = Query.create(sql, params)
if (result.isError) {
  console.error("Query error:", result.error)
} else {
  // Use result.value safely
}
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Run type checker
bun run type-check

# Run linter
bun run lint

# Format code
bun run format

# Run all checks
bun run check:all

# Build distribution
bun run build
```

## Testing

The library includes comprehensive tests:

```bash
# Run all tests
bun test tests/

# Run with watch mode
bun test --watch tests/
```

Current test coverage: 235+ tests with 90%+ code coverage

## Contributing

Contributions are welcome! Please ensure:

- Tests pass: `bun run test`
- Code is formatted: `bun run format:fix`
- Linting passes: `bun run lint`
- Types are correct: `bun run type-check`

## License

MIT - See [LICENSE](./LICENSE) for details
