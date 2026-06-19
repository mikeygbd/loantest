'use client';

import { useState, useEffect, useRef } from 'react';
import type { ExtractedFields, Flag } from '@/lib/testCases';

interface SubmissionHistory {
  id: number;
  created_at: string;
  extracted: ExtractedFields;
  flags: Flag[];
}

interface EvalFieldResult {
  field: string;
  expected: string | number | null;
  actual: string | number | null;
  pass: boolean;
}

interface EvalFlagResult {
  field: string;
  expectedSeverity: string;
  expectedReason: string;
  found: boolean;
}

interface EvalCaseResult {
  id: string;
  label: string;
  fieldResults: EvalFieldResult[];
  flagResults: EvalFlagResult[];
  extraFlags: Flag[];
  pass: boolean;
}

const FIELD_LABELS: Record<keyof ExtractedFields, string> = {
  applicantName: 'Applicant Name',
  statedMonthlyIncome: 'Monthly Income',
  statedAnnualIncome: 'Annual Income',
  employerName: 'Employer',
  employmentLength: 'Employment Length',
  requestedLoanAmount: 'Loan Amount',
  loanPurpose: 'Loan Purpose',
};

function formatValue(key: keyof ExtractedFields, value: string | number | null) {
  if (value === null) return <span className="text-gray-400 italic">Not provided</span>;
  if (
    key === 'statedMonthlyIncome' ||
    key === 'statedAnnualIncome' ||
    key === 'requestedLoanAmount'
  ) {
    return `$${Number(value).toLocaleString()}`;
  }
  return String(value);
}

export default function Home() {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<SubmissionHistory[]>([]);
  const [evalResults, setEvalResults] = useState<EvalCaseResult[] | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const res = await fetch('/api/history');
      if (res.ok) setHistory(await res.json());
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text && !file) return;
    setLoading(true);
    setError('');
    setExtracted(null);
    setFlags([]);

    const fd = new FormData();
    if (file) fd.append('file', file);
    else fd.append('text', text);

    try {
      const res = await fetch('/api/extract', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');
      setExtracted(data.extracted);
      setFlags(data.flags);
      await fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleEval() {
    setEvalLoading(true);
    setEvalResults(null);
    try {
      const res = await fetch('/api/eval');
      const data = await res.json();
      setEvalResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eval failed');
    } finally {
      setEvalLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Loan Application Reviewer</h1>
          <p className="text-gray-500 mt-1">
            Paste or upload a loan application document to extract and validate key fields.
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paste document text
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm font-mono h-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Paste the loan application document here..."
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value) setFile(null);
              }}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">or</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload file (txt or pdf)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.pdf"
              className="text-sm text-gray-600"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f) setText('');
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || (!text && !file)}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Analyzing…' : 'Extract & Validate'}
          </button>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </p>
          )}
        </form>

        {/* Results */}
        {extracted && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Extracted Fields</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                {(Object.keys(FIELD_LABELS) as (keyof ExtractedFields)[]).map((key) => (
                  <div key={key}>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {FIELD_LABELS[key]}
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-900">
                      {formatValue(key, extracted[key] as string | number | null)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {flags.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Flags ({flags.length})
                </h2>
                <ul className="space-y-2">
                  {flags.map((flag, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-3 rounded-lg p-3 text-sm ${
                        flag.severity === 'red'
                          ? 'bg-red-50 border border-red-200 text-red-800'
                          : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                      }`}
                    >
                      <span className="font-semibold shrink-0">
                        {flag.severity === 'red' ? '🔴' : '🟡'}{' '}
                        {FIELD_LABELS[flag.field as keyof ExtractedFields] ?? flag.field}:
                      </span>
                      <span>{flag.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {flags.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 text-sm font-medium">
                ✅ No inconsistencies or missing fields detected.
              </div>
            )}
          </div>
        )}

        {/* Eval */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Evaluation Suite</h2>
              <p className="text-sm text-gray-500">
                Run extraction against 3 synthetic test cases and check accuracy.
              </p>
            </div>
            <button
              onClick={handleEval}
              disabled={evalLoading}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {evalLoading ? 'Running…' : 'Run Eval'}
            </button>
          </div>

          {evalResults && (
            <div className="space-y-6">
              {evalResults.map((caseResult) => (
                <div key={caseResult.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div
                    className={`flex items-center justify-between px-4 py-2 text-sm font-medium ${
                      caseResult.pass
                        ? 'bg-green-50 text-green-800'
                        : 'bg-red-50 text-red-800'
                    }`}
                  >
                    <span>{caseResult.label}</span>
                    <span>{caseResult.pass ? '✅ PASS' : '❌ FAIL'}</span>
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                        Fields
                      </p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400">
                            <th className="text-left py-1 w-1/3">Field</th>
                            <th className="text-left py-1 w-1/3">Expected</th>
                            <th className="text-left py-1 w-1/3">Actual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {caseResult.fieldResults.map((fr) => (
                            <tr
                              key={fr.field}
                              className={fr.pass ? 'text-gray-700' : 'text-red-600'}
                            >
                              <td className="py-0.5 font-medium">
                                {FIELD_LABELS[fr.field as keyof ExtractedFields] ?? fr.field}
                              </td>
                              <td className="py-0.5">
                                {fr.expected === null ? <em>null</em> : String(fr.expected)}
                              </td>
                              <td className="py-0.5">
                                {fr.actual === null ? <em>null</em> : String(fr.actual)}{' '}
                                {fr.pass ? '✓' : '✗'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {caseResult.flagResults.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          Expected Flags
                        </p>
                        <ul className="space-y-1">
                          {caseResult.flagResults.map((fr, i) => (
                            <li
                              key={i}
                              className={`text-xs flex items-start gap-2 ${
                                fr.found ? 'text-green-700' : 'text-red-600'
                              }`}
                            >
                              <span>{fr.found ? '✓' : '✗'}</span>
                              <span>
                                <strong>{fr.field}</strong> ({fr.expectedSeverity}):{' '}
                                {fr.expectedReason}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {caseResult.extraFlags.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          Unexpected Flags
                        </p>
                        <ul className="space-y-1">
                          {caseResult.extraFlags.map((f, i) => (
                            <li key={i} className="text-xs text-yellow-700">
                              ⚠ {f.field} ({f.severity}): {f.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Submission History ({history.length})
            </h2>
            <ul className="space-y-3">
              {history.map((row) => (
                <li key={row.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">
                      {row.extracted.applicantName ?? 'Unknown applicant'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-gray-500 text-xs flex gap-4">
                    {row.extracted.requestedLoanAmount && (
                      <span>
                        Loan: ${Number(row.extracted.requestedLoanAmount).toLocaleString()}
                      </span>
                    )}
                    {row.extracted.loanPurpose && (
                      <span>Purpose: {row.extracted.loanPurpose}</span>
                    )}
                    {row.flags.length > 0 && (
                      <span className="text-red-500">{row.flags.length} flag(s)</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
