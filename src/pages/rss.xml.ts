import { getCollection, type CollectionEntry } from 'astro:content';
import type { APIRoute } from 'astro';
import { getDashboardIndicators } from '../data/dashboard';
import { getCategory } from '../data/categories';
import { buildRssEventGuid, renderRssXml, type RssItem } from '../data/rss';

export const prerender = true;

function absoluteOrRelativeUrl(path: string, site?: URL): string {
  return site ? new URL(path, site).toString() : path;
}

function conceptItem(concept: CollectionEntry<'concepts'>, site?: URL): RssItem {
  const path = `/concepts/${encodeURIComponent(concept.data.id)}`;
  return {
    title: concept.data.name,
    description: concept.data.subtitle,
    link: absoluteOrRelativeUrl(path, site),
    guid: buildRssEventGuid(absoluteOrRelativeUrl(path, site), 'update', concept.data.updatedAt),
    pubDate: concept.data.updatedAt,
    category: getCategory(concept.data.category).label,
  };
}

export const GET: APIRoute = async ({ site }) => {
  const concepts = await getCollection('concepts');
  const conceptItems = concepts.map((concept) => conceptItem(concept, site));
  const dataItems = getDashboardIndicators().map((indicator): RssItem => {
    const path = indicator.conceptHref;
    const latestObservation = indicator.latest;
    return {
      title: `数据更新：${indicator.name}`,
      description: `${indicator.dataset.label} 数据已更新，最新观测期为 ${latestObservation.date}。`,
      link: absoluteOrRelativeUrl(path, site),
      guid: buildRssEventGuid(absoluteOrRelativeUrl(path, site), 'data', indicator.dataset.updatedAt),
      pubDate: indicator.dataset.updatedAt,
      category: '数据更新',
    };
  });

  const xml = renderRssXml({
    title: 'MacroLens 知识库更新',
    description: 'MacroLens 概念内容与宏观指标数据更新。',
    link: absoluteOrRelativeUrl('/', site),
    selfLink: absoluteOrRelativeUrl('/rss.xml', site),
    items: [...conceptItems, ...dataItems],
  });

  return new Response(xml, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
