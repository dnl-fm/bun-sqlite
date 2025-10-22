# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2025-10-22

### Patch Release - API Simplification

Removed deprecated utility methods from Query class to simplify the API surface. This is a breaking change for code using the removed methods, but the core API remains stable.

### Removed Methods

The following utility methods have been removed to simplify the API surface:

- `Query.getPositionalSql()` - No longer needed, Bun uses named parameters natively
- `Query.getNamedParams()` - Replaced by simplified `getParams()`
- `Query.getPlaceholders()` - Internal implementation detail, not needed in public API
- `Query.hasParams()` - Check `Object.keys(getParams()).length > 0` instead
- `Query.getParamCount()` - Check `Object.keys(getParams()).length` instead
- `Query.bind()` - Use `Query.create()` with updated params instead
- `Query.withParams()` - Use `Query.create()` with new params instead
- `Query.debug()` - Not essential for production use
- `Query.validate()` - Let SQLite handle validation on execution

---

## [1.0.0] - 2025-10-22

### Breaking Changes

The Query class API has been significantly simplified to focus on core functionality and better leverage Bun's native SQLite named parameter support.

#### Removed Methods

The following utility methods have been removed to simplify the API surface:

- `Query.getPositionalSql()` - No longer needed, Bun uses named parameters natively
- `Query.getNamedParams()` - Replaced by simplified `getParams()`
- `Query.getPlaceholders()` - Internal implementation detail, not needed in public API
- `Query.hasParams()` - Check `Object.keys(getParams()).length > 0` instead
- `Query.getParamCount()` - Check `Object.keys(getParams()).length` instead
- `Query.bind()` - Use `Query.create()` with updated params instead
- `Query.withParams()` - Use `Query.create()` with new params instead
- `Query.debug()` - Not essential for production use
- `Query.validate()` - Let SQLite handle validation on execution

#### Simplified API

The Query class now exposes only essential methods:

```typescript
// Factory methods
Query.create(sql: string, params?: Record<string, unknown>): Result<Query>
Query.simple(sql: string): Result<Query>

// Getters
query.getSql(): string                          // SQL with :paramName syntax
query.getParams(): Record<string, unknown>     // Parameters object
```

#### Benefits

- ✅ **Minimal API Surface** - Only 2 factory methods + 2 getters
- ✅ **Direct Bun Integration** - Uses Bun's native named parameter support
- ✅ **Type Safety** - Parameters always passed as objects, never arrays
- ✅ **Reduced Complexity** - No parameter conversion needed
- ✅ **Cleaner Code** - Direct integration with database operations
- ✅ **Immutability** - All getters return copies, not references

#### Migration Guide

If you were using the removed methods, here's how to migrate:

**Parameter Binding (before: `bind()`)**
```typescript
// Before
const query1 = Query.create(sql, { email: "old@example.com", status: "active" })
const query2 = query1.bind("email", "new@example.com")

// After - simply create a new query with updated params
const query = Query.create(sql, { email: "new@example.com", status: "active" })
```

**Parameter Replacement (before: `withParams()`)**
```typescript
// Before
const query1 = Query.create(sql, { email: "user1@example.com" })
const query2 = query1.withParams({ email: "user2@example.com" })

// After - create a new query directly
const query = Query.create(sql, { email: "user2@example.com" })
```

**Checking for Parameters (before: `hasParams()` / `getParamCount()`)**
```typescript
// Before
if (query.hasParams()) { ... }
const count = query.getParamCount()

// After
const params = query.getParams()
if (Object.keys(params).length > 0) { ... }
const count = Object.keys(params).length
```

**Getting Placeholder Names (before: `getPlaceholders()`)**
```typescript
// Before
const placeholders = query.getPlaceholders()

// After - use Object.keys() on params
const paramNames = Object.keys(query.getParams())
```

### Updated Components

The following `BaseRepository` methods have been updated to use the simplified Query API:

- `findById()` - Uses `getSql()` and `getParams()`
- `findByQuery()` - Uses `getSql()` and `getParams()`
- `findOneByQuery()` - Uses `getSql()` and `getParams()`
- `countByQuery()` - Uses `getSql()` and `getParams()`
- `exists()` - Uses `getSql()` and `getParams()`
- `queryRaw()` - Uses `getSql()` and `getParams()`
- `update()` - Uses `getSql()` and `getParams()`
- `delete()` - Uses `getSql()` and `getParams()`
- `deleteById()` - Uses `getSql()` and `getParams()`
- `insert()` - Uses `getSql()` and `getParams()`
- `insertWithId()` - Uses `getParams()` for ID validation

No code changes needed for these methods - they work the same from the caller's perspective.

### Initial Release Highlights

- Named placeholder queries with `:paramName` syntax
- Type-safe repositories with generic CRUD operations
- ID generation (ULID and NanoID)
- Timezone-aware dates with Zeit module
- Migrations system with auto-discovery
- Singleton pattern for database connections
- Result pattern error handling (no exceptions)
- Pragma configuration for WAL mode
- Zero dependencies (uses Bun's native SQLite)
- TypeScript strict mode compliance
- BiomeJS linting
- 90%+ test coverage

---

For detailed documentation, see [README.md](./README.md)
