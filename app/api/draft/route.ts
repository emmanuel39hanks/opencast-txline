import { NextResponse } from "next/server";
import { getAllTournamentFixtures } from "@/lib/txline/client";
import { COMPARISON } from "@/lib/txline/strategy";
import { zerogJson, ZEROG_PROVENANCE, type ChatMessage } from "@/lib/zerog/inference";
import type { TxFixture } from "@/lib/txline/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Soccer ScoreStat base keys, [P1, P2]. Real key = period*1000 + base
// (period 0 = full match, 1 = first half, 2 = second half).
const K = { goals: [1, 2], yellow: [3, 4], red: [5, 6], corners: [7, 8] } as const;
type Kind = keyof typeof K;

/** ScoreStat key for a team's stat: period-aware, side-aware. */
function keyFor(kind: Kind, isP1: boolean, period = 0) {
  return period * 1000 + K[kind][isP1 ? 0 : 1];
}

// Every prediction type below compiles to a SINGLE `validate_stat_v2` predicate:
//   single stat  (stat_key_b == 0):  a            <cmp> threshold
//   binary stat  (stat_key_b != 0):  (a − b)      <cmp> threshold
// so every market — winner or "funny" prop — is provable the same way.
type BetType =
  | "winner"
  | "double_chance"
  | "spread"
  | "draw"
  | "goals_over"
  | "clean_sheet"
  | "corners_over"
  | "booking"
  | "red_card"
  | "first_half_winner"
  | "first_half_goal";

const BET_TYPES: BetType[] = [
  "winner",
  "double_chance",
  "spread",
  "draw",
  "goals_over",
  "clean_sheet",
  "corners_over",
  "booking",
  "red_card",
  "first_half_winner",
  "first_half_goal",
];

interface DraftPick {
  fixtureId: number;
  betType: BetType;
  /** Team the prediction is about (must match a participant); ignored for draw. */
  subject: string;
  /** Threshold count for over/spread/booking predictions, e.g. 2 for "2+ goals". */
  line: number;
  /** Model's estimate of the YES outcome's probability (0..1) — the parlay quote. */
  impliedProb: number;
  reasoning: string;
  confidence: number;
}

/**
 * POST /api/draft { question } — AI market intake.
 *
 * The model matches a natural-language question to a live World Cup fixture and
 * classifies it into a supported market type. The TxLINE settlement predicate
 * (stat keys / threshold / comparison) is then derived DETERMINISTICALLY here —
 * the LLM never invents settlement math, it only picks the fixture, market type,
 * team, and line. Every predicate is a single `validate_stat_v2` check, so
 * every market — moneyline or a "funny" prop — is provable on-chain the same way.
 */
