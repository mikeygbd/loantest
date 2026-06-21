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
  error?: string;
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
  if (value === null)
    return <span className="text-foreground-subtle italic">Not provided</span>;
  if (
    key === 'statedMonthlyIncome' ||
    key === 'statedAnnualIncome' ||
    key === 'requestedLoanAmount'
  ) {
    return `$${Number(value).toLocaleString()}`;
  }
  return String(value);
}

function SeverityDot({ severity }: { severity: 'red' | 'yellow' }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 mt-1.5 ${
        severity === 'red' ? 'bg-danger shadow-[0_0_6px_var(--danger)]' : 'bg-warning shadow-[0_0_6px_var(--warning)]'
      }`}
    />
  );
}

function formatEvalValue(value: string | number | null) {
  if (value === null) return 'Not provided';
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
    setError('');
    try {
      const res = await fetch('/api/eval');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Eval request failed');
      }
      if (!Array.isArray(data)) {
        throw new Error('Unexpected eval response');
      }
      setEvalResults(data);

      const configError = data.find(
        (r: EvalCaseResult) => r.error?.includes('ANTHROPIC_API_KEY')
      );
      if (configError?.error) {
        setError(configError.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eval failed');
    } finally {
      setEvalLoading(false);
    }
  }

  const passCount = evalResults?.filter((r) => r.pass).length ?? 0;

  return (
    <main className="page-backdrop min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border bg-background-elevated/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-muted border border-accent/20 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">LoanReview</p>
              <p className="text-[11px] text-foreground-subtle mt-0.5">Document Intelligence</p>
            </div>
          </div>
          {history.length > 0 && (
            <span className="text-xs text-foreground-muted tabular-nums">
              {history.length} submission{history.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
        {/* Hero */}
        <div className="pt-2 pb-2">
          <h1 className="text-[1.75rem] font-semibold text-foreground tracking-tight leading-tight">
            Loan Application Reviewer
          </h1>
          <p className="text-foreground-muted mt-2 text-[0.9375rem] leading-relaxed max-w-xl">
            Paste or upload a loan application document to extract key fields and surface
            inconsistencies automatically.
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div className="card-header !mb-0 !pb-4">
            <h2 className="text-sm font-semibold text-foreground">New Analysis</h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Supports plain text or PDF uploads
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
              Document Text
            </label>
            <textarea
              className="input-field p-3.5 text-sm font-mono h-44 resize-y"
              placeholder="Paste the loan application document here..."
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value) setFile(null);
              }}
            />
          </div>

          <div className="divider">or</div>

          <div>
            <label className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
              File Upload
            </label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-border-strong rounded-lg p-5 text-center transition-colors hover:border-accent/40 hover:bg-accent-muted/30 group"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-surface-raised border border-border-strong flex items-center justify-center group-hover:border-accent/30 transition-colors">
                  <svg
                    className="w-4 h-4 text-foreground-muted group-hover:text-accent transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-foreground-subtle mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB · Click to change
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-foreground-muted">
                      Drop a file or <span className="text-accent">browse</span>
                    </p>
                    <p className="text-xs text-foreground-subtle mt-0.5">.txt or .pdf</p>
                  </div>
                )}
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.pdf"
              className="hidden"
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
            className="btn-primary w-full py-3 text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Analyzing document…
              </span>
            ) : (
              'Extract & Validate'
            )}
          </button>

          {error && (
            <div className="flex items-start gap-3 text-sm bg-danger-muted border border-danger/20 rounded-lg p-3.5 text-danger">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
        </form>

        {/* Results */}
        {extracted && (
          <div className="space-y-4">
            <div className="card p-6">
              <div className="card-header flex items-center justify-between !mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Extracted Fields</h2>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    {extracted.applicantName ?? 'Unknown applicant'}
                  </p>
                </div>
                <span className="pill pill-success">Complete</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
                {(Object.keys(FIELD_LABELS) as (keyof ExtractedFields)[]).map((key) => (
                  <div key={key} className="field-item">
                    <dt>{FIELD_LABELS[key]}</dt>
                    <dd>{formatValue(key, extracted[key] as string | number | null)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {flags.length > 0 ? (
              <div className="card p-6">
                <div className="card-header flex items-center justify-between !mb-4">
                  <h2 className="text-sm font-semibold text-foreground">Validation Flags</h2>
                  <span className="pill pill-danger">{flags.length} issue{flags.length !== 1 ? 's' : ''}</span>
                </div>
                <ul className="space-y-2.5">
                  {flags.map((flag, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-3 rounded-lg p-3.5 text-sm border ${
                        flag.severity === 'red'
                          ? 'bg-danger-muted border-danger/20 text-foreground'
                          : 'bg-warning-muted border-warning/20 text-foreground'
                      }`}
                    >
                      <SeverityDot severity={flag.severity} />
                      <div>
                        <span className="font-medium text-foreground">
                          {FIELD_LABELS[flag.field as keyof ExtractedFields] ?? flag.field}
                        </span>
                        <p className="text-foreground-muted mt-0.5 leading-relaxed">{flag.reason}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-success-muted border border-success/20 rounded-xl p-4 text-sm">
                <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-success">All clear</p>
                  <p className="text-foreground-muted text-xs mt-0.5">
                    No inconsistencies or missing fields detected.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Eval */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Evaluation Suite</h2>
              <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                Run extraction against 3 synthetic loan applications — one should fail review.
              </p>
            </div>
            <button
              onClick={handleEval}
              disabled={evalLoading}
              className="btn-secondary px-4 py-2 text-xs shrink-0"
            >
              {evalLoading ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Running…
                </span>
              ) : (
                'Run Eval'
              )}
            </button>
          </div>

          {evalResults && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 h-1.5 rounded-full bg-surface-raised overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-500"
                    style={{ width: `${(passCount / evalResults.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-foreground-muted tabular-nums shrink-0">
                  {passCount}/{evalResults.length} passed
                </span>
              </div>

              {evalResults.map((caseResult) => (
                <div
                  key={caseResult.id}
                  className="border border-border-strong rounded-lg overflow-hidden bg-background-elevated"
                >
                  <div
                    className={`flex items-center justify-between px-4 py-2.5 text-xs font-semibold border-b ${
                      caseResult.pass
                        ? 'bg-success-muted border-success/15 text-success'
                        : 'bg-danger-muted border-danger/15 text-danger'
                    }`}
                  >
                    <span>{caseResult.label}</span>
                    <span className={caseResult.pass ? 'pill pill-success' : 'pill pill-danger'}>
                      {caseResult.pass ? 'Pass' : 'Fail'}
                    </span>
                  </div>

                  {caseResult.id === 'income-mismatch' && caseResult.flagResults.some((f) => f.found) && (
                    <div className="px-4 py-2 text-xs bg-danger-muted/40 border-b border-danger/15 text-foreground-muted">
                      Application failed review — income figures are inconsistent.
                    </div>
                  )}

                  <div className="p-4 space-y-4">
                    {caseResult.error && (
                      <div className="flex items-start gap-2 text-xs bg-danger-muted border border-danger/20 rounded-lg p-3 text-danger">
                        <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{caseResult.error}</span>
                      </div>
                    )}

                    {caseResult.fieldResults.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-foreground-subtle uppercase tracking-widest mb-2.5">
                        Fields
                      </p>
                      <div className="rounded-lg overflow-hidden border border-border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-surface-raised text-foreground-subtle">
                              <th className="text-left py-2 px-3 font-medium w-1/3">Field</th>
                              <th className="text-left py-2 px-3 font-medium w-1/3">Expected</th>
                              <th className="text-left py-2 px-3 font-medium w-1/3">Actual</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {caseResult.fieldResults.map((fr) => (
                              <tr
                                key={fr.field}
                                className={fr.pass ? 'text-foreground-muted' : 'text-danger bg-danger-muted/30'}
                              >
                                <td className="py-2 px-3 font-medium text-foreground">
                                  {FIELD_LABELS[fr.field as keyof ExtractedFields] ?? fr.field}
                                </td>
                                <td className="py-2 px-3 font-mono">
                                  {formatEvalValue(fr.expected)}
                                </td>
                                <td className="py-2 px-3 font-mono">
                                  <span className="flex items-center gap-1.5">
                                    {formatEvalValue(fr.actual)}
                                    <span className={fr.pass ? 'text-success' : 'text-danger'}>
                                      {fr.pass ? '✓' : '✗'}
                                    </span>
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    )}

                    {caseResult.flagResults.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-foreground-subtle uppercase tracking-widest mb-2">
                          Expected Flags
                        </p>
                        <ul className="space-y-1.5">
                          {caseResult.flagResults.map((fr, i) => (
                            <li
                              key={i}
                              className={`text-xs flex items-start gap-2 px-2 py-1.5 rounded ${
                                fr.found ? 'text-success' : 'text-danger bg-danger-muted/20'
                              }`}
                            >
                              <span className="font-mono shrink-0">{fr.found ? '✓' : '✗'}</span>
                              <span className="text-foreground-muted">
                                <strong className="text-foreground font-medium">{fr.field}</strong>{' '}
                                <span className="text-foreground-subtle">({fr.expectedSeverity})</span>
                                {' — '}
                                {fr.expectedReason}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {caseResult.extraFlags.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-foreground-subtle uppercase tracking-widest mb-2">
                          Unexpected Flags
                        </p>
                        <ul className="space-y-1.5">
                          {caseResult.extraFlags.map((f, i) => (
                            <li key={i} className="text-xs text-warning flex items-start gap-2 px-2 py-1.5 rounded bg-warning-muted/50">
                              <span className="shrink-0">⚠</span>
                              <span className="text-foreground-muted">
                                <strong className="text-foreground font-medium">{f.field}</strong>{' '}
                                <span className="text-foreground-subtle">({f.severity})</span>
                                {' — '}
                                {f.reason}
                              </span>
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
          <div className="card p-6">
            <div className="card-header flex items-center justify-between !mb-4">
              <h2 className="text-sm font-semibold text-foreground">Submission History</h2>
              <span className="text-xs text-foreground-subtle tabular-nums">{history.length} total</span>
            </div>
            <ul className="space-y-2">
              {history.map((row) => (
                <li
                  key={row.id}
                  className="group border border-border rounded-lg p-3.5 transition-colors hover:border-border-strong hover:bg-surface-hover"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-sm text-foreground group-hover:text-accent transition-colors">
                      {row.extracted.applicantName ?? 'Unknown applicant'}
                    </span>
                    <time className="text-[11px] text-foreground-subtle tabular-nums">
                      {new Date(row.created_at).toLocaleString()}
                    </time>
                  </div>
                  <div className="text-xs text-foreground-muted flex flex-wrap gap-x-4 gap-y-1">
                    {row.extracted.requestedLoanAmount && (
                      <span className="font-mono">
                        ${Number(row.extracted.requestedLoanAmount).toLocaleString()}
                      </span>
                    )}
                    {row.extracted.loanPurpose && (
                      <span>{row.extracted.loanPurpose}</span>
                    )}
                    {row.flags.length > 0 ? (
                      <span className="text-danger">{row.flags.length} flag{row.flags.length !== 1 ? 's' : ''}</span>
                    ) : (
                      <span className="text-success">Clean</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="text-center pb-6">
          <p className="text-[11px] text-foreground-subtle">
            Loan Application Reviewer · Powered by document extraction
          </p>
        </footer>
      </div>
    </main>
  );
}
