import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Always load backend/.env, no matter which folder you start node from
const here = path.dirname(fileURLToPath(import.meta.url));
const result = dotenv.config({ path: path.join(here, ".env") });

if (result.error) {
  console.warn("Could not load backend/.env:", result.error.message);
} else {
  console.log("Loaded .env | GOOGLE_CLIENT_ID set:", !!process.env.GOOGLE_CLIENT_ID);
}