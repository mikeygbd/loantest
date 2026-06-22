import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { ExtractedFields, Flag } from './testCases';

export function getAnthropicApiKey(): string | undefined {
  // Bracket access prevents Next.js from inlining undefined at build time when
  // the var is missing locally; Vercel injects secrets at runtime instead.
  return process.env['ANTHROPIC_API_KEY'];
}

function getClient(): Anthropic {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not configured. Add it to .env.local locally or Vercel Environment Variables for production.'
    );
  }
  return new Anthropic({ apiKey });
}

export interface ExtractionResult {
  extracted: ExtractedFields;
  flags: Flag[];
}

const FlagSchema = z.object({
  field: z.string(),
  severity: z.enum(['red', 'yellow']),
  reason: z.string(),
});

const LoanExtractionSchema = z.object({
  applicantName: z.string().nullable(),
  statedMonthlyIncome: z.number().nullable(),
  statedAnnualIncome: z.number().nullable(),
  employerName: z.string().nullable(),
  employmentLength: z.string().nullable(),
  requestedLoanAmount: z.number().nullable(),
  loanPurpose: z.string().nullable(),
  flags: z.array(FlagSchema),
});

function normalizeExtracted(extracted: ExtractedFields): {
  extracted: ExtractedFields;
  derivedAnnualFromMonthly: boolean;
} {
  if (
    extracted.statedMonthlyIncome !== null &&
    extracted.statedAnnualIncome === null
  ) {
    return {
      extracted: {
        ...extracted,
        statedAnnualIncome: extracted.statedMonthlyIncome * 12,
      },
      derivedAnnualFromMonthly: true,
    };
  }
  return { extracted, derivedAnnualFromMonthly: false };
}

function normalizeFlags(flags: Flag[], derivedAnnualFromMonthly: boolean): Flag[] {
  if (!derivedAnnualFromMonthly) return flags;
  return flags.filter(
    (flag) =>
      !(flag.field === 'statedAnnualIncome' && flag.severity === 'red')
  );
}

export async function extractLoanData(text: string): Promise<ExtractionResult> {
  const client = getClient();
  const response = await client.messages.parse({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    output_config: {
      format: zodOutputFormat(LoanExtractionSchema),
    },
    messages: [
      {
        role: 'user',
        content: `Extract loan application information from the following document. For numeric values, extract only the number (no currency symbols). Set fields to null if not present. Also identify any inconsistencies or missing required fields as flags.

Severity rules:
- "red": missing required field (income, loan amount) OR contradictory values (income stated twice with different numbers)
- "yellow": missing helpful field (employment length when employer is listed) OR minor inconsistency

Required fields that must be flagged if missing: statedMonthlyIncome (or statedAnnualIncome), requestedLoanAmount. If only monthly income is stated, leave statedAnnualIncome null — it will be derived as monthly × 12 after extraction.

If monthly and annual income are both stated in the document but don't match (monthly × 12 ≠ annual, allowing 5% tolerance), flag as red on field "statedMonthlyIncome".

For each flag, the "field" value must be one of the extracted field names: applicantName, statedMonthlyIncome, statedAnnualIncome, employerName, employmentLength, requestedLoanAmount, loanPurpose.

Document:
${text}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error('No structured output from Claude');

  const { flags, ...extracted } = parsed;
  const { extracted: normalized, derivedAnnualFromMonthly } = normalizeExtracted(
    extracted as ExtractedFields
  );

  return {
    extracted: normalized,
    flags: normalizeFlags(flags as Flag[], derivedAnnualFromMonthly),
  };
}
