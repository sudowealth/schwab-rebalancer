interface Env {
  // KV Namespaces
  CACHE: KVNamespace;
  CONFIG: KVNamespace;

  // D1 Database
  DB: D1Database;

  // R2 Bucket
  EXPORTS: R2Bucket;

  // Environment Variables
  INDIVIDUAL_USE: string;
  RESEND_API_KEY: string;
}
