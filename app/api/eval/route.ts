import { NextResponse } from 'next/server';
import { extractLoanData, getAnthropicApiKey } from '@/lib/extract';
import { testCases } from '@/lib/testCases';
import type { ExtractedFields, Flag } from '@/lib/testCases';

export const maxDuration = 60;

interface FieldResult {
  field: string;
  expected: string | number | null;
  actual: string | number | null;
  pass: boolean;
}

interface FlagResult {
  field: string;
  expectedSeverity: string;
  expectedReason: string;
  found: boolean;
}

interface CaseResult {
  id: string;
  label: string;
  fieldResults: FieldResult[];
  flagResults: FlagResult[];
  extraFlags: Flag[];
  pass: boolean;
  error?: string;
}

const INCOME_FLAG_FIELDS = new Set([
  'income',
  'statedMonthlyIncome',
  'statedAnnualIncome',
]);

function compareField(expected: unknown, actual: unknown): boolean {
  if (expected === null || expected === undefined) return false;
  if (actual === null || actual === undefined) return false;
  if (typeof expected === 'number' && typeof actual === 'number') {
    return Math.abs(expected - actual) / expected < 0.01;
  }
  return String(expected).toLowerCase().trim() === String(actual).toLowerCase().trim();
}

function buildFieldResult(
  key: keyof ExtractedFields,
  expected: ExtractedFields[keyof ExtractedFields],
  actual: ExtractedFields[keyof ExtractedFields]
): FieldResult {
  return {
    field: key,
    expected: expected as string | number | null,
    actual: actual as string | number | null,
    pass: compareField(expected, actual),
  };
}

function extractionAccurate(
  tc: (typeof testCases)[number],
  fieldResults: FieldResult[],
  flagResults: FlagResult[]
): boolean {
  const scorableFields = fieldResults.filter(
    (r) => tc.expectedExtracted[r.field as keyof ExtractedFields] !== null
  );
  return (
    scorableFields.every((r) => r.pass) && flagResults.every((r) => r.found)
  );
}

/** Case badge: clean + missing-fields pass when extraction is accurate; income-mismatch always fails review. */
function casePasses(tc: (typeof testCases)[number], accurate: boolean): boolean {
  if (tc.id === 'income-mismatch') return false;
  return accurate;
}

function flagMatches(expected: Flag, actual: Flag): boolean {
  if (actual.severity !== expected.severity) return false;

  if (actual.field === expected.field) return true;

  const expectedIsIncome = INCOME_FLAG_FIELDS.has(expected.field);
  const actualIsIncome = INCOME_FLAG_FIELDS.has(actual.field);
  return expectedIsIncome && actualIsIncome;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function runTestCase(tc: (typeof testCases)[number]): Promise<CaseResult> {
  try {
    const { extracted, flags } = await extractLoanData(tc.document);

    const fieldKeys = Object.keys(tc.expectedExtracted) as (keyof ExtractedFields)[];
    const fieldResults: FieldResult[] = fieldKeys.map((key) =>
      buildFieldResult(
        key,
        tc.expectedExtracted[key],
        (extracted as ExtractedFields)[key]
      )
    );

    const flagResults: FlagResult[] = tc.expectedFlags.map((ef) => ({
      field: ef.field,
      expectedSeverity: ef.severity,
      expectedReason: ef.reason,
      found: flags.some((af: Flag) => flagMatches(ef, af)),
    }));

    const expectedFieldSet = new Set(
      tc.expectedFlags.flatMap((f) =>
        INCOME_FLAG_FIELDS.has(f.field)
          ? ['income', 'statedMonthlyIncome', 'statedAnnualIncome']
          : [f.field]
      )
    );
    const extraFlags = flags.filter((f: Flag) => !expectedFieldSet.has(f.field));

    const accurate = extractionAccurate(tc, fieldResults, flagResults);
    const pass = casePasses(tc, accurate);

    return {
      id: tc.id,
      label: tc.label,
      fieldResults,
      flagResults,
      extraFlags,
      pass,
    };
  } catch (err) {
    const message = formatError(err);
    console.error(`Eval error for ${tc.id}:`, err);
    return {
      id: tc.id,
      label: tc.label,
      fieldResults: [],
      flagResults: [],
      extraFlags: [],
      pass: false,
      error: message,
    };
  }
}

export async function GET() {
  if (!getAnthropicApiKey()) {
    const message =
      'ANTHROPIC_API_KEY is not configured. Add it in Vercel project settings under Environment Variables, then redeploy.';
    return NextResponse.json(
      testCases.map((tc) => ({
        id: tc.id,
        label: tc.label,
        fieldResults: [],
        flagResults: [],
        extraFlags: [],
        pass: false,
        error: message,
      }))
    );
  }

  const results = await Promise.all(testCases.map(runTestCase));
  return NextResponse.json(results);
}
