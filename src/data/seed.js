import "dotenv/config";
import connectDB from "../config/db.js";
import Category from "../models/Category.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import categories from "./categories.js";
import products from "./products.js";

const seed = async () => {
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    console.error(
      "Refusing to run destructive seed. Set ALLOW_DESTRUCTIVE_SEED=true only for a disposable development database.\n" +
      "To enrich an existing catalog without deleting data, run: npm run catalog:sync"
    );
    process.exit(1);
  }

  await connectDB();
  await Promise.all([Product.deleteMany({}), Order.deleteMany({})]);
  await Product.insertMany(products);
  await Category.bulkWrite(
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

  if (process.env.ADMIN_PASSWORD) {
    const admin = await User.findOne({ email: process.env.ADMIN_EMAIL || "admin@gticomputers.lk" });
    if (admin) {
      admin.name = process.env.ADMIN_NAME || "GTI COMPUTERS Admin";
      admin.password = process.env.ADMIN_PASSWORD;
      admin.role = "admin";
      await admin.save();
    } else {
      await User.create({
        name: process.env.ADMIN_NAME || "GTI COMPUTERS Admin",
        email: process.env.ADMIN_EMAIL || "admin@gticomputers.lk",
        password: process.env.ADMIN_PASSWORD,
        role: "admin"
      });
    }
  }

  console.log("Products and categories seeded. Admin is created only when ADMIN_PASSWORD is set.");
  process.exit(0);
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
