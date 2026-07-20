#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const HEADER_RE =
  /^[\u200e\u200f\u202a-\u202e\u2066-\u2069]*\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s+([^:]+):\s?(.*)$/u;

const SYSTEM_PATTERNS = [
  /mensajes y las llamadas est[aá]n cifrados/iu,
  /se uni[oó] con el enlace/iu,
  /a[ñn]adi[oó] a/iu,
  /sali[oó] del grupo/iu,
  /cambi[oó] (?:el asunto|la descripci[oó]n|el [ií]cono)/iu,
  /se elimin[oó] este mensaje/iu,
  /cre[oó] el grupo/iu,
];

const LAUNCH_FIELD_PATTERNS = [
  /\bvacantes?\b/iu,
  /\bcupos?\b/iu,
  /\borientaci[oó]n\b/iu,
  /\bmodalidad\b/iu,
  /\bhorarios?\b/iu,
  /\bhoras?\s+(?:a\s+)?acreditar\b/iu,
  /\bduraci[oó]n\b/iu,
  /\binicio\b/iu,
  /\binscripci[oó]n/iu,
  /\bconvocatoria\b/iu,
];

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

const input = args.get("input");
if (!input) {
  throw new Error(
    "Uso: node parse-whatsapp-pps-history.mjs --input <archivo> [--year 2024] [--candidate-out <csv>]"
  );
}

const targetYear = Number(args.get("year") ?? "2024");
const source = readFileSync(resolve(input), "utf8").replace(/^\uFEFF/u, "");
const lines = source.split(/\r?\n/u);
const messages = [];
let current = null;

function finishCurrent() {
  if (!current) return;
  current.body = current.bodyLines.join("\n").trim();
  delete current.bodyLines;
  messages.push(current);
  current = null;
}

for (let index = 0; index < lines.length; index += 1) {
  const match = HEADER_RE.exec(lines[index]);
  if (!match) {
    if (current) {
      current.bodyLines.push(lines[index]);
      current.lineEnd = index + 1;
    }
    continue;
  }

  finishCurrent();
  const [, day, month, rawYear, hour, minute, rawSecond, sender, firstLine] = match;
  const year = Number(rawYear.length === 2 ? `20${rawYear}` : rawYear);
  const second = Number(rawSecond ?? "0");
  current = {
    id: messages.length + 1,
    year,
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second,
    dateTime: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${minute}:${String(second).padStart(2, "0")}`,
    sender: sender.trim(),
    bodyLines: [firstLine],
    lineStart: index + 1,
    lineEnd: index + 1,
  };
}
finishCurrent();

function senderHash(sender) {
  return `participant_${createHash("sha256").update(sender).digest("hex").slice(0, 10)}`;
}

function isSystemMessage(body) {
  return SYSTEM_PATTERNS.some((pattern) => pattern.test(body));
}

function launchSignal(message) {
  const normalized = message.body.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, "").trim();
  const startsLikeLaunch = /^\*?PPS?\b/iu.test(normalized);
  const fieldHits = LAUNCH_FIELD_PATTERNS.filter((pattern) => pattern.test(normalized)).length;
  const reminder =
    /\b(?:recordamos|recuerda|queda[n]?|hay)\b.{0,80}\b(?:vacante|cupo|inscripci)/isu.test(
      normalized
    );
  const score = (startsLikeLaunch ? 4 : 0) + Math.min(fieldHits, 5) + (reminder ? 2 : 0);
  return { normalized, startsLikeLaunch, fieldHits, reminder, score };
}

function redact(text) {
  return text
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, "")
    .replace(/https?:\/\/\S+/giu, "[URL]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu, "[EMAIL]")
    .replace(/(?:\+?54\s*)?(?:9\s*)?(?:\d[\s\u00a0\u2011-]*){8,}/gu, "[PHONE]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 1200);
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

const yearMessages = messages.filter((message) => message.year === targetYear);
const substantive = yearMessages.filter((message) => !isSystemMessage(message.body));
const candidates = substantive
  .map((message) => ({ message, signal: launchSignal(message) }))
  .filter(({ signal }) => signal.score >= 4)
  .sort((left, right) => left.message.lineStart - right.message.lineStart);

const monthCounts = Object.fromEntries(
  Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return [
      String(month).padStart(2, "0"),
      yearMessages.filter((message) => message.month === month).length,
    ];
  })
);

const profile = {
  input: resolve(input),
  sourceLines: lines.length,
  parsedMessages: messages.length,
  firstMessage: messages.at(0)?.dateTime ?? null,
  lastMessage: messages.at(-1)?.dateTime ?? null,
  targetYear,
  yearMessages: yearMessages.length,
  yearSubstantiveMessages: substantive.length,
  yearSystemMessages: yearMessages.length - substantive.length,
  yearParticipantCount: new Set(yearMessages.map((message) => message.sender)).size,
  launchCandidateMessages: candidates.length,
  monthCounts,
};

process.stdout.write(`${JSON.stringify(profile, null, 2)}\n`);

const candidateOut = args.get("candidate-out");
if (candidateOut) {
  const columns = [
    "message_id",
    "date_time",
    "line_start",
    "line_end",
    "sender_hash",
    "signal_score",
    "starts_like_launch",
    "field_hits",
    "is_reminder",
    "text_redacted",
  ];
  const rows = candidates.map(({ message, signal }) => [
    message.id,
    message.dateTime,
    message.lineStart,
    message.lineEnd,
    senderHash(message.sender),
    signal.score,
    signal.startsLikeLaunch,
    signal.fieldHits,
    signal.reminder,
    redact(signal.normalized),
  ]);
  const csv = [columns, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  writeFileSync(resolve(candidateOut), `${csv}\n`, "utf8");
}

const messageOut = args.get("message-out");
if (messageOut) {
  const columns = [
    "message_id",
    "date_time",
    "line_start",
    "line_end",
    "sender_hash",
    "is_system",
    "signal_score",
    "starts_like_launch",
    "field_hits",
    "is_reminder",
    "text_redacted",
  ];
  const rows = yearMessages.map((message) => {
    const signal = launchSignal(message);
    return [
      message.id,
      message.dateTime,
      message.lineStart,
      message.lineEnd,
      senderHash(message.sender),
      isSystemMessage(message.body),
      signal.score,
      signal.startsLikeLaunch,
      signal.fieldHits,
      signal.reminder,
      redact(signal.normalized),
    ];
  });
  const csv = [columns, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  writeFileSync(resolve(messageOut), `${csv}\n`, "utf8");
}

const messageJsonOut = args.get("message-json-out");
if (messageJsonOut) {
  const rows = yearMessages.map((message) => {
    const signal = launchSignal(message);
    return {
      messageId: message.id,
      dateTime: message.dateTime,
      lineStart: message.lineStart,
      lineEnd: message.lineEnd,
      senderHash: senderHash(message.sender),
      isSystem: isSystemMessage(message.body),
      signalScore: signal.score,
      startsLikeLaunch: signal.startsLikeLaunch,
      fieldHits: signal.fieldHits,
      isReminder: signal.reminder,
      textRedacted: redact(signal.normalized),
    };
  });
  writeFileSync(resolve(messageJsonOut), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}
