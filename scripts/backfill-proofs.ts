/**
 * One-off: store the TxLINE proof for every RESOLVED market — so receipts
 * survive the free-tier access ending. Run: npx tsx scripts/backfill-proofs.ts
 *
 * Proof selection mirrors lib/txline/proof.ts findAnchoredProof: the snapshot
 * array is NOT chronologically ordered, so we sort by Seq, never accept a
 * record older than the final whistle, and skip proofs that fail independent
 * Merkle recomputation. Re-runnable: overwrites any stored proof a better
 * candidate exists for.
 */
import * as fs from "fs";
import { PrismaClient } from "@prisma/client";
import { verifyProofChain } from "../lib/txline/merkle";

for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const BASE = (process.env.TXLINE_API_BASE_URL ?? "https://txline-dev.txodds.com/api").replace(/\/$/, "");
const JWT_URL = process.env.TXLINE_JWT_URL ?? "https://txline-dev.txodds.com/auth/guest/start";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFinalRecord(r: any): boolean {
  if (String(r?.Action) === "game_finalised") return true;
  const phase = String(r?.GamePhase ?? "");
  if (phase === "F" || phase === "FET" || phase === "FPE") return true;
  const st = Number(r?.StatusId ?? 0);
  return st === 5 || st === 10 || st === 13;
}

async function main() {
  const prisma = new PrismaClient();
  const { token: jwt } = await (await fetch(JWT_URL, { method: "POST" })).json();
  const H = { Authorization: `Bearer ${jwt}`, "X-Api-Token": process.env.TXLINE_API_TOKEN! };

  const rows = await prisma.market.findMany({ where: { status: "RESOLVED" } });
  console.log("resolved markets:", rows.length);

  let ok = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapCache = new Map<number, any[] | null>();
  for (const m of rows) {
    try {
      if (!snapCache.has(m.fixtureId)) {
        const r = await fetch(`${BASE}/scores/snapshot/${m.fixtureId}`, { headers: H });
        snapCache.set(m.fixtureId, r.ok ? await r.json() : null);
      }
      const snap = snapCache.get(m.fixtureId);
      if (!snap?.length) continue;

      const recs = [...snap].sort((a, b) => Number(a.Seq) - Number(b.Seq));
      const finalSeq = recs.filter(isFinalRecord).map((r) => Number(r.Seq)).pop();
      const candidates = recs
        .map((r) => Number(r.Seq))
        .filter((s) => (finalSeq == null ? true : s >= finalSeq))
        .reverse();

      const keys = (m.statKeys as number[]).filter((k) => k !== 0);
      for (const seq of candidates.slice(0, 60)) {
        const pr = await fetch(
          `${BASE}/scores/stat-validation?fixtureId=${m.fixtureId}&seq=${seq}&statKeys=${keys.join(",")}`,
          { headers: H },
        );
        if (!pr.ok) continue; // not anchored yet
        const proof = await pr.json();
        if (verifyProofChain(proof) === "mismatch") continue; // inconsistent record
        await prisma.market.update({ where: { id: m.id }, data: { proofJson: proof } });
        ok++;
        console.log(`fixture ${m.fixtureId} seq ${seq}: stored (${m.question.slice(0, 50)})`);
        break;
      }
    } catch {
      /* leave as-is */
    }
  }
  console.log("backfilled:", ok, "of", rows.length);
  await prisma.$disconnect();
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
