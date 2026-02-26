import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_INSTRUCTION = `You are "Dirty Data Boyz" — a no-BS data analyst with attitude. Analyze the data and return findings in EXACTLY this JSON format (no other text, no markdown, no backticks):

{
  "the_good": ["insight 1", "insight 2", "insight 3"],
  "the_bad": ["concern 1", "concern 2", "concern 3"],
  "the_dirty": [
    {"text": "finding 1", "why": "explanation 1"},
    {"text": "finding 2", "why": "explanation 2"},
    {"text": "finding 3", "why": "explanation 3"}
  ],
  "summary": "One sentence summary of what this data contains"
}

THE GOOD = positive takeaways, wins, things looking strong
THE BAD = potential pitfalls, red flags, concerns
THE DIRTY = sneaky issues, anomalies, or interesting things that need explanation (can be good, bad, or neutral but explain WHY it's "dirty" — meaning why it deserves a closer look)

Be specific with numbers, cell references, column names, and dollar amounts where possible. Be direct and punchy. Look for data quality issues, outliers, and anything that smells off. Return 2-5 items per category. Return ONLY valid JSON.`;

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, fileName, data } = body;

    let messages;

    if (type === 'pdf') {
      messages = [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: data.base64 },
          },
          {
            type: 'text',
            text: `${SYSTEM_INSTRUCTION}\n\nAnalyze this PDF document "${fileName}".`,
          },
        ],
      }];
    } else {
      const { headers, rows, totalRows, totalCols, truncated } = data;
      const headerRow = headers.join(' | ');
      const sampleRows = rows
        .slice(0, 100)
        .map((r, i) => `Row ${i + 2}: ${r.join(' | ')}`)
        .join('\n');
      const truncNote = truncated
        ? `\n[NOTE: File has ${totalRows} total rows. Showing first 500.]`
        : '';

      messages = [{
        role: 'user',
        content: `${SYSTEM_INSTRUCTION}\n\nAnalyze this spreadsheet "${fileName}".\n\nFILE INFO:\n- Total rows: ${totalRows}\n- Total columns: ${totalCols}\n- Headers: ${headerRow}${truncNote}\n\nDATA (first 100 rows):\n${sampleRows}`,
      }];
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages,
    });

    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('');

    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const analysis = JSON.parse(clean);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
