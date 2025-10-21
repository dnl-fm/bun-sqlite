/**
 * Example 3: Advanced Query Patterns
 * Demonstrates complex queries, transactions, and repository patterns
 */

import { Database, Query, BaseRepository } from "../src/index.ts"

// ============================================================================
// STEP 1: Define entities and repository
// ============================================================================

interface Product {
  id: string
  name: string
  price: number
  stock: number
  category: string
}

class ProductRepository extends BaseRepository<Product, string> {
  constructor(db: Database) {
    super(db.getConnection(), "products")
  }

  mapRow(row: unknown): Product {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      name: r.name as string,
      price: r.price as number,
      stock: r.stock as number,
      category: r.category as string,
    }
  }

  /**
   * Find products by category
   */
  findByCategory(category: string) {
    const query = Query.create(
      "SELECT * FROM products WHERE category = :category ORDER BY name",
      { category }
    )

    if (query.isError) {
      return query
    }
    return this.findByQuery(query.value)
  }

  /**
   * Find products in price range
   */
  findByPriceRange(minPrice: number, maxPrice: number) {
    const query = Query.create(
      "SELECT * FROM products WHERE price BETWEEN :minPrice AND :maxPrice ORDER BY price",
      { minPrice, maxPrice }
    )

    if (query.isError) {
      return query
    }
    return this.findByQuery(query.value)
  }

  /**
   * Find low stock products
   */
  findLowStock(threshold: number) {
    const query = Query.create(
      "SELECT * FROM products WHERE stock < :threshold ORDER BY stock",
      { threshold }
    )

    if (query.isError) {
      return query
    }
    return this.findByQuery(query.value)
  }

  /**
   * Count products by category
   */
  countByCategory(category: string) {
    const query = Query.create(
      "SELECT COUNT(*) as count FROM products WHERE category = :category",
      { category }
    )

    if (query.isError) {
      return query
    }
    return this.countByQuery(query.value)
  }

  /**
   * Update stock quantity
   */
  updateStock(id: string, quantity: number) {
    const query = Query.create(
      "UPDATE products SET stock = :stock WHERE id = :id",
      { stock: quantity, id }
    )

    if (query.isError) {
      return query
    }
    return this.update(query.value)
  }

  /**
   * Get raw stats
   */
  getStats() {
    const query = Query.simple(`
      SELECT
        COUNT(*) as total,
        SUM(stock) as total_stock,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price
      FROM products
    `)

    if (query.isError) {
      return query
    }
    return this.queryRaw(query.value)
  }
}

// ============================================================================
// STEP 2: Setup and populate database
// ============================================================================

