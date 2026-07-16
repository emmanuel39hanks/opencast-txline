/**
 * One-off: store the TxLINE proof for every RESOLVED market that settled
 * before proof persistence existed — so receipts survive the free-tier
 * access ending. Run: npx tsx scripts/backfill-proofs.ts
 */
import * as fs from "fs";
import { PrismaClient, Prisma } from "@prisma/client";

for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const BASE = (process.env.TXLINE_API_BASE_URL ?? "https://txline-dev.txodds.com/api").replace(/\/$/, "");
const JWT_URL = process.env.TXLINE_JWT_URL ?? "https://txline-dev.txodds.com/auth/guest/start";

async function main() {
  const prisma = new PrismaClient();
  const { token: jwt } = await (await fetch(JWT_URL, { method: "POST" })).json();
  const H = { Authorization: `Bearer ${jwt}`, "X-Api-Token": process.env.TXLINE_API_TOKEN! };

  const rows = await prisma.market.findMany({
    where: { status: "RESOLVED", proofJson: { equals: Prisma.DbNull } },
  });
  console.log("resolved markets missing proof:", rows.length);

  let ok = 0;
  const snapCache = new Map<number, { Seq: number }[] | null>();
  for (const m of rows) {
    try {
      if (!snapCache.has(m.fixtureId)) {
        const r = await fetch(`${BASE}/scores/snapshot/${m.fixtureId}`, { headers: H });
        snapCache.set(m.fixtureId, r.ok ? await r.json() : null);
      }
      const snap = snapCache.get(m.fixtureId);
      if (!snap?.length) continue;
      const seq = snap[snap.length - 1].Seq;
      const keys = (m.statKeys as number[]).filter((k) => k !== 0);
      const pr = await fetch(
        `${BASE}/scores/stat-validation?fixtureId=${m.fixtureId}&seq=${seq}&statKeys=${keys.join(",")}`,
        { headers: H },
      );
      if (!pr.ok) continue;
      const proof = await pr.json();
      await prisma.market.update({ where: { id: m.id }, data: { proofJson: proof } });
      ok++;
    } catch {
      /* leave missing */
    }
  }
  console.log("backfilled:", ok, "of", rows.length);
  await prisma.$disconnect();
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
