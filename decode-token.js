const jwt = require('jsonwebtoken');

// This is the token from the request
const token = "eyJhbGciOiJIUzI1NiIsImtpZCI6IktLSHNJQWxXQ2VDSVRHWU0iLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3JsYnZ2YmFydHlpYWtoaW9zeHJ4LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI3MDA2MjNkYi04ZWNkLTRjZDUtOTcwMS01MjEwNjYyZTEwMGMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYxODY4MDA2LCJpYXQiOjE3NjE4NjQ0MDYsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYxODY0NDA2fV0sInNlc3Npb25faWQiOiJjM2Y2MWUyMi0wMGVhLTRlNWQtODZkZC01MTg0Y2JjODYzMzIiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.VCjVs8JIZRPh6CUiHJ8XQkvc0qWvGhneH5FsILl1OPY";

console.log('\n=== JWT TOKEN ANALYSIS ===\n');

const decoded = jwt.decode(token, { complete: true });

if (!decoded) {
  console.log('❌ Failed to decode token');
  process.exit(1);
}

console.log('📋 Token Header:');
console.log(JSON.stringify(decoded.header, null, 2));

console.log('\n📋 Token Payload:');
console.log(JSON.stringify(decoded.payload, null, 2));

console.log('\n🔍 Key Information:');
console.log('- Algorithm:', decoded.header.alg);
console.log('- User ID (sub):', decoded.payload.sub);
console.log('- Email:', decoded.payload.email);
console.log('- Role:', decoded.payload.role);
console.log('- Issued At:', new Date(decoded.payload.iat * 1000).toISOString());
console.log('- Expires At:', new Date(decoded.payload.exp * 1000).toISOString());
console.log('- Is Expired:', Date.now() > decoded.payload.exp * 1000 ? 'YES ❌' : 'NO ✅');

console.log('\n=========================\n');
