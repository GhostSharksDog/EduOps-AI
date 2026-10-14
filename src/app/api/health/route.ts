import {NextResponse} from 'next/server';

export async function GET() {
    let safeTestDatabase = false;
    try {
        safeTestDatabase = new URL(process.env.DATABASE_URL ?? '').pathname.endsWith('_test');
    } catch {}
    return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        testMode: safeTestDatabase && process.env.APP_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production',
    }, {status: 200});
}
