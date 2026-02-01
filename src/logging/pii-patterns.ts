/**
 * PII entity keys and regex patterns for detection and redaction.
 * Used by config-driven redaction (logging, status) and ingestion redaction.
 */

export const PII_ENTITY_KEYS = ["credit_card", "ssn", "email", "phone_number"] as const;

export type PiiEntityKey = (typeof PII_ENTITY_KEYS)[number];

export const DEFAULT_PII_ENTITIES: PiiEntityKey[] = ["ssn", "email", "credit_card", "phone_number"];

type PiiPatternEntry = { entity: PiiEntityKey; pattern: RegExp };

const PII_PATTERNS: PiiPatternEntry[] = [
  // SSN: 123-45-6789 or 123456789 (9 digits, optional dashes)
  {
    entity: "ssn",
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  },
  // Email: local@domain
  {
    entity: "email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  // Credit card: 4 groups of 4 digits (with optional space or dash)
  {
    entity: "credit_card",
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  },
  // Phone: E.164-like or US-style with optional punctuation
  {
    entity: "phone_number",
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
];

const PATTERNS_BY_ENTITY = new Map<PiiEntityKey, RegExp>(
  PII_PATTERNS.map((e) => [e.entity, new RegExp(e.pattern.source, e.pattern.flags)]),
);

export function getPiiPatternsForEntities(entities: string[]): PiiPatternEntry[] {
  const out: PiiPatternEntry[] = [];
  const set = new Set(PII_ENTITY_KEYS);
  for (const key of entities) {
    if (set.has(key as PiiEntityKey)) {
      const base = PATTERNS_BY_ENTITY.get(key as PiiEntityKey);
      if (base) {
        out.push({
          entity: key as PiiEntityKey,
          pattern: new RegExp(base.source, base.flags),
        });
      }
    }
  }
  return out;
}

export function detectPiiInText(text: string, entities: string[]): PiiEntityKey[] {
  if (!text || entities.length === 0) {
    return [];
  }
  const patterns = getPiiPatternsForEntities(entities);
  const detected = new Set<PiiEntityKey>();
  for (const { entity, pattern } of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      detected.add(entity);
    }
  }
  return [...detected];
}

const REDACT_PLACEHOLDER = "[REDACTED]";

export function redactPiiInText(text: string, entities: string[]): string {
  if (!text) {
    return text;
  }
  if (entities.length === 0) {
    return text;
  }
  const patterns = getPiiPatternsForEntities(entities);
  let out = text;
  for (const { pattern } of patterns) {
    out = out.replace(pattern, REDACT_PLACEHOLDER);
  }
  return out;
}
