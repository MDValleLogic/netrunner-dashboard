import { neon } from "@neondatabase/serverless";

let _client: ReturnType<typeof neon> | null = null;

function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!_client) _client = neon(url);
  return _client;
}

// Export a tag function so existing code can keep using: await sql`...`
export const sql: ReturnType<typeof neon> = ((...args: any[]) =>
  (getClient() as any)(...args)) as any;

