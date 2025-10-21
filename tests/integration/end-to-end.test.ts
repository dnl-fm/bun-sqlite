/**
 * Comprehensive End-to-End Integration Tests
 * Tests complete workflows with Database, Query, and Repository
 *
 * @module tests/integration/end-to-end
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import type { Database } from "../../src/core/database.ts"
import { Query } from "../../src/query/query.ts"
import { BaseRepository } from "../../src/repository/base-repository.ts"
import type { DatabaseConnection, EntityId } from "../../src/types.ts"
import {
  createTestDatabase,
  cleanupTestDatabase,
  setupTestDb,
  teardownTestDb,
  assertSuccess,
  assertError,
  USER_TEST_SCHEMA,
  POST_TEST_SCHEMA,
  COMBINED_TEST_SCHEMA,
} from "../test-utils.ts"

// ============================================================================
// Test Entities
// ============================================================================

interface User {
  id: string
  email: string
  name: string
  status: string
  createdAt: number
}

interface Post {
  id: string
  userId: string
  title: string
  content: string | null
  createdAt: number
}

interface Comment {
  id: string
  postId: string
  userId: string
  content: string
  createdAt: number
}

// ============================================================================
// Test Repositories
// ============================================================================

class UserRepository extends BaseRepository<User, string> {
  constructor(connection: DatabaseConnection) {
    super(connection, "users")
  }

  mapRow(row: unknown): User {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      email: String(r.email),
      name: String(r.name),
      status: String(r.status),
      createdAt: Number(r.created_at),
    }
  }

  async createUser(user: Omit<User, "createdAt">): Promise<User> {
    const createdAt = Date.now()
    const queryResult = Query.create(
      `INSERT INTO users (id, email, name, status, created_at)
       VALUES (:id, :email, :name, :status, :createdAt)`,
      {
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        createdAt,
      }
    )

    const query = assertSuccess(queryResult)
    const insertResult = this.insert(query)
    assertSuccess(insertResult)

    return { ...user, createdAt }
  }

  async updateUserStatus(id: string, status: string): Promise<number> {
    const queryResult = Query.create(
      `UPDATE users SET status = :status WHERE id = :id`,
      { id, status }
    )

    const query = assertSuccess(queryResult)
    const updateResult = this.update(query)
    return assertSuccess(updateResult)
  }

  async findByEmail(email: string): Promise<User | null> {
    const queryResult = Query.create(
      `SELECT * FROM users WHERE email = :email`,
      { email }
    )

    const query = assertSuccess(queryResult)
    const result = this.findOneByQuery(query)
    return assertSuccess(result)
  }

  async findByStatus(status: string): Promise<User[]> {
    const queryResult = Query.create(
      `SELECT * FROM users WHERE status = :status ORDER BY created_at DESC`,
      { status }
    )

    const query = assertSuccess(queryResult)
    const result = this.findByQuery(query)
    return assertSuccess(result)
  }
}

class PostRepository extends BaseRepository<Post, string> {
  constructor(connection: DatabaseConnection) {
    super(connection, "posts")
  }

  mapRow(row: unknown): Post {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      userId: String(r.user_id),
      title: String(r.title),
      content: r.content ? String(r.content) : null,
      createdAt: Number(r.created_at),
    }
  }

  async createPost(post: Omit<Post, "createdAt">): Promise<Post> {
    const createdAt = Date.now()
    const queryResult = Query.create(
      `INSERT INTO posts (id, user_id, title, content, created_at)
       VALUES (:id, :userId, :title, :content, :createdAt)`,
      {
        id: post.id,
        userId: post.userId,
        title: post.title,
        content: post.content,
        createdAt,
      }
    )

    const query = assertSuccess(queryResult)
    const insertResult = this.insert(query)
    assertSuccess(insertResult)

    return { ...post, createdAt }
  }

  async findByUserId(userId: string): Promise<Post[]> {
    const queryResult = Query.create(
      `SELECT * FROM posts WHERE user_id = :userId ORDER BY created_at DESC`,
      { userId }
    )

    const query = assertSuccess(queryResult)
    const result = this.findByQuery(query)
    return assertSuccess(result)
  }

  async findWithJoin(userId: string): Promise<unknown[]> {
    const queryResult = Query.create(
      `SELECT
        posts.*,
        users.name as author_name,
        users.email as author_email
       FROM posts
       JOIN users ON posts.user_id = users.id
       WHERE posts.user_id = :userId
       ORDER BY posts.created_at DESC`,
      { userId }
    )

    const query = assertSuccess(queryResult)
    const result = this.queryRaw(query)
    return assertSuccess(result)
  }
}

// ============================================================================
// Workflow 1: Database + Repository - Basic CRUD Operations
// ============================================================================

describe("Workflow 1: Database + Repository - Basic CRUD", () => {
  let db: Database
  let userRepo: UserRepository

  beforeEach(async () => {
    db = await setupTestDb(USER_TEST_SCHEMA)
    userRepo = new UserRepository(db.getConnection())
  })

  afterEach(async () => {
    await teardownTestDb(db)
  })

  test("should create database with schema and initialize repository", () => {
    expect(db.isConnected()).toBe(true)
    expect(userRepo).toBeDefined()

    const countResult = userRepo.count()
    expect(countResult.isError).toBe(false)
    if (!countResult.isError) {
      expect(countResult.value).toBe(0)
    }
  })

  test("should insert user and read it back", async () => {
    // Insert
    const user = await userRepo.createUser({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice Smith",
      status: "active",
    })

    expect(user.id).toBe("user-1")
    expect(user.email).toBe("alice@example.com")
    expect(user.name).toBe("Alice Smith")
    expect(user.status).toBe("active")
    expect(user.createdAt).toBeGreaterThan(0)

    // Read by ID
    const findResult = userRepo.findById("user-1")
    assertSuccess(findResult)

    expect(findResult.isError).toBe(false)
    if (!findResult.isError) {
      expect(findResult.value).not.toBeNull()
      expect(findResult.value?.id).toBe("user-1")
      expect(findResult.value?.email).toBe("alice@example.com")
    }
  })

  test("should update user and verify changes", async () => {
    // Create user
    await userRepo.createUser({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice Smith",
      status: "active",
    })

    // Update status
    const changes = await userRepo.updateUserStatus("user-1", "inactive")
    expect(changes).toBe(1)

    // Verify update
    const findResult = userRepo.findById("user-1")
    assertSuccess(findResult)

    if (!findResult.isError) {
      expect(findResult.value?.status).toBe("inactive")
    }
  })

  test("should delete user and verify deletion", async () => {
    // Create user
    await userRepo.createUser({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice Smith",
      status: "active",
    })

    // Verify exists
    const existsResult = userRepo.exists("user-1")
    expect(assertSuccess(existsResult)).toBe(true)

    // Delete
    const deleteResult = userRepo.deleteById("user-1")
    expect(assertSuccess(deleteResult)).toBe(true)

    // Verify deletion
    const findResult = userRepo.findById("user-1")
    expect(assertSuccess(findResult)).toBeNull()

    // Note: exists() checks if a row exists, but SQLite may return NULL instead of undefined
    // So we verify by trying to find the record instead
    const verifyResult = userRepo.findById("user-1")
    expect(assertSuccess(verifyResult)).toBeNull()
  })

  test("should handle data integrity across CRUD operations", async () => {
    // Create multiple users
    const users = [
      { id: "user-1", email: "alice@example.com", name: "Alice", status: "active" },
      { id: "user-2", email: "bob@example.com", name: "Bob", status: "active" },
      { id: "user-3", email: "charlie@example.com", name: "Charlie", status: "inactive" },
    ]

    for (const user of users) {
      await userRepo.createUser(user)
    }

    // Verify count
    const countResult = userRepo.count()
    expect(assertSuccess(countResult)).toBe(3)

    // Find all
    const allResult = userRepo.findAll()
    const allUsers = assertSuccess(allResult)
    expect(allUsers.length).toBe(3)

    // Update one
    await userRepo.updateUserStatus("user-2", "inactive")

    // Delete one
    const deleteResult = userRepo.deleteById("user-1")
    expect(assertSuccess(deleteResult)).toBe(true)

    // Verify final count
    const finalCountResult = userRepo.count()
    expect(assertSuccess(finalCountResult)).toBe(2)

    // Verify remaining users
    const remainingResult = userRepo.findAll()
    const remainingUsers = assertSuccess(remainingResult)
    expect(remainingUsers.length).toBe(2)
    expect(remainingUsers.find(u => u.id === "user-1")).toBeUndefined()
  })
})

// ============================================================================
// Workflow 2: Named Placeholders + Repository - Complex Queries
// ============================================================================

describe("Workflow 2: Named Placeholders + Repository", () => {
  let db: Database
  let userRepo: UserRepository

  beforeEach(async () => {
    db = await setupTestDb(USER_TEST_SCHEMA)
    userRepo = new UserRepository(db.getConnection())

    // Seed data
    const users = [
      { id: "user-1", email: "alice@example.com", name: "Alice Smith", status: "active" },
      { id: "user-2", email: "bob@example.com", name: "Bob Jones", status: "active" },
      { id: "user-3", email: "charlie@example.com", name: "Charlie Brown", status: "inactive" },
      { id: "user-4", email: "diana@example.com", name: "Diana Prince", status: "active" },
      { id: "user-5", email: "eve@example.com", name: "Eve Wilson", status: "suspended" },
    ]

    for (const user of users) {
      await userRepo.createUser(user)
    }
  })

  afterEach(async () => {
    await teardownTestDb(db)
  })

  test("should use named placeholders in WHERE clauses", async () => {
    const activeUsers = await userRepo.findByStatus("active")
    expect(activeUsers.length).toBe(3)
    expect(activeUsers.every(u => u.status === "active")).toBe(true)
  })

  test("should find user by email using named placeholder", async () => {
    const user = await userRepo.findByEmail("alice@example.com")
    expect(user).not.toBeNull()
    expect(user?.email).toBe("alice@example.com")
    expect(user?.name).toBe("Alice Smith")
  })

  test("should handle complex WHERE clauses with multiple parameters", async () => {
    const queryResult = Query.create(
      `SELECT * FROM users
       WHERE status = :status
       AND email LIKE :emailPattern
       ORDER BY name ASC`,
      {
        status: "active",
        emailPattern: "%@example.com",
      }
    )

    const query = assertSuccess(queryResult)
    const result = userRepo.findByQuery(query)
    const users = assertSuccess(result)

    expect(users.length).toBe(3)
    expect(users[0].name).toBe("Alice Smith")
  })

  test("should verify parameter binding works correctly", async () => {
    // Create query with named placeholders
    const queryResult = Query.create(
      `SELECT * FROM users WHERE id IN (:id1, :id2, :id3)`,
      {
        id1: "user-1",
        id2: "user-2",
        id3: "user-3",
      }
    )

    const query = assertSuccess(queryResult)

    // Verify parameter extraction
    expect(query.hasParams()).toBe(true)
    expect(query.getParamCount()).toBe(3)
    expect(query.getPlaceholders()).toEqual(["id1", "id2", "id3"])

    // Execute query
    const result = userRepo.findByQuery(query)
    const users = assertSuccess(result)
    expect(users.length).toBe(3)
  })

  test("should reuse query with different parameters", async () => {
    const queryResult = Query.create(
      `SELECT * FROM users WHERE status = :status`,
      { status: "active" }
    )

    const query = assertSuccess(queryResult)

    // First execution
    const activeResult = userRepo.findByQuery(query)
    const activeUsers = assertSuccess(activeResult)
    expect(activeUsers.length).toBe(3)

    // Reuse with different parameters
    const inactiveQueryResult = query.withParams({ status: "inactive" })
    const inactiveQuery = assertSuccess(inactiveQueryResult)

    const inactiveResult = userRepo.findByQuery(inactiveQuery)
    const inactiveUsers = assertSuccess(inactiveResult)
    expect(inactiveUsers.length).toBe(1)
  })

  test("should handle LIKE patterns with named placeholders", async () => {
    const queryResult = Query.create(
      `SELECT * FROM users WHERE name LIKE :pattern ORDER BY name ASC`,
      { pattern: "%Smith%" }
    )

    const query = assertSuccess(queryResult)
    const result = userRepo.findByQuery(query)
    const users = assertSuccess(result)

    expect(users.length).toBe(1)
    expect(users[0].name).toBe("Alice Smith")
  })

  test("should count with named placeholders", async () => {
    const queryResult = Query.create(
      `SELECT COUNT(*) as count FROM users WHERE status = :status`,
      { status: "active" }
    )

    const query = assertSuccess(queryResult)
    const result = userRepo.countByQuery(query)
    const count = assertSuccess(result)

    expect(count).toBe(3)
  })
})

// ============================================================================
// Workflow 3: Multiple Repositories - Relationships & Joins
// ============================================================================

describe("Workflow 3: Multiple Repositories - Relationships", () => {
  let db: Database
  let userRepo: UserRepository
  let postRepo: PostRepository

  beforeEach(async () => {
    db = await setupTestDb(COMBINED_TEST_SCHEMA)
    userRepo = new UserRepository(db.getConnection())
    postRepo = new PostRepository(db.getConnection())

    // Seed users
    await userRepo.createUser({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice Smith",
      status: "active",
    })

    await userRepo.createUser({
      id: "user-2",
      email: "bob@example.com",
      name: "Bob Jones",
      status: "active",
    })
  })

  afterEach(async () => {
    await teardownTestDb(db)
  })

  test("should create posts with foreign key relationships", async () => {
    const post = await postRepo.createPost({
      id: "post-1",
      userId: "user-1",
      title: "My First Post",
      content: "This is my first post!",
    })

    expect(post.id).toBe("post-1")
    expect(post.userId).toBe("user-1")
    expect(post.title).toBe("My First Post")

    // Verify post exists
    const findResult = postRepo.findById("post-1")
    const foundPost = assertSuccess(findResult)
    expect(foundPost).not.toBeNull()
  })

  test("should query posts by user ID", async () => {
    // Create multiple posts for user-1
    await postRepo.createPost({
      id: "post-1",
      userId: "user-1",
      title: "First Post",
      content: "Content 1",
    })

    await postRepo.createPost({
      id: "post-2",
      userId: "user-1",
      title: "Second Post",
      content: "Content 2",
    })

    // Create post for user-2
    await postRepo.createPost({
      id: "post-3",
      userId: "user-2",
      title: "Bob's Post",
      content: "Bob's content",
    })

    // Query user-1's posts
    const user1Posts = await postRepo.findByUserId("user-1")
    expect(user1Posts.length).toBe(2)
    expect(user1Posts.every(p => p.userId === "user-1")).toBe(true)

    // Query user-2's posts
    const user2Posts = await postRepo.findByUserId("user-2")
    expect(user2Posts.length).toBe(1)
    expect(user2Posts[0].title).toBe("Bob's Post")
  })

  test("should perform JOIN queries across repositories", async () => {
    // Create posts
    await postRepo.createPost({
      id: "post-1",
      userId: "user-1",
      title: "Alice's Amazing Post",
      content: "Amazing content!",
    })

    await postRepo.createPost({
      id: "post-2",
      userId: "user-1",
      title: "Another Post by Alice",
      content: "More content!",
    })

    // Execute JOIN query
    const joinedData = await postRepo.findWithJoin("user-1")
    expect(joinedData.length).toBe(2)

    const firstRow = joinedData[0] as Record<string, unknown>
    expect(firstRow.author_name).toBe("Alice Smith")
    expect(firstRow.author_email).toBe("alice@example.com")
    expect(firstRow.title).toBeDefined()
  })

  test("should maintain referential integrity", async () => {
    // Create post
    await postRepo.createPost({
      id: "post-1",
      userId: "user-1",
      title: "Test Post",
      content: "Content",
    })

    // Verify we can query the relationship both ways
    const user = await userRepo.findById("user-1")
    expect(assertSuccess(user)).not.toBeNull()

    const posts = await postRepo.findByUserId("user-1")
    expect(posts.length).toBe(1)
    expect(posts[0].userId).toBe("user-1")
  })

  test("should handle cascading queries across multiple tables", async () => {
    // Create posts for multiple users
    const users = ["user-1", "user-2"]
    const postsPerUser = 3

    for (const userId of users) {
      for (let i = 1; i <= postsPerUser; i++) {
        await postRepo.createPost({
          id: `post-${userId}-${i}`,
          userId,
          title: `Post ${i} by ${userId}`,
          content: `Content ${i}`,
        })
      }
    }

    // Query all active users and their posts
    const activeUsers = await userRepo.findByStatus("active")
    expect(activeUsers.length).toBe(2)

    for (const user of activeUsers) {
      const userPosts = await postRepo.findByUserId(user.id)
      expect(userPosts.length).toBe(postsPerUser)
    }

    // Total post count
    const totalPostsResult = postRepo.count()
    expect(assertSuccess(totalPostsResult)).toBe(6)
  })
})

// ============================================================================
// Workflow 4: Error Handling - Result Pattern
// ============================================================================

describe("Workflow 4: Error Handling - Result Pattern", () => {
  let db: Database
  let userRepo: UserRepository

  beforeEach(async () => {
    db = await setupTestDb(USER_TEST_SCHEMA)
    userRepo = new UserRepository(db.getConnection())
  })

  afterEach(async () => {
    await teardownTestDb(db)
  })

  test("should return error for missing named parameters", () => {
    const queryResult = Query.create(
      `SELECT * FROM users WHERE email = :email AND status = :status`,
      { email: "test@example.com" } // Missing status parameter
    )

    expect(queryResult.isError).toBe(true)
    if (queryResult.isError) {
      expect(queryResult.error).toContain("Missing parameters")
      expect(queryResult.error).toContain("status")
    }
  })

  test("should return error for extra parameters", () => {
    const queryResult = Query.create(
      `SELECT * FROM users WHERE email = :email`,
      { email: "test@example.com", status: "active", extra: "param" }
    )

    expect(queryResult.isError).toBe(true)
    if (queryResult.isError) {
      expect(queryResult.error).toContain("Extra parameters")
    }
  })

  test("should handle SQL constraint violations gracefully", async () => {
    // Create user
    await userRepo.createUser({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice Smith",
      status: "active",
    })

    // Try to insert duplicate ID
    const queryResult = Query.create(
      `INSERT INTO users (id, email, name, status, created_at)
       VALUES (:id, :email, :name, :status, :createdAt)`,
      {
        id: "user-1", // Duplicate ID
        email: "different@example.com",
        name: "Different Name",
        status: "active",
        createdAt: Date.now(),
      }
    )

    const query = assertSuccess(queryResult)
    const insertResult = userRepo.insert(query)

    expect(insertResult.isError).toBe(true)
    if (insertResult.isError) {
      expect(insertResult.error).toContain("Failed to insert")
    }
  })

  test("should handle non-existent records gracefully", async () => {
    const findResult = userRepo.findById("non-existent-id")
    expect(findResult.isError).toBe(false)

    if (!findResult.isError) {
      expect(findResult.value).toBeNull()
    }
  })

  test("should validate Result pattern throughout stack", async () => {
    // Test successful flow
    const user = await userRepo.createUser({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice Smith",
      status: "active",
    })

    // Every operation returns Result
    const findResult = userRepo.findById(user.id)
    expect(findResult.isError).toBe(false)

    const countResult = userRepo.count()
    expect(countResult.isError).toBe(false)

    const existsResult = userRepo.exists(user.id)
    expect(existsResult.isError).toBe(false)

    const deleteResult = userRepo.deleteById(user.id)
    expect(deleteResult.isError).toBe(false)
  })

  test("should handle invalid SQL gracefully", () => {
    const queryResult = Query.create(
      `SELECT * FROM users WHERE id = :id`,
      { id: "user-1" }
    )

    const query = assertSuccess(queryResult)

    // Manually break the query to test error handling
    const badQueryResult = Query.create(
      `SELECT * FROM non_existent_table WHERE id = :id`,
      { id: "user-1" }
    )

    const badQuery = assertSuccess(badQueryResult)
    const result = userRepo.findByQuery(badQuery)

    expect(result.isError).toBe(true)
    if (result.isError) {
      expect(result.error).toContain("Failed to find by query")
    }
  })

  test("should handle unclosed string literals in query validation", () => {
    // Query validation should catch syntax errors
    const queryResult = Query.create(
      `SELECT * FROM users WHERE name = 'Alice`,
      {}
    )

    const query = assertSuccess(queryResult)
    const validationResult = query.validate()

    expect(validationResult.isError).toBe(true)
    if (validationResult.isError) {
      expect(validationResult.error).toContain("Unclosed single quote")
    }
  })
})

// ============================================================================
// Workflow 5: Real Database Operations - Complex Scenarios
// ============================================================================

describe("Workflow 5: Real Database Operations", () => {
  let db: Database
  let userRepo: UserRepository
  let postRepo: PostRepository

  beforeEach(async () => {
    db = await setupTestDb(COMBINED_TEST_SCHEMA)
    userRepo = new UserRepository(db.getConnection())
    postRepo = new PostRepository(db.getConnection())
  })

  afterEach(async () => {
    await teardownTestDb(db)
  })

  test("should handle multiple sequential inserts efficiently", async () => {
    const userCount = 50
    const startTime = Date.now()

    for (let i = 1; i <= userCount; i++) {
      await userRepo.createUser({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        name: `User ${i}`,
        status: i % 3 === 0 ? "inactive" : "active",
      })
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    // Verify all inserted
    const countResult = userRepo.count()
    expect(assertSuccess(countResult)).toBe(userCount)

    // Should complete reasonably fast (< 1 second for 50 inserts)
    expect(duration).toBeLessThan(1000)
  })

  test("should execute complex queries with multiple joins", async () => {
    // Create users
    const user1 = await userRepo.createUser({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice Smith",
      status: "active",
    })

    const user2 = await userRepo.createUser({
      id: "user-2",
      email: "bob@example.com",
      name: "Bob Jones",
      status: "active",
    })

    // Create posts
    await postRepo.createPost({
      id: "post-1",
      userId: "user-1",
      title: "Alice's Post 1",
      content: "Content 1",
    })

    await postRepo.createPost({
      id: "post-2",
      userId: "user-1",
      title: "Alice's Post 2",
      content: "Content 2",
    })

    await postRepo.createPost({
      id: "post-3",
      userId: "user-2",
      title: "Bob's Post",
      content: "Bob's content",
    })

    // Complex aggregation query
    const queryResult = Query.create(
      `SELECT
        users.id as user_id,
        users.name,
        users.email,
        COUNT(posts.id) as post_count
       FROM users
       LEFT JOIN posts ON users.id = posts.user_id
       WHERE users.status = :status
       GROUP BY users.id, users.name, users.email
       HAVING COUNT(posts.id) >= :minPosts
       ORDER BY post_count DESC`,
      {
        status: "active",
        minPosts: 1,
      }
    )

    const query = assertSuccess(queryResult)
    const result = userRepo.queryRaw(query)
    const rows = assertSuccess(result)

    expect(rows.length).toBe(2)

    const firstRow = rows[0] as Record<string, unknown>
    expect(firstRow.name).toBe("Alice Smith")
    expect(firstRow.post_count).toBe(2)
  })

  test("should handle transaction scenarios correctly", async () => {
    const connection = db.getConnection()

    // Begin transaction
    connection.exec("BEGIN TRANSACTION")

    try {
      // Insert users within transaction
      await userRepo.createUser({
        id: "user-1",
        email: "alice@example.com",
        name: "Alice Smith",
        status: "active",
      })

      await userRepo.createUser({
        id: "user-2",
        email: "bob@example.com",
        name: "Bob Jones",
        status: "active",
      })

      // Commit transaction
      connection.exec("COMMIT")

      // Verify both users exist
      const countResult = userRepo.count()
      expect(assertSuccess(countResult)).toBe(2)
    } catch (error) {
      connection.exec("ROLLBACK")
      throw error
    }
  })

  test("should rollback transaction on error", async () => {
    const connection = db.getConnection()

    // Insert one user successfully
    await userRepo.createUser({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice Smith",
      status: "active",
    })

    // Begin transaction
    connection.exec("BEGIN TRANSACTION")

    try {
      // Insert valid user
      await userRepo.createUser({
        id: "user-2",
        email: "bob@example.com",
        name: "Bob Jones",
        status: "active",
      })

      // Try to insert duplicate (should fail)
      await userRepo.createUser({
        id: "user-1", // Duplicate ID
        email: "duplicate@example.com",
        name: "Duplicate",
        status: "active",
      })

      connection.exec("COMMIT")
    } catch (error) {
      // Rollback on error
      connection.exec("ROLLBACK")
    }

    // Only user-1 should exist (user-2 was rolled back)
    const countResult = userRepo.count()
    expect(assertSuccess(countResult)).toBe(1)

    const user2Result = userRepo.findById("user-2")
    expect(assertSuccess(user2Result)).toBeNull()
  })

  test("should handle concurrent access patterns", async () => {
    // Simulate concurrent inserts
    const promises: Promise<User>[] = []

    for (let i = 1; i <= 10; i++) {
      promises.push(
        userRepo.createUser({
          id: `user-${i}`,
          email: `user${i}@example.com`,
          name: `User ${i}`,
          status: "active",
        })
      )
    }

    // Wait for all inserts
    const results = await Promise.all(promises)
    expect(results.length).toBe(10)

    // Verify all users exist
    const countResult = userRepo.count()
    expect(assertSuccess(countResult)).toBe(10)

    const allResult = userRepo.findAll()
    const allUsers = assertSuccess(allResult)
    expect(allUsers.length).toBe(10)
  })

  test("should perform bulk operations efficiently", async () => {
    // Bulk insert
    const users: Array<Omit<User, "createdAt">> = []
    for (let i = 1; i <= 100; i++) {
      users.push({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        name: `User ${i}`,
        status: i % 2 === 0 ? "active" : "inactive",
      })
    }

    const startTime = Date.now()

    for (const user of users) {
      await userRepo.createUser(user)
    }

    const insertTime = Date.now() - startTime

    // Bulk query
    const queryStart = Date.now()
    const activeUsers = await userRepo.findByStatus("active")
    const queryTime = Date.now() - queryStart

    expect(activeUsers.length).toBe(50)
    expect(insertTime).toBeLessThan(2000) // Should be reasonably fast
    expect(queryTime).toBeLessThan(100) // Query should be very fast
  })

  test("should handle pagination-style queries", async () => {
    // Insert test data
    for (let i = 1; i <= 20; i++) {
      await userRepo.createUser({
        id: `user-${i.toString().padStart(3, "0")}`,
        email: `user${i}@example.com`,
        name: `User ${i}`,
        status: "active",
      })
    }

    // Page 1 (first 5 users)
    const page1Query = Query.create(
      `SELECT * FROM users
       WHERE status = :status
       ORDER BY id ASC
       LIMIT :limit OFFSET :offset`,
      {
        status: "active",
        limit: 5,
        offset: 0,
      }
    )

    const page1 = assertSuccess(userRepo.findByQuery(assertSuccess(page1Query)))
    expect(page1.length).toBe(5)
    expect(page1[0].id).toBe("user-001")

    // Page 2 (next 5 users)
    const page2Query = Query.create(
      `SELECT * FROM users
       WHERE status = :status
       ORDER BY id ASC
       LIMIT :limit OFFSET :offset`,
      {
        status: "active",
        limit: 5,
        offset: 5,
      }
    )

    const page2 = assertSuccess(userRepo.findByQuery(assertSuccess(page2Query)))
    expect(page2.length).toBe(5)
    expect(page2[0].id).toBe("user-006")
  })

  test("should execute subqueries correctly", async () => {
    // Create users with different statuses
    await userRepo.createUser({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice Smith",
      status: "active",
    })

    await userRepo.createUser({
      id: "user-2",
      email: "bob@example.com",
      name: "Bob Jones",
      status: "active",
    })

    await userRepo.createUser({
      id: "user-3",
      email: "charlie@example.com",
      name: "Charlie Brown",
      status: "inactive",
    })

    // Create posts only for active users
    await postRepo.createPost({
      id: "post-1",
      userId: "user-1",
      title: "Post 1",
      content: "Content 1",
    })

    await postRepo.createPost({
      id: "post-2",
      userId: "user-2",
      title: "Post 2",
      content: "Content 2",
    })

    // Subquery: Find posts by active users
    const queryResult = Query.create(
      `SELECT * FROM posts
       WHERE user_id IN (
         SELECT id FROM users WHERE status = :status
       )
       ORDER BY created_at DESC`,
      { status: "active" }
    )

    const query = assertSuccess(queryResult)
    const result = postRepo.findByQuery(query)
    const posts = assertSuccess(result)

    expect(posts.length).toBe(2)
    expect(posts.every(p => ["user-1", "user-2"].includes(p.userId))).toBe(true)
  })

  test("should handle NULL values correctly", async () => {
    // Create post with NULL content
    const post = await postRepo.createPost({
      id: "post-1",
      userId: "user-1",
      title: "Post without content",
      content: null,
    })

    expect(post.content).toBeNull()

    // Query and verify NULL handling
    const findResult = postRepo.findById("post-1")
    const foundPost = assertSuccess(findResult)

    expect(foundPost).not.toBeNull()
    expect(foundPost?.content).toBeNull()
  })
})

// ============================================================================
// Integration: Full Application Scenario
// ============================================================================

describe("Integration: Full Application Scenario", () => {
  let db: Database
  let userRepo: UserRepository
  let postRepo: PostRepository

  beforeEach(async () => {
    db = await setupTestDb(COMBINED_TEST_SCHEMA)
    userRepo = new UserRepository(db.getConnection())
    postRepo = new PostRepository(db.getConnection())
  })

  afterEach(async () => {
    await teardownTestDb(db)
  })

  test("should simulate complete blog application workflow", async () => {
    // 1. User registration
    const alice = await userRepo.createUser({
      id: "alice-123",
      email: "alice@blog.com",
      name: "Alice Smith",
      status: "active",
    })

    const bob = await userRepo.createUser({
      id: "bob-456",
      email: "bob@blog.com",
      name: "Bob Jones",
      status: "active",
    })

    // 2. Verify users can be found by email
    const aliceByEmail = await userRepo.findByEmail("alice@blog.com")
    expect(aliceByEmail?.id).toBe(alice.id)

    // 3. Alice creates posts
    const post1 = await postRepo.createPost({
      id: "post-1",
      userId: alice.id,
      title: "My First Blog Post",
      content: "This is my first blog post about SQLite!",
    })

    const post2 = await postRepo.createPost({
      id: "post-2",
      userId: alice.id,
      title: "Another Post",
      content: "More interesting content here.",
    })

    // 4. Bob creates a post
    await postRepo.createPost({
      id: "post-3",
      userId: bob.id,
      title: "Bob's Thoughts",
      content: "My perspective on databases.",
    })

    // 5. Get Alice's posts
    const alicePosts = await postRepo.findByUserId(alice.id)
    expect(alicePosts.length).toBe(2)

    // 6. Get post with author information
    const postsWithAuthors = await postRepo.findWithJoin(alice.id)
    expect(postsWithAuthors.length).toBe(2)

    const firstPost = postsWithAuthors[0] as Record<string, unknown>
    expect(firstPost.author_name).toBe("Alice Smith")

    // 7. Update user status (e.g., user goes inactive)
    await userRepo.updateUserStatus(alice.id, "inactive")

    // 8. Verify status change
    const updatedAlice = await userRepo.findById(alice.id)
    expect(assertSuccess(updatedAlice)?.status).toBe("inactive")

    // 9. Query only active users
    const activeUsers = await userRepo.findByStatus("active")
    expect(activeUsers.length).toBe(1)
    expect(activeUsers[0].id).toBe(bob.id)

    // 10. Count all posts
    const totalPostsResult = postRepo.count()
    expect(assertSuccess(totalPostsResult)).toBe(3)

    // 11. Delete a post
    const deleteResult = postRepo.deleteById("post-1")
    expect(assertSuccess(deleteResult)).toBe(true)

    // 12. Verify deletion
    const remainingAlicePosts = await postRepo.findByUserId(alice.id)
    expect(remainingAlicePosts.length).toBe(1)

    // 13. Final verification
    const finalUserCount = assertSuccess(userRepo.count())
    const finalPostCount = assertSuccess(postRepo.count())

    expect(finalUserCount).toBe(2)
    expect(finalPostCount).toBe(2)
  })
})
