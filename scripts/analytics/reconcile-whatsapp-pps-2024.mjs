#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (!token.startsWith("--")) continue;
  const separator = token.indexOf("=");
  if (separator >= 0) {
    args.set(token.slice(2, separator), token.slice(separator + 1));
  } else {
    args.set(token.slice(2), process.argv[index + 1]);
    index += 1;
  }
}

for (const required of ["messages", "launches", "institutions"]) {
  if (!args.get(required)) throw new Error(`Falta --${required}`);
}

const messages = JSON.parse(readFileSync(resolve(args.get("messages")), "utf8"));
const launches = JSON.parse(readFileSync(resolve(args.get("launches")), "utf8"));
const institutions = JSON.parse(readFileSync(resolve(args.get("institutions")), "utf8"));

const STOP_WORDS = new Set([
  "pps",
  "convocatoria",
  "nueva",
  "programa",
  "proyecto",
  "dispositivo",
  "instituto",
  "institucion",
  "centro",
  "fundacion",
  "asociacion",
  "civil",
  "salud",
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "y",
  "en",
  "para",
]);

function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function tokens(text) {
  return new Set(
    normalize(text)
      .split(/\s+/u)
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
  );
}

function similarity(reference, evidence) {
  const referenceTokens = tokens(reference);
  const evidenceTokens = tokens(evidence);
  if (referenceTokens.size === 0) return 0;
  const overlap = [...referenceTokens].filter((token) => evidenceTokens.has(token)).length;
  const containment = overlap / referenceTokens.size;
  const union = new Set([...referenceTokens, ...evidenceTokens]).size;
  const jaccard = union === 0 ? 0 : overlap / union;
  return Number((0.9 * containment + 0.1 * jaccard).toFixed(4));
}

function groupLaunchesByName(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = normalize(row.nombre_pps);
    if (!grouped.has(key)) grouped.set(key, { name: row.nombre_pps, rows: [] });
    grouped.get(key).rows.push(row);
  }
  return [...grouped.values()];
}

const launchGroups = groupLaunchesByName(launches);
const candidates = messages.filter(
  (message) =>
    !message.isSystem && (message.signalScore >= 4 || [902, 1114].includes(message.lineStart))
);

const matches = candidates.map((message) => {
  const dbMatches = launchGroups
    .map((group) => ({
      name: group.name,
      score: similarity(group.name, message.textRedacted),
      ids: group.rows.map((row) => row.id),
      dates: group.rows.map((row) => row.fecha_inicio),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  const institutionMatches = institutions
    .map((institution) => ({
      id: institution.id,
      name: institution.nombre,
      score: similarity(institution.nombre, message.textRedacted),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  return { message, dbMatches, institutionMatches };
});

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

const columns = [
  "date_time",
  "evidence_lines",
  "message_kind_hint",
  "text_excerpt",
  "db_match_1",
  "db_score_1",
  "db_ids_1",
  "db_dates_1",
  "db_match_2",
  "db_score_2",
  "institution_match_1",
  "institution_score_1",
  "institution_id_1",
];

const rows = matches.map(({ message, dbMatches, institutionMatches }) => [
  message.dateTime,
  `${message.lineStart}-${message.lineEnd}`,
  message.isReminder ? "possible_reminder" : "possible_launch",
  message.textRedacted.slice(0, 260),
  dbMatches[0]?.name,
  dbMatches[0]?.score,
  dbMatches[0]?.ids.join("|"),
  dbMatches[0]?.dates.join("|"),
  dbMatches[1]?.name,
  dbMatches[1]?.score,
  institutionMatches[0]?.name,
  institutionMatches[0]?.score,
  institutionMatches[0]?.id,
]);

const output = args.get("out");
if (output) {
  const csv = [columns, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  writeFileSync(resolve(output), `${csv}\n`, "utf8");
}

const scoreBuckets = {
  exact_or_near: matches.filter(({ dbMatches }) => (dbMatches[0]?.score ?? 0) >= 0.9).length,
  probable: matches.filter(
    ({ dbMatches }) => (dbMatches[0]?.score ?? 0) >= 0.65 && (dbMatches[0]?.score ?? 0) < 0.9
  ).length,
  weak_or_unmatched: matches.filter(({ dbMatches }) => (dbMatches[0]?.score ?? 0) < 0.65).length,
};

process.stdout.write(
  `${JSON.stringify(
    {
      candidateMessages: matches.length,
      dbLaunchRows: launches.length,
      dbLaunchNames: launchGroups.length,
      institutions: institutions.length,
      scoreBuckets,
      output: output ? resolve(output) : null,
    },
    null,
    2
  )}\n`
);
