function require(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

// ─── Public (safe to expose to browser) ──────────────────────────
export const SUPABASE_URL = require('NEXT_PUBLIC_SUPABASE_URL')
export const SUPABASE_ANON_KEY = require('NEXT_PUBLIC_SUPABASE_ANON_KEY')

// ─── Server-only (never sent to browser) ─────────────────────────
export function getServerEnv() {
  return {
    SUPABASE_SERVICE_ROLE_KEY: require('SUPABASE_SERVICE_ROLE_KEY'),
    GOOGLE_CLIENT_ID: require('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: require('GOOGLE_CLIENT_SECRET'),
    INGESTION_BASE_URL: require('INGESTION_BASE_URL'),
    INGESTION_SHARED_SECRET: require('INGESTION_SHARED_SECRET'),
  }
}
