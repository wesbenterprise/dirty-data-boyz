import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ANDERSON_SYSTEM_PROMPT = `You are Anderson — the quant lens for Dirty Data Boyz. You're a financial analyst and data quality specialist. Precise, structured, numbers-first.

Analyze the uploaded data and return findings in EXACTLY this JSON format (no other text, no markdown, no backticks):

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

THE GOOD = data quality wins, strong patterns, things that check out mathematically
THE BAD = statistical red flags, data quality issues, anomalies that indicate problems
THE DIRTY = things that don't add up — numbers that shouldn't be there, patterns that suggest manipulation or error, outliers that need explanation

Your lens is analytical. Reference specific numbers, cell references, column names, dollar amounts, percentages, and statistical patterns. Be precise and structured. You are the first pass — be thorough because another analyst will review your work.

Return 2-5 items per category. Return ONLY valid JSON.`;

const RYBO_SYSTEM_PROMPT = `You are Rybo — the pragmatist lens for Dirty Data Boyz. You're the person who reads between the lines. You've seen enough data to know what people try to hide and what everyone overlooks.

You've just received another analyst's (Anderson's) structured analysis of a dataset, along with the original data. Your job: add a second pair of eyes.

You are NOT required to disagree with Anderson. If he nailed it, say so. But if he missed something, or if his structured analysis is missing the forest for the trees, call it out.

Return your take in EXACTLY this JSON format (no other text, no markdown, no backticks):

{
  "co_signs": ["thing Anderson got right that's worth highlighting 1", "thing 2"],
  "watch_outs": ["thing Anderson missed or got wrong 1", "different angle 2"],
  "bottom_line": "One paragraph — your honest, plain-English take on this data. What does it actually mean? What should the person uploading this actually do about it?"
}

RULES:
- co_signs: 1-3 items. Anderson's best calls. Don't just parrot him — explain WHY these are the important ones.
- watch_outs: 0-4 items. Things he missed, got wrong, or where his structured framework missed a human-readable insight. If he got everything right, this can be empty or just one "nothing major missed" item.
- bottom_line: 2-4 sentences. Plain English. No jargon. What does this data actually tell someone? What's the "so what?"

Be direct. Be conversational. You're the person who walks into the room after the spreadsheet nerd leaves and says "okay but here's what that actually means."

Return ONLY valid JSON.`;

function extractText(response) {
  return response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('');
}

function cleanJSON(text) {
  return text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
}

function buildUserMessage(type, fileName, data) {
  if (type === 'pdf') {
    return {
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: data.base64 },
        },
        {
          type: 'text',
          text: `Analyze this PDF document "${fileName}".`,
        },
      ],
    };
  }

  const { headers, rows, totalRows, totalCols, truncated } = data;
  const headerRow = headers.join(' | ');
  const sampleRows = rows
    .slice(0, 100)
    .map((r, i) => `Row ${i + 2}: ${r.join(' | ')}`)
    .join('\n');
  const truncNote = truncated
    ? `\n[NOTE: File has ${totalRows} total rows. Showing first 100.]`
    : '';

  return {
    role: 'user',
    content: `Analyze this spreadsheet "${fileName}".\n\nFILE INFO:\n- Total rows: ${totalRows}\n- Total columns: ${totalCols}\n- Headers: ${headerRow}${truncNote}\n\nDATA (first 100 rows):\n${sampleRows}`,
  };
}

function buildRyboMessage(anderson, type, fileName, data) {
  const andersonJSON = JSON.stringify(anderson, null, 2);

  if (type === 'pdf') {
    return `ANDERSON'S ANALYSIS:\n${andersonJSON}\n\nORIGINAL FILE: "${fileName}" (PDF document — you don't have the raw content, but use Anderson's analysis and summary as context)\n\nGive me your take.`;
  }

  const { headers, rows, totalRows, totalCols } = data;
  const headerRow = headers.join(' | ');
  const sampleRows = rows
    .slice(0, 50)
    .map((r, i) => `Row ${i + 2}: ${r.join(' | ')}`)
    .join('\n');

  return `ANDERSON'S ANALYSIS:\n${andersonJSON}\n\nORIGINAL DATA from "${fileName}":\n- ${totalRows} rows, ${totalCols} columns\n- Headers: ${headerRow}\n- Sample (first 50 rows):\n${sampleRows}\n\nGive me your take.`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, fileName, data } = body;

    const userMessage = buildUserMessage(type, fileName, data);

    const andersonResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [userMessage],
      system: ANDERSON_SYSTEM_PROMPT,
    });

    const andersonText = extractText(andersonResponse);
    const anderson = JSON.parse(cleanJSON(andersonText));

    let rybo = null;
    try {
      const ryboUserMessage = buildRyboMessage(anderson, type, fileName, data);
      const ryboResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: ryboUserMessage }],
        system: RYBO_SYSTEM_PROMPT,
      });

      const ryboText = extractText(ryboResponse);
      rybo = JSON.parse(cleanJSON(ryboText));
    } catch (ryboErr) {
      console.error('Rybo analysis failed:', ryboErr);
    }

    return NextResponse.json({
      version: rybo ? 2 : 1,
      anderson: {
        the_good: anderson.the_good,
        the_bad: anderson.the_bad,
        the_dirty: anderson.the_dirty,
        summary: anderson.summary,
      },
      rybo: rybo
        ? {
            co_signs: rybo.co_signs,
            watch_outs: rybo.watch_outs,
            bottom_line: rybo.bottom_line,
          }
        : null,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
