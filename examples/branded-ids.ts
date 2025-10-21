/**
 * Branded ID types for domain-driven design
 * These prevent mixing IDs of different entity types at compile time
 *
 * @example
 * const userId = UserId.create()
 * const postId = PostId.create()
 *
 * // ✅ Type-safe - compiler prevents ID type mixing
 * userRepo.findById(userId)
 * postRepo.findById(postId)
 *
 * // ❌ Type error - caught at compile time!
 * userRepo.findById(postId) // ERROR: Type 'PostId' is not assignable to type 'UserId'
 */

import { Ulid } from "../src/index.ts"

/**
 * Base class for branded IDs
 * Provides type-safe ID generation with automatic prefix handling
 */
abstract class BrandedId {
  private readonly _value: string
  private readonly _brand!: string // Phantom type for compile-time type safety

  /**
   * Create the prefix for this branded ID
   * Override in subclasses to customize the prefix
   */
  protected static getBrand(): string {
    throw new Error("getBrand() must be implemented in subclass")
  }

  /**
   * Public constructor - required for static factory methods
   * Class is abstract so it cannot be instantiated directly
   */
  constructor(value: string) {
    this._value = value
  }

  /**
   * Create a new branded ID with cryptographic randomness
   */
  static create<T extends BrandedId>(this: new (value: string) => T): T {
    const brand = (this as any).getBrand()
    const ulid = Ulid.create({ prefix: brand })
    return new this(ulid.toString())
  }

  /**
   * Parse an existing branded ID from string
   */
  static fromString<T extends BrandedId>(
    this: new (value: string) => T,
    value: string
  ): T {
    return new this(value)
  }

  /**
   * Get the string representation of the ID
   */
  toString(): string {
    return this._value
  }

  /**
   * Check if this ID equals another ID
   */
  equals(other: BrandedId | string): boolean {
    const otherValue = typeof other === "string" ? other : other.toString()
    return this._value === otherValue
  }
}

/**
 * User identifier
 * Used to uniquely identify users in the system
 *
 * @example
 * const userId = UserId.create() // user_01ARZ3NDEKTSV4RRFFQ69G5FAV
 */
export class UserId extends BrandedId {
  protected static override getBrand(): string {
    return "user_"
  }
}

/**
 * Post identifier
 * Used to uniquely identify posts/articles in the system
 *
 * @example
 * const postId = PostId.create() // post_01ARZ3NDEKTSV4RRFFQ69G5FAV
 */
export class PostId extends BrandedId {
  protected static override getBrand(): string {
    return "post_"
  }
}

/**
 * Product identifier
 * Used to uniquely identify products in the system
 *
 * @example
 * const productId = ProductId.create() // product_01ARZ3NDEKTSV4RRFFQ69G5FAV
 */
export class ProductId extends BrandedId {
  protected static override getBrand(): string {
    return "product_"
  }
}
