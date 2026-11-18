
import dns from "node:dns";

// Configure DNS before loading Mongoose
dns.setServers(["8.8.8.8", "8.8.4.4"]);

console.log("Active DNS:", dns.getServers());

const { default: mongoose } = await import("mongoose");
const { default: dotenv } = await import("dotenv");
const { default: app } = await import("./app.js");
const { default: connectDB } = await import("./config/db.js");

dotenv.config();

const port = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  app.listen(port, () => {
    console.log(`GTI COMPUTERS API running on http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error("SERVER ERROR:", error);
  process.exit(1);
});
