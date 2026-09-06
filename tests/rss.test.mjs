import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeXml, formatRssDate, renderRssXml, sortRssItems } from '../src/data/rss.ts';

test('escapes XML text and attributes', () => {
  assert.equal(escapeXml(`A < B & C > D 'quoted' "text"`), 'A &lt; B &amp; C &gt; D &apos;quoted&apos; &quot;text&quot;');
});

test('renders a standard RSS channel with escaped feed items', () => {
  const xml = renderRssXml({
    title: 'MacroLens & updates',
    description: 'Knowledge <updates>',
    link: 'https://example.test/',
    selfLink: 'https://example.test/rss.xml?format=xml&v=1',
    items: [{
      title: 'GDP <updated>',
      description: 'Definition & context',
      link: 'https://example.test/concepts/gdp',
      pubDate: '2026-09-02',
      category: '经济增长',
    }],
  });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0" xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.match(xml, /<atom:link href="https:\/\/example\.test\/rss\.xml\?format=xml&amp;v=1" rel="self" type="application\/rss\+xml" \/>/);
  assert.match(xml, /<title>GDP &lt;updated&gt;<\/title>/);
  assert.match(xml, /<description>Definition &amp; context<\/description>/);
  assert.match(xml, /<pubDate>Wed, 02 Sep 2026 00:00:00 GMT<\/pubDate>/);
  assert.match(xml, /<category>经济增长<\/category>/);
});

test('sorts newest updates first without mutating the input', () => {
  const items = [
    { title: 'Older', description: '', link: '/older', pubDate: '2026-08-01', category: 'x' },
    { title: 'Newer', description: '', link: '/newer', pubDate: '2026-09-01', category: 'x' },
  ];

  assert.deepEqual(sortRssItems(items).map((item) => item.title), ['Newer', 'Older']);
  assert.deepEqual(items.map((item) => item.title), ['Older', 'Newer']);
  assert.equal(formatRssDate('2026-09-01'), 'Tue, 01 Sep 2026 00:00:00 GMT');
});
