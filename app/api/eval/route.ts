import { NextResponse } from 'next/server';
import { extractLoanData } from '@/lib/extract';
import { testCases } from '@/lib/testCases';
import type { ExtractedFields, Flag } from '@/lib/testCases';

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
}

function compareField(expected: unknown, actual: unknown): boolean {
  if (expected === null && actual === null) return true;
  if (expected === null || actual === null) return false;
  if (typeof expected === 'number' && typeof actual === 'number') {
    return Math.abs(expected - actual) / expected < 0.01;
  }
  return String(expected).toLowerCase().trim() === String(actual).toLowerCase().trim();
}

export async function GET() {
  const results: CaseResult[] = [];

  for (const tc of testCases) {
    try {
      const { extracted, flags } = await extractLoanData(tc.document);

      const fieldKeys = Object.keys(tc.expectedExtracted) as (keyof ExtractedFields)[];
      const fieldResults: FieldResult[] = fieldKeys.map((key) => ({
        field: key,
        expected: tc.expectedExtracted[key] as string | number | null,
        actual: (extracted as ExtractedFields)[key] as string | number | null,
        pass: compareField(tc.expectedExtracted[key], (extracted as ExtractedFields)[key]),
      }));

      const flagResults: FlagResult[] = tc.expectedFlags.map((ef) => ({
        field: ef.field,
        expectedSeverity: ef.severity,
        expectedReason: ef.reason,
        found: flags.some(
          (af: Flag) => af.field === ef.field && af.severity === ef.severity
        ),
      }));

      const expectedFieldSet = new Set(tc.expectedFlags.map((f) => f.field));
      const extraFlags = flags.filter((f: Flag) => !expectedFieldSet.has(f.field));

      const pass =
        fieldResults.every((r) => r.pass) && flagResults.every((r) => r.found);

      results.push({
        id: tc.id,
        label: tc.label,
        fieldResults,
        flagResults,
        extraFlags,
        pass,
      });
    } catch (err) {
      results.push({
        id: tc.id,
        label: tc.label,
        fieldResults: [],
        flagResults: [],
        extraFlags: [],
        pass: false,
      });
      console.error(`Eval error for ${tc.id}:`, err);
    }
  }

  return NextResponse.json(results);
}
