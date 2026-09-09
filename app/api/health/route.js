import { NextResponse } from 'next/server';
import { getServerConfig } from '@/lib/config';

export async function GET() {
  const config = getServerConfig();
  return NextResponse.json({
    ok: config.configured,
    app: 'Threads Scout V2',
    version: '2.0.0',
    configured: config.configured,
    missing: config.missing,
  });
}
