import { getAccessToken } from '../gmail/oauth'
import { setupWatch } from '../gmail/watch'
import { updateWatch } from '../storage/supabase'
import { env } from '../config/env'

export async function setupWatchForUser(userId: string): Promise<void> {
  if (!env.PUBSUB_TOPIC_NAME) throw new Error('PUBSUB_TOPIC_NAME is not set')

  const accessToken = await getAccessToken(userId)
  const { historyId, expiration } = await setupWatch(accessToken, env.PUBSUB_TOPIC_NAME)
  await updateWatch(userId, historyId, expiration)

  console.log(`[watch] Watch set up for user ${userId}, historyId=${historyId}`)
}
