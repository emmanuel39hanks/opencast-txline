/**
 * Parse a TxLINE score snapshot (an event stream) into a clean, structured
 * match model for the UI: live score, full stats, clock, and a curated event
 * timeline. TxLINE stat keys are `period*1000 + base`; full-match (period 0) is
 * base 1..8 → 1/2 goals, 3/4 yellow, 5/6 red, 7/8 corners (P1/P2).
 */

export interface TeamStat {
  label: string;
  home: number;
  away: number;
}

export interface MatchEvent {
  seq: number;
  minute: number | null;
  /** normalized event kind for icon/labeling */
  kind:
    | "goal"
    | "penalty"
    | "yellow"
    | "red"
    | "sub"
    | "var"
    | "corner"
    | "kickoff"
    | "halftime"
    | "fulltime"
    | "injury";
  label: string;
  /** 1 = home-side participant, 2 = away-side, null = neutral */
  side: 1 | 2 | null;
}

export interface MatchData {
  fixtureId: number;
  home: string;
  away: string;
  gameState: string;
  final: boolean;
  minute: number | null;
  running: boolean;
  goals: [number, number]; // [home, away]
  stats: TeamStat[];
  timeline: MatchEvent[];
}

// Full-match stat base → [homeKey, awayKey] where P1 is home when p1IsHome.
const BASE = { goals: [1, 2], yellow: [3, 4], red: [5, 6], corners: [7, 8] };

const EVENT_MAP: Record<
  string,
  { kind: MatchEvent["kind"]; label: string; team: boolean }
> = {
  goal: { kind: "goal", label: "Goal", team: true },
  penalty: { kind: "penalty", label: "Penalty", team: true },
  penalty_outcome: { kind: "penalty", label: "Penalty", team: true },
  yellow_card: { kind: "yellow", label: "Yellow card", team: true },
  red_card: { kind: "red", label: "Red card", team: true },
  substitution: { kind: "sub", label: "Substitution", team: true },
  var: { kind: "var", label: "VAR check", team: false },
  var_end: { kind: "var", label: "VAR decision", team: false },
  corner: { kind: "corner", label: "Corner", team: true },
  kickoff: { kind: "kickoff", label: "Kick-off", team: false },
  halftime_finalised: { kind: "halftime", label: "Half-time", team: false },
  game_finalised: { kind: "fulltime", label: "Full-time", team: false },
  injury: { kind: "injury", label: "Injury", team: false },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = any;

function minuteOf(r: Rec): number | null {
  const s = r?.Clock?.Seconds;
  return typeof s === "number" ? Math.max(0, Math.floor(s / 60)) : null;
}

/** Resolve P1/P2 → home/away side given who is home. */
function sideOf(participant: unknown, p1IsHome: boolean): 1 | 2 | null {
  const p = Number(participant);
  if (p !== 1 && p !== 2) return null;
  if (p1IsHome) return p === 1 ? 1 : 2;
  return p === 1 ? 2 : 1;
}

export function parseMatch(
  fixtureId: number,
  home: string,
  away: string,
  p1IsHome: boolean,
  records: Rec[],
): MatchData {
  const last = records[records.length - 1] ?? {};
  const withStats = [...records].reverse().find((r) => r?.Stats) ?? {};
  const S = (withStats.Stats ?? {}) as Record<string, number>;
  const val = (k: number) => Number(S[String(k)] ?? 0);

  // P1/P2 → home/away
  const pick = ([kHome, kAway]: number[]): [number, number] =>
    p1IsHome ? [val(kHome), val(kAway)] : [val(kAway), val(kHome)];

  const goals = pick(BASE.goals);
  const yellow = pick(BASE.yellow);
  const red = pick(BASE.red);
  const corners = pick(BASE.corners);

  const stats: TeamStat[] = [
    { label: "Goals", home: goals[0], away: goals[1] },
    { label: "Corners", home: corners[0], away: corners[1] },
    { label: "Yellow cards", home: yellow[0], away: yellow[1] },
    { label: "Red cards", home: red[0], away: red[1] },
  ];

  const gameState = String(last.GameState ?? "scheduled");

  const timeline: MatchEvent[] = [];
  const seenGoalCard = new Set<string>();
  for (const r of records) {
    const spec = EVENT_MAP[String(r?.Action)];
    if (!spec) continue;
    const side = spec.team ? sideOf(r?.Participant, p1IsHome) : null;
    // de-dupe repeated goal/card emissions at the same seq/side
    if (spec.kind === "goal" || spec.kind === "yellow" || spec.kind === "red") {
      const key = `${spec.kind}:${minuteOf(r)}:${side}`;
      if (seenGoalCard.has(key)) continue;
      seenGoalCard.add(key);
    }
    timeline.push({
      seq: Number(r?.Seq ?? 0),
      minute: minuteOf(r),
      kind: spec.kind,
      label: spec.label,
      side,
    });
  }

  // Finality can be flagged anywhere in the history (game_finalised action,
  // GamePhase F, or the GameState string) — not just on the last record.
  const final =
    /final|finish|end/i.test(gameState) ||
    timeline.some((e) => e.kind === "fulltime") ||
    records.some((r) =>
      ["F", "FET", "FPE"].includes(String(r?.GamePhase ?? "")),
    );

  return {
    fixtureId,
    home,
    away,
    gameState,
    final,
    minute: minuteOf(last),
    running: Boolean(last?.Clock?.Running),
    goals: [goals[0], goals[1]],
    stats,
    timeline,
  };
}
