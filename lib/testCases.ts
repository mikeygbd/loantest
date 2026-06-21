export interface ExtractedFields {
  applicantName: string | null;
  statedMonthlyIncome: number | null;
  statedAnnualIncome: number | null;
  employerName: string | null;
  employmentLength: string | null;
  requestedLoanAmount: number | null;
  loanPurpose: string | null;
}

export interface Flag {
  field: string;
  severity: 'red' | 'yellow';
  reason: string;
}

export interface TestCase {
  id: string;
  label: string;
  document: string;
  expectedExtracted: ExtractedFields;
  expectedFlags: Flag[];
}

export const testCases: TestCase[] = [
  {
    id: 'clean',
    label: 'Clean application',
    document: `LOAN APPLICATION

Applicant Name: Sarah Johnson
Date: June 19, 2026

EMPLOYMENT INFORMATION
Employer: Acme Technologies Inc.
Employment Length: 4 years 6 months
Monthly Income: $8,500
Annual Income: $102,000

LOAN DETAILS
Requested Amount: $25,000
Loan Purpose: Home renovation — upgrading kitchen and bathrooms

I certify that all information above is accurate and complete.

Signature: Sarah Johnson`,
    expectedExtracted: {
      applicantName: 'Sarah Johnson',
      statedMonthlyIncome: 8500,
      statedAnnualIncome: 102000,
      employerName: 'Acme Technologies Inc.',
      employmentLength: '4 years 6 months',
      requestedLoanAmount: 25000,
      loanPurpose: 'Home renovation — upgrading kitchen and bathrooms',
    },
    expectedFlags: [],
  },
  {
    id: 'income-mismatch',
    label: 'Income mismatch',
    document: `PERSONAL LOAN REQUEST

Name: Marcus Rivera
Social Security: XXX-XX-1234

Current Employer: GlobalBuild Construction
Years at Job: 2 years

Income: I earn approximately $5,200 per month from my primary job.

Loan Amount Requested: $15,000
Purpose: Debt consolidation

Note: My total annual income including bonuses is around $75,000.`,
    expectedExtracted: {
      applicantName: 'Marcus Rivera',
      statedMonthlyIncome: 5200,
      statedAnnualIncome: 75000,
      employerName: 'GlobalBuild Construction',
      employmentLength: '2 years',
      requestedLoanAmount: 15000,
      loanPurpose: 'Debt consolidation',
    },
    expectedFlags: [
      {
        field: 'statedMonthlyIncome',
        severity: 'red',
        reason:
          'Monthly income of $5,200 implies an annual income of $62,400, but the stated annual income is $75,000 — a discrepancy of $12,600.',
      },
    ],
  },
  {
    id: 'missing-fields',
    label: 'Missing required fields',
    document: `Loan Application Form

Applicant: Derek Thompson

I am currently employed at Sunrise Marketing Group and have been doing well there.

I would like to borrow money for a car purchase. Please let me know if you need more information.

Contact: derek.t@email.com`,
    expectedExtracted: {
      applicantName: 'Derek Thompson',
      statedMonthlyIncome: null,
      statedAnnualIncome: null,
      employerName: 'Sunrise Marketing Group',
      employmentLength: null,
      requestedLoanAmount: null,
      loanPurpose: 'Car purchase',
    },
    expectedFlags: [
      {
        field: 'statedMonthlyIncome',
        severity: 'red',
        reason: 'No income information was provided in the application.',
      },
      {
        field: 'employmentLength',
        severity: 'yellow',
        reason:
          'Employer is listed but no employment length was provided, making tenure unverifiable.',
      },
      {
        field: 'requestedLoanAmount',
        severity: 'red',
        reason: 'No loan amount was specified in the application.',
      },
    ],
  },
];
