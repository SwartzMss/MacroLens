export type RssItem = {
  title: string;
  description: string;
  link: string;
  guid?: string;
  pubDate: Date | string;
  category: string;
};

export type RssFeed = {
  title: string;
  description: string;
  link: string;
  selfLink: string;
  items: RssItem[];
};

function asDate(value: Date | string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid RSS date: ${String(value)}`);
  return date;
}

export function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => {
    switch (character) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '\"': return '&quot;';
      default: return character;
    }
  });
}

export function formatRssDate(value: Date | string): string {
  return asDate(value).toUTCString();
}

export function buildRssEventGuid(link: string, eventType: string, date: Date | string): string {
  return `${link}#${eventType}-${asDate(date).toISOString()}`;
}

export function sortRssItems(items: RssItem[]): RssItem[] {
  return [...items].sort((left, right) => {
    const dateDifference = asDate(right.pubDate).getTime() - asDate(left.pubDate).getTime();
    return dateDifference || left.title.localeCompare(right.title, 'zh-CN');
  });
}

export function renderRssXml(feed: RssFeed): string {
  const items = sortRssItems(feed.items);
  const lastBuildDate = items[0] ? formatRssDate(items[0].pubDate) : formatRssDate(new Date(0));
  const itemXml = items.map((item) => {
    const link = escapeXml(item.link);
    const guid = escapeXml(item.guid ?? item.link);
    return [
      '    <item>',
      `      <title>${escapeXml(item.title)}</title>`,
      `      <description>${escapeXml(item.description)}</description>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="false">${guid}</guid>`,
      `      <pubDate>${formatRssDate(item.pubDate)}</pubDate>`,
      `      <category>${escapeXml(item.category)}</category>`,
      '    </item>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(feed.title)}</title>`,
    `    <description>${escapeXml(feed.description)}</description>`,
    `    <link>${escapeXml(feed.link)}</link>`,
    `    <atom:link href="${escapeXml(feed.selfLink)}" rel="self" type="application/rss+xml" />`,
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    '    <language>zh-CN</language>',
    ...itemXml,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
