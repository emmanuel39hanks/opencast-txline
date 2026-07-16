/**
 * World Cup teams are national sides, so we render country flags (flagcdn.com)
 * rather than club crests. Maps a team name → ISO 3166-1 code and a flag URL,
 * plus a helper to pull the two teams out of a fixture-backed market.
 */
import type { Market } from "@/lib/types";

const ISO: Record<string, string> = {
  France: "fr",
  Spain: "es",
  England: "gb-eng",
  Scotland: "gb-sct",
  Wales: "gb-wls",
  Argentina: "ar",
  Netherlands: "nl",
  Japan: "jp",
  Brazil: "br",
  Germany: "de",
  Portugal: "pt",
  Italy: "it",
  Belgium: "be",
  Croatia: "hr",
  Uruguay: "uy",
  Mexico: "mx",
  "United States": "us",
  USA: "us",
  Canada: "ca",
  Morocco: "ma",
  Senegal: "sn",
  Ghana: "gh",
  Nigeria: "ng",
  Cameroon: "cm",
  "Ivory Coast": "ci",
  "Côte d'Ivoire": "ci",
  Colombia: "co",
  Ecuador: "ec",
  Peru: "pe",
  Chile: "cl",
  Australia: "au",
  "South Korea": "kr",
  "Korea Republic": "kr",
  "Saudi Arabia": "sa",
  Qatar: "qa",
  Iran: "ir",
  Switzerland: "ch",
  Denmark: "dk",
  Sweden: "se",
  Norway: "no",
  Poland: "pl",
  Serbia: "rs",
  Austria: "at",
  Egypt: "eg",
  Tunisia: "tn",
  Algeria: "dz",
  "Costa Rica": "cr",
  Panama: "pa",
  Paraguay: "py",
  "New Zealand": "nz",
  Turkey: "tr",
  Ukraine: "ua",
  Greece: "gr",
  Czechia: "cz",
  "Czech Republic": "cz",
  Romania: "ro",
  Hungary: "hu",
  "South Africa": "za",
  Curaçao: "cw",
  Curacao: "cw",
  Suisse: "ch",
  "Bosnia & Herzegovina": "ba",
  "Bosnia and Herzegovina": "ba",
  "Cape Verde": "cv",
  "Congo DR": "cd",
  "DR Congo": "cd",
  Haiti: "ht",
  Iraq: "iq",
  Jordan: "jo",
  Uzbekistan: "uz",
};

// Accent/case-insensitive index so feed spelling variants still resolve.
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
const ISO_NORM: Record<string, string> = Object.fromEntries(
  Object.entries(ISO).map(([name, code]) => [norm(name), code]),
);

/** Flag image URL for a team/country name (null if unknown). */
export function teamFlagUrl(name?: string | null): string | null {
  if (!name) return null;
  const iso = ISO[name.trim()] ?? ISO_NORM[norm(name)];
  return iso ? `https://flagcdn.com/w80/${iso}.png` : null;
}

/** Resolve the home/away teams for a fixture-backed market. */
export function teamsFromMarket(m: Market): { home?: string; away?: string } {
  const anyM = m as unknown as {
    home?: string;
    away?: string;
    yesLabel?: string;
    noLabel?: string;
  };
  // 1. Explicit fixture teams from the API — always right, works for props.
  if (anyM.home && anyM.away) return { home: anyM.home, away: anyM.away };
  // 2. Parse "Will X beat Y?" questions.
  const match = /Will (.+?) beat (.+?)\??$/i.exec(m.question ?? "");
  if (match) return { home: match[1], away: match[2] };
  // 3. Outcome labels — only when BOTH resolve to a real country. Prop
  //    markets label outcomes "2+ goals" / "Under 2", which are not teams.
  const { yesLabel, noLabel } = anyM;
  if (yesLabel && noLabel && teamFlagUrl(yesLabel) && teamFlagUrl(noLabel)) {
    return { home: yesLabel, away: noLabel };
  }
  return {};
}
