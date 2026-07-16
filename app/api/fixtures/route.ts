import { NextResponse } from "next/server";
import { getFixtures } from "@/lib/txline/client";

// TxLINE calls use the server-only API token — force the Node runtime and
// skip caching so we always read fresh fixtures.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/fixtures → World Cup fixtures from TxLINE. */
export async function GET() {
  try {
    const fixtures = await getFixtures();
    return NextResponse.json({ fixtures });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 502 },
    );
  }
}
