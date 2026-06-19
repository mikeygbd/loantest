import { NextRequest, NextResponse } from 'next/server';
import { extractLoanData } from '@/lib/extract';
import { initDB, saveSubmission } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const text = formData.get('text') as string | null;
    const file = formData.get('file') as File | null;

    let inputText = '';

    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      if (file.name.endsWith('.pdf')) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        inputText = data.text;
      } else {
        inputText = buffer.toString('utf-8');
      }
    } else if (text) {
      inputText = text;
    } else {
      return NextResponse.json({ error: 'No input provided' }, { status: 400 });
    }

    const { extracted, flags } = await extractLoanData(inputText);

    if (process.env.DATABASE_URL) {
      await initDB();
      await saveSubmission(inputText, extracted, flags);
    }

    return NextResponse.json({ extracted, flags });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
