import "dotenv/config";
import connectDB from "../config/db.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import categories from "./categories.js";
import products from "./products.js";

/**
 * Non-destructive GTI catalog sync.
 *
 * - Adds/updates the category registry.
 * - Adds brand + filter specs to the known GTI seed products (matched by slug).
 * - Never deletes products, orders, users or settings.
 *
 * It is safe to run repeatedly after deploying catalog/schema changes.
 */
const syncCatalog = async () => {
  await connectDB();

  const categoryResult = await Category.bulkWrite(
    categories.map((category) => ({
      updateOne: {
        filter: { slug: category.slug },
        update: {
          $set: {
            name: category.name,
            order: category.order,
            description: category.description,
            active: true,
            showInNav: true
          }
        },
        upsert: true
      }
    }))
  );

  // Only update existing GTI products. Do not create or remove products: this
  // script is intended for schema/data enrichment, not destructive seeding.
  const productResult = await Product.bulkWrite(
    products.map((product) => ({
      updateOne: {
        filter: { slug: product.slug },
        update: {
          $set: {
            brand: product.brand || "",
            specs: product.specs || [],
            category: product.category
          }
        }
      }
    }))
  );

  const dbName = Product.db.name;
  console.log(`Catalog synced in database "${dbName}".`);
  console.log(`Categories upserted: ${categoryResult.upsertedCount + categoryResult.modifiedCount}`);
  console.log(`Products updated: ${productResult.modifiedCount}/${products.length}`);
  process.exit(0);
};

syncCatalog().catch((error) => {
  console.error("Catalog sync failed:", error);
  process.exit(1);
});
