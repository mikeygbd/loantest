import { NextResponse } from 'next/server';
import { initDB, getSubmissions } from '@/lib/db';

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json([]);
  }
  try {
    await initDB();
    const rows = await getSubmissions();
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