async function main() {
  // Create database
  const dbResult = await Database.getInstance(":memory:")

  if (dbResult.isError) {
    console.error("Failed to initialize database:", dbResult.error)
    return
  }

  const db = dbResult.value

  // Create schema
  db.getConnection().exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL,
      category TEXT NOT NULL
    )
  `)

  const repo = new ProductRepository(db)

  // ========================================================================
  // Populate sample data
  // ========================================================================

  const sampleProducts: Product[] = [
    {
      id: "p1",
      name: "Laptop",
      price: 999.99,
      stock: 5,
      category: "Electronics",
    },
    {
      id: "p2",
      name: "Mouse",
      price: 29.99,
      stock: 50,
      category: "Electronics",
    },
    {
      id: "p3",
      name: "Keyboard",
      price: 79.99,
      stock: 30,
      category: "Electronics",
    },
    {
      id: "p4",
      name: "Chair",
      price: 199.99,
      stock: 2,
      category: "Furniture",
    },
    {
      id: "p5",
      name: "Desk",
      price: 399.99,
      stock: 1,
      category: "Furniture",
    },
    {
      id: "p6",
      name: "Monitor",
      price: 299.99,
      stock: 8,
      category: "Electronics",
    },
  ]

  console.log("Inserting sample products...")
  for (const product of sampleProducts) {
    const query = Query.create(
      `INSERT INTO products (id, name, price, stock, category)
       VALUES (:id, :name, :price, :stock, :category)`,
      product
    )

    if (!query.isError) {
      repo.insert(query.value)
    }
  }
  console.log(`✓ Inserted ${sampleProducts.length} products\n`)

  // ========================================================================
  // Query patterns
  // ========================================================================

  // Find all products
  const allResult = repo.findAll()
  if (!allResult.isError) {
    console.log(`✓ Total products: ${allResult.value.length}`)
  }

  // Find by category
  console.log("\n--- Electronics Products ---")
  const electronicsResult = repo.findByCategory("Electronics")
  if (!electronicsResult.isError) {
    electronicsResult.value.forEach((p) => {
      console.log(`  ${p.name}: $${p.price} (stock: ${p.stock})`)
    })
  }

  // Find by price range
  console.log("\n--- Products under $100 ---")
  const budgetResult = repo.findByPriceRange(0, 100)
  if (!budgetResult.isError) {
    budgetResult.value.forEach((p) => {
      console.log(`  ${p.name}: $${p.price}`)
    })
  }

  // Find low stock
  console.log("\n--- Low Stock Products (< 5) ---")
  const lowStockResult = repo.findLowStock(5)
  if (!lowStockResult.isError) {
    lowStockResult.value.forEach((p) => {
      console.log(`  ${p.name}: ${p.stock} units`)
    })
  }

  // Count by category
  console.log("\n--- Product Count by Category ---")
  const electronicsCount = repo.countByCategory("Electronics")
  if (!electronicsCount.isError) {
    console.log(`  Electronics: ${electronicsCount.value}`)
  }

  const furnitureCount = repo.countByCategory("Furniture")
  if (!furnitureCount.isError) {
    console.log(`  Furniture: ${furnitureCount.value}`)
  }

  // ========================================================================
  // Update operations
  // ========================================================================

  console.log("\n--- Updating Stock ---")
  const updateResult = repo.updateStock("p1", 10)
  if (!updateResult.isError) {
    console.log(`✓ Updated p1 stock to 10 (${updateResult.value} row(s) affected)`)
  }

  // Verify update
  const findUpdatedResult = repo.findById("p1")
  if (!findUpdatedResult.isError && findUpdatedResult.value) {
    console.log(`✓ Verified: ${findUpdatedResult.value.name} now has ${findUpdatedResult.value.stock} stock`)
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  console.log("\n--- Inventory Statistics ---")
  const statsResult = repo.getStats()
  if (!statsResult.isError) {
    const stats = statsResult.value[0] as Record<string, unknown>
    console.log(`  Total Products: ${stats.total}`)
    console.log(`  Total Stock: ${stats.total_stock}`)
    console.log(`  Avg Price: $${parseFloat(stats.avg_price as string).toFixed(2)}`)
    console.log(`  Min Price: $${stats.min_price}`)
    console.log(`  Max Price: $${stats.max_price}`)
  }

  // ========================================================================
  // Error handling: Invalid queries
  // ========================================================================

  console.log("\n--- Error Handling ---")

  // Missing parameter
  const invalidQuery = Query.create(
    "SELECT * FROM products WHERE category = :category AND stock > :minStock",
    { category: "Electronics" }
  )

  if (invalidQuery.isError) {
    console.log(`✓ Caught missing parameter: "${invalidQuery.error}"`)
  }

  // Extra parameters
  const extraQuery = Query.create(
    "SELECT * FROM products WHERE category = :category",
    { category: "Electronics", minStock: 5 }
  )

  if (extraQuery.isError) {
    console.log(`✓ Caught extra parameter: "${extraQuery.error}"`)
  }

  // Close database
  db.close()
  console.log("\n✓ Advanced queries example completed successfully!")
}

// Run example
main().catch(console.error)
