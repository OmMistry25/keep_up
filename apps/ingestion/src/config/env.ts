function require(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export const env = {
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  SUPABASE_URL: require('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: require('SUPABASE_SERVICE_ROLE_KEY'),
  GOOGLE_CLIENT_ID: require('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: require('GOOGLE_CLIENT_SECRET'),
  ENCRYPTION_KEY: require('ENCRYPTION_KEY'),
  PUBSUB_VERIFICATION_TOKEN: process.env.PUBSUB_VERIFICATION_TOKEN ?? '',
  INGESTION_SHARED_SECRET: require('INGESTION_SHARED_SECRET'),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  LLM_ENABLED: process.env.LLM_ENABLED === 'true',
  ZAPIER_WEBHOOK_URL: process.env.ZAPIER_WEBHOOK_URL ?? '',
}
