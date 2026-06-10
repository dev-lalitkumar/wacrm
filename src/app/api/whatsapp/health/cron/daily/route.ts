import { NextResponse } from 'next/server'
import { runDailyHealthCheck } from '@/lib/whatsapp/onboarding/health'

export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  }
  if (request.headers.get('x-cron-secret') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runDailyHealthCheck()
  return NextResponse.json(result)
}
