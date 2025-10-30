const jwt = require("jsonwebtoken");
require("dotenv").config();

const token =
  "eyJhbGciOiJIUzI1NiIsImtpZCI6IktLSHNJQWxXQ2VDSVRHWU0iLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3JsYnZ2YmFydHlpYWtoaW9zeHJ4LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI3MDA2MjNkYi04ZWNkLTRjZDUtOTcwMS01MjEwNjYyZTEwMGMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYxODY4MDA2LCJpYXQiOjE3NjE4NjQ0MDYsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYxODY0NDA2fV0sInNlc3Npb25faWQiOiJjM2Y2MWUyMi0wMGVhLTRlNWQtODZkZC01MTg0Y2JjODYzMzIiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.VCjVs8JIZRPh6CUiHJ8XQkvc0qWvGhneH5FsILl1OPY";

const secret = process.env.SUPABASE_JWT_SECRET;

console.log("\n=== JWT VERIFICATION ===\n");
console.log(
  "Secret from .env (first 30 chars):",
  secret?.substring(0, 30) + "..."
);
console.log("Secret length:", secret?.length);

if (!secret) {
  console.log("❌ SUPABASE_JWT_SECRET not found in .env");
  process.exit(1);
}

try {
  const verified = jwt.verify(token, secret, { algorithms: ["HS256"] });
  console.log("✅ TOKEN VERIFIED SUCCESSFULLY!");
  console.log("\nUser ID:", verified.sub);
  console.log("Email:", verified.email);
} catch (error) {
  console.log("❌ TOKEN VERIFICATION FAILED");
  console.log("Error:", error.message);

  if (error.message.includes("invalid signature")) {
    console.log("\n🔴 ISSUE: JWT Secret is WRONG!");
    console.log(
      "The secret in .env does not match the secret Supabase used to sign the token."
    );
  }
}

console.log("\n=========================\n");
