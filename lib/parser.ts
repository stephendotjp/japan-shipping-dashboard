import Anthropic from '@anthropic-ai/sdk';
import { ParsedStatus } from './db';

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a shipping status parser. Extract ONLY what is explicitly stated
in the provided text scraped from an official carrier website.

RULES:
- Never infer, assume, or add information not present in the text
- If something is not mentioned, mark it as "unknown"
- Quote source text directly in alert descriptions where possible
- If the page appears to be a generic homepage with no alerts, set allClear: true

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "carrier": string,
  "usDestinationStatus": "operational" | "partial" | "suspended" | "unknown",
  "japanOriginStatus": "operational" | "partial" | "suspended" | "unknown",
  "allClear": boolean,
  "activeAlerts": [{
    "title": string,
    "description": string,
    "severity": "info" | "warning" | "critical"
  }],
  "rawSummary": string,
  "confidence": "high" | "medium" | "low",
  "scrapedContentLength": number
}`;

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

export async function parseCarrierMarkdown(
  carrierName: string,
  raw: string
): Promise<ParsedStatus> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Carrier: ${carrierName}\n\nScraped content (${raw.length} chars):\n\n${raw.slice(0, 8000)}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = stripFences(text);

  const parsed = JSON.parse(cleaned) as ParsedStatus;
  parsed.updatedAt = new Date().toISOString();
  return parsed;
}