export async function POST(req: Request) {
  try {
    const { question } = (await req.json()) as { question?: string };
    if (!question || question.trim().length < 3) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }

    const allFixtures = await getAllTournamentFixtures();
    if (!allFixtures.length) {
      return NextResponse.json(
        { error: "No World Cup fixtures available right now." },
        { status: 409 },
      );
    }

    // Markets can only be created before kickoff — once the ball rolls the
    // result starts leaking, and after full-time it's known. Filter the
    // fixture menu down to matches that haven't started yet.
    const fixtures = allFixtures.filter(
      (fx) => new Date(fx.StartTime).getTime() > Date.now(),
    );
    if (!fixtures.length) {
      return NextResponse.json({
        ok: false as const,
        unprovable: true as const,
        message:
          "Every World Cup fixture has kicked off or finished — markets can only be created before kickoff, so there's nothing left to predict this tournament. Existing markets still settle and pay out automatically.",
        suggestions: [],
      });
    }

    const menu = fixtures.slice(0, 110).map((fx) => ({
      id: fx.FixtureId,
      home: fx.Participant1IsHome ? fx.Participant1 : fx.Participant2,
      away: fx.Participant1IsHome ? fx.Participant2 : fx.Participant1,
      kickoff: new Date(fx.StartTime).toISOString().slice(0, 16),
    }));

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You turn a fan's natural-language question into a verifiable World Cup prediction market. " +
          "Pick the single fixture it's about, classify the market type, the team, and any line. " +
          "Respond ONLY with JSON: " +
          '{"fixtureId":number,"betType":string,"subject":string,"line":number,"impliedProb":number,"reasoning":string,"confidence":number}. ' +
          "`impliedProb` is your best estimate (0..1) of the probability the YES outcome actually happens — used to price a parlay leg. " +
          "betType is one of:\n" +
          "- 'winner': a team wins the match\n" +
          "- 'double_chance': a team wins OR draws (i.e. doesn't lose)\n" +
          "- 'spread': a team wins by `line`+ goals (handicap / win margin)\n" +
          "- 'draw': the match ends level\n" +
          "- 'goals_over': a team scores `line`+ goals\n" +
          "- 'clean_sheet': a team keeps a clean sheet (opponent scores 0)\n" +
          "- 'corners_over': a team wins `line`+ corners\n" +
          "- 'booking': a team gets `line`+ yellow cards (use line 1 for 'gets booked')\n" +
          "- 'red_card': a team gets a red card\n" +
          "- 'first_half_winner': a team leads at half-time\n" +
          "- 'first_half_goal': a team scores in the first half\n" +
          "`subject` MUST be exactly one team name from the chosen fixture (ignored for 'draw'). " +
          "`line` is the number for over/spread/booking predictions (e.g. 2 for '2+ goals', 2 for 'win by 2+'); use 0 otherwise. " +
          "confidence is 0..1; if nothing matches well pick the closest fixture with confidence below 0.4.",
      },
      { role: "user", content: `Question: ${question}\n\nFixtures:\n${JSON.stringify(menu)}` },
    ];

    // AI first; if it fails or picks a ghost fixture, fall back to a
    // deterministic parse so common questions never dead-end on model flakes.
    let pick: DraftPick | null = null;
    try {
      pick = await zerogJson<DraftPick>(messages, { maxTokens: 700 });
    } catch {
      pick = null;
    }
    let fx = pick
      ? fixtures.find((f) => f.FixtureId === Number(pick!.fixtureId))
      : undefined;
    if (!fx || !pick) {
      const fb = fallbackPick(question, fixtures);
      if (!fb) {
        // Nothing provable found — answer 200 with guidance, not an error.
        return NextResponse.json({
          ok: false as const,
          unprovable: true as const,
          message:
            "Markets settle against TxLINE match stats — goals, cards, corners, halves — so the prediction needs a team and a provable stat on an upcoming fixture (markets lock at kickoff).",
          suggestions: [
            "Will Argentina win the final?",
            "France to score 2+ goals",
            "Spain to keep a clean sheet",
            "England to win 5+ corners",
            "Will the final end in a draw?",
          ],
        });
      }
      pick = fb.pick;
      fx = fb.fx;
    }

    const home = fx.Participant1IsHome ? fx.Participant1 : fx.Participant2;
    const away = fx.Participant1IsHome ? fx.Participant2 : fx.Participant1;
    const strat = buildStrategy(fx, pick, home, away);

    return NextResponse.json({
      ok: true as const,
      fixtureId: fx.FixtureId,
      home,
      away,
      kickoff: new Date(fx.StartTime).toISOString(),
      betType: strat.betType,
      betTypeLabel: strat.betTypeLabel,
      subject: strat.subject,
      ...strat.predicate,
      question: strat.question,
      yesLabel: strat.yesLabel,
      noLabel: strat.noLabel,
      resolves: strat.resolves,
      // Clamp the quote so no single leg is a near-certainty or a moonshot.
      impliedProb: Math.max(0.05, Math.min(0.95, Number(pick.impliedProb) || 0.5)),
      reasoning: String(pick.reasoning ?? "").slice(0, 400),
      confidence: Math.max(0, Math.min(1, Number(pick.confidence) || 0)),
      provenance: ZEROG_PROVENANCE,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * Deterministic fallback when the model flakes: find the team named in the
 * question, prefer its LATEST fixture (so "the final" lands on the final),
 * and classify the market type by keywords. Returns null when no team matches —
 * the route then answers with guidance instead of an error.
 */
function fallbackPick(
  question: string,
  fixtures: TxFixture[],
): { pick: DraftPick; fx: TxFixture } | null {
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(question);

  // Latest fixture per matching team (later kickoff = knockout/final).
  let best: { fx: TxFixture; team: string; start: number } | null = null;
  for (const fx of fixtures) {
    for (const team of [fx.Participant1, fx.Participant2]) {
      if (!q.includes(norm(team))) continue;
      const start = new Date(fx.StartTime).getTime();
      if (!best || start > best.start) best = { fx, team, start };
    }
  }
  if (!best) return null;

  const lineMatch = q.match(/(\d+)\s*\+|\bby\s+(\d+)|\b(\d+)\s+or more/);
  const line = Number(lineMatch?.[1] ?? lineMatch?.[2] ?? lineMatch?.[3] ?? 0);

  let betType: BetType = "winner";
  if (/\bdraw|ends? level|tie\b/.test(q)) betType = "draw";
  else if (/clean sheet|shut ?out/.test(q)) betType = "clean_sheet";
  else if (/corner/.test(q)) betType = "corners_over";
  else if (/red card|sent off|see red/.test(q)) betType = "red_card";
  else if (/yellow|book|card/.test(q)) betType = "booking";
  else if (/half[- ]?time|first half|1h|at the break/.test(q))
    betType = /lead|ahead|win/.test(q) ? "first_half_winner" : "first_half_goal";
  else if (/score|goals?\b/.test(q) && line > 0) betType = "goals_over";
  else if (/win by|margin|by \d/.test(q) && line > 0) betType = "spread";
  else if (/avoid defeat|not lose|or draw/.test(q)) betType = "double_chance";

  return {
    fx: best.fx,
    pick: {
      fixtureId: best.fx.FixtureId,
      betType,
      subject: best.team,
      line: line || (betType === "goals_over" ? 2 : 1),
      impliedProb: 0.5,
      reasoning: "Matched deterministically from the question wording.",
      confidence: 0.55,
    },
  };
}

function buildStrategy(
  fx: TxFixture,
  pick: DraftPick,
  home: string,
  away: string,
) {
  // Resolve the subject to an actual participant name.
  const subject =
    [fx.Participant1, fx.Participant2].find(
      (n) => n.toLowerCase() === String(pick.subject).toLowerCase(),
    ) ?? home;
  const opponent = subject === fx.Participant1 ? fx.Participant2 : fx.Participant1;
  const subjIsP1 = subject === fx.Participant1;
  const homeIsP1 = fx.Participant1IsHome;
  const line = Math.max(1, Math.round(Number(pick.line) || 1));
  const betType: BetType = BET_TYPES.includes(pick.betType)
    ? pick.betType
    : "winner";

  const GT = COMPARISON.GT;
  const LT = COMPARISON.LT;
  const EQ = COMPARISON.EQ;

  switch (betType) {
    // (subj_goals − opp_goals) > line−1  ⇔  win by ≥ line
    case "spread":
      return {
        betType,
        betTypeLabel: "Winning margin",
        subject,
        predicate: {
          statKeyA: keyFor("goals", subjIsP1),
          statKeyB: keyFor("goals", !subjIsP1),
          threshold: line - 1,
          comparison: GT,
        },
        question: `Will ${subject} beat ${opponent} by ${line}+?`,
        yesLabel: `${subject} −${line}`,
        noLabel: `${opponent} +${line}`,
        resolves: `Resolves YES if ${subject} wins by ${line} or more goals.`,
      };

    // (subj_goals − opp_goals) > −1  ⇔  subj_goals ≥ opp_goals  ⇔  win or draw
    case "double_chance":
      return {
        betType,
        betTypeLabel: "Double chance",
        subject,
        predicate: {
          statKeyA: keyFor("goals", subjIsP1),
          statKeyB: keyFor("goals", !subjIsP1),
          threshold: -1,
          comparison: GT,
        },
        question: `Will ${subject} avoid defeat vs ${opponent}?`,
        yesLabel: `${subject} or draw`,
        noLabel: `${opponent} wins`,
        resolves: `Resolves YES if ${subject} wins or draws.`,
      };

    case "goals_over":
      return {
        betType,
        betTypeLabel: "Team goals",
        subject,
        predicate: {
          statKeyA: keyFor("goals", subjIsP1),
          statKeyB: 0,
          threshold: line - 1,
          comparison: GT,
        },
        question: `Will ${subject} score ${line}+ goals?`,
        yesLabel: `${line}+ goals`,
        noLabel: `Under ${line}`,
        resolves: `Resolves YES if ${subject} scores ${line} or more goals.`,
      };

    // opponent_goals < 1  ⇔  opponent fails to score
    case "clean_sheet":
      return {
        betType,
        betTypeLabel: "Clean sheet",
        subject,
        predicate: {
          statKeyA: keyFor("goals", !subjIsP1),
          statKeyB: 0,
          threshold: 1,
          comparison: LT,
        },
        question: `Will ${subject} keep a clean sheet?`,
        yesLabel: "Clean sheet",
        noLabel: "Concedes",
        resolves: `Resolves YES if ${opponent} fails to score (${subject} keeps a clean sheet).`,
      };

    case "corners_over":
      return {
        betType,
        betTypeLabel: "Team corners",
        subject,
        predicate: {
          statKeyA: keyFor("corners", subjIsP1),
          statKeyB: 0,
          threshold: line - 1,
          comparison: GT,
        },
        question: `Will ${subject} win ${line}+ corners?`,
        yesLabel: `${line}+ corners`,
        noLabel: `Under ${line}`,
        resolves: `Resolves YES if ${subject} is awarded ${line} or more corners.`,
      };

    case "booking":
      return {
        betType,
        betTypeLabel: "Bookings",
        subject,
        predicate: {
          statKeyA: keyFor("yellow", subjIsP1),
          statKeyB: 0,
          threshold: line - 1,
          comparison: GT,
        },
        question:
          line > 1
            ? `Will ${subject} pick up ${line}+ bookings?`
            : `Will ${subject} get booked?`,
        yesLabel: line > 1 ? `${line}+ cards` : "Booked",
        noLabel: line > 1 ? `Under ${line}` : "No card",
        resolves: `Resolves YES if ${subject} receives ${line} or more yellow cards.`,
      };

    // subj_red > 0  ⇔  a player is sent off
    case "red_card":
      return {
        betType,
        betTypeLabel: "Red card",
        subject,
        predicate: {
          statKeyA: keyFor("red", subjIsP1),
          statKeyB: 0,
          threshold: 0,
          comparison: GT,
        },
        question: `Will ${subject} get a red card?`,
        yesLabel: "Red card",
        noLabel: "No red",
        resolves: `Resolves YES if ${subject} has a player sent off (red card).`,
      };

    // First-half goal difference > 0
    case "first_half_winner":
      return {
        betType,
        betTypeLabel: "Half-time lead",
        subject,
        predicate: {
          statKeyA: keyFor("goals", subjIsP1, 1),
          statKeyB: keyFor("goals", !subjIsP1, 1),
          threshold: 0,
          comparison: GT,
        },
        question: `Will ${subject} lead at half-time?`,
        yesLabel: `${subject} 1H`,
        noLabel: "Not ahead",
        resolves: `Resolves YES if ${subject} is ahead at half-time.`,
      };

    // First-half goals for subject > 0
    case "first_half_goal":
      return {
        betType,
        betTypeLabel: "First-half goal",
        subject,
        predicate: {
          statKeyA: keyFor("goals", subjIsP1, 1),
          statKeyB: 0,
          threshold: 0,
          comparison: GT,
        },
        question: `Will ${subject} score in the first half?`,
        yesLabel: "1H goal",
        noLabel: "No 1H goal",
        resolves: `Resolves YES if ${subject} scores in the first half.`,
      };

    case "draw":
      return {
        betType,
        betTypeLabel: "Draw",
        subject: home,
        predicate: {
          statKeyA: keyFor("goals", homeIsP1),
          statKeyB: keyFor("goals", !homeIsP1),
          threshold: 0,
          comparison: EQ,
        },
        question: `Will ${home} vs ${away} end in a draw?`,
        yesLabel: "Draw",
        noLabel: "No draw",
        resolves: `Resolves YES if ${home} and ${away} finish level.`,
      };

    case "winner":
    default:
      return {
        betType: "winner" as BetType,
        betTypeLabel: "Match winner",
        subject,
        predicate: {
          statKeyA: keyFor("goals", subjIsP1),
          statKeyB: keyFor("goals", !subjIsP1),
          threshold: 0,
          comparison: GT,
        },
        question: `Will ${subject} beat ${opponent}?`,
        yesLabel: subject,
        noLabel: opponent,
        resolves: `Resolves YES if ${subject} scores more goals than ${opponent}.`,
      };
  }
}
