import { Router, type IRouter } from 'express'
import { logIngestionEvent } from '../../storage/supabase'

const router: IRouter = Router()

router.get('/health', async (_req, res) => {
  await logIngestionEvent({ event_type: 'health_check', status: 'ok' })
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

export default router
