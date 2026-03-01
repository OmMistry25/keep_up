import 'dotenv/config'
import express from 'express'
import { env } from './config/env'
import healthRouter from './http/routes/health'
import jobsRouter from './http/routes/jobs'

const app = express()
app.use(express.json())
app.use(healthRouter)
app.use(jobsRouter)

app.listen(env.PORT, () => {
  console.log(`Ingestion service running on port ${env.PORT}`)
})
