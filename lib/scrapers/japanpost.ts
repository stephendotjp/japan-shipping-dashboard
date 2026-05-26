export async function scrapeJapanPost(): Promise<string> {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: 'https://www.post.japanpost.jp/int/information/index_en.html',
      formats: ['markdown'],
      actions: [{ type: 'wait', milliseconds: 2000 }],
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`Firecrawl failed: ${data.error}`);
  return data.data.markdown;
}
