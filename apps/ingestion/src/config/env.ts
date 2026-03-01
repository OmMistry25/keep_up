function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export const env = {
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  GOOGLE_CLIENT_ID: requireEnv('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: requireEnv('GOOGLE_CLIENT_SECRET'),
  ENCRYPTION_KEY: requireEnv('ENCRYPTION_KEY'),
  PUBSUB_VERIFICATION_TOKEN: process.env.PUBSUB_VERIFICATION_TOKEN ?? '',
  PUBSUB_TOPIC_NAME: process.env.PUBSUB_TOPIC_NAME ?? '',
  INGESTION_SHARED_SECRET: requireEnv('INGESTION_SHARED_SECRET'),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  LLM_ENABLED: process.env.LLM_ENABLED === 'true',
  ZAPIER_WEBHOOK_URL: process.env.ZAPIER_WEBHOOK_URL ?? '',
}
