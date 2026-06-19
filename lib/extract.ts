import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { ExtractedFields, Flag } from './testCases';

const client = new Anthropic();

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

export async function extractLoanData(text: string): Promise<ExtractionResult> {
  const response = await client.messages.parse({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
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

Required fields that must be flagged if missing: statedMonthlyIncome (or statedAnnualIncome), requestedLoanAmount.

If monthly and annual income are both stated but don't match (monthly × 12 ≠ annual, allowing 5% tolerance), flag as red.

Document:
${text}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error('No structured output from Claude');

  const { flags, ...extracted } = parsed;

  return {
    extracted: extracted as ExtractedFields,
    flags: flags as Flag[],
  };
}
