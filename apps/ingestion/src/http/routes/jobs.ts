import { Router, type IRouter, type Request, type Response } from 'express'
import { env } from '../../config/env'
import { runResync } from '../../jobs/resync'
import { setupWatchForUser } from '../../jobs/watch'

const router: IRouter = Router()

function authGuard(req: Request, res: Response): boolean {
  const secret = req.headers['x-ingestion-secret']
  if (secret !== env.INGESTION_SHARED_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

router.post('/jobs/resync', async (req: Request, res: Response) => {
  if (!authGuard(req, res)) return

  const { user_id, max_results } = req.body as { user_id?: string; max_results?: number }
  if (!user_id) {
    res.status(400).json({ error: 'user_id required' })
    return
  }

  try {
    const processed = await runResync(user_id, max_results ?? 20)
    res.json({ ok: true, processed })
  } catch (err) {
    console.error('[/jobs/resync]', err)
    res.status(500).json({ error: String(err) })
  }
})

router.post('/jobs/watch', async (req: Request, res: Response) => {
  if (!authGuard(req, res)) return

  const { user_id } = req.body as { user_id?: string }
  if (!user_id) {
    res.status(400).json({ error: 'user_id required' })
    return
  }

  try {
    await setupWatchForUser(user_id)
    res.json({ ok: true })
  } catch (err) {
    console.error('[/jobs/watch]', err)
    res.status(500).json({ error: String(err) })
  }
})

export default router
