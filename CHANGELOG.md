# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-10-22

### Breaking Changes

The Query class API has been simplified to leverage Bun's native SQLite named parameter support. This is a **major version bump** requiring code updates for users of previous versions.

#### Removed Methods

- `Query.getPositionalSql()` - No longer needed, removed positional SQL conversion
- `Query.getParams()` returning `unknown[]` - Replaced with new `getParams()` returning object

#### Renamed Methods

- `Query.getOriginalSql()` → `Query.getSql()`
- `Query.getNamedParams()` → `Query.getParams()`

#### Benefits

- ✅ Simpler API - No "original" vs "positional" confusion
- ✅ Better readability - Method names are now self-explanatory
- ✅ Cleaner code - Direct use of Bun's native named parameter support
- ✅ Type safety - Parameters now always passed as objects, never arrays

### Migration Guide

**Before:**
```typescript
const query = Query.create("SELECT * FROM users WHERE email = :email", { email: "test@example.com" })
const stmt = db.prepare(query.getPositionalSql())
const result = stmt.get(...query.getParams())  // Spread array
```

**After:**
```typescript
const query = Query.create("SELECT * FROM users WHERE email = :email", { email: "test@example.com" })
const stmt = db.prepare(query.getSql())
const result = stmt.get(query.getParams())  // Pass object directly
```

### Updated Methods Automatically

The following `BaseRepository` methods have been updated internally to use the new Query API:

- `findById()`
- `findAll()`
- `findByQuery()`
- `findOneByQuery()`
- `count()`
- `countByQuery()`
- `exists()`
- `queryRaw()`
- `update()`
- `delete()`
- `deleteById()`
- `insert()`

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
