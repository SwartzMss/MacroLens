import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { onRequest } from '../functions/api/feedback.ts';
import { VISITOR_COOKIE } from '../functions/visitor.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const feedbackComponent = `${root}src/components/PageFeedback.astro`;
const conceptPage = `${root}src/pages/concepts/[id].astro`;
const migration = `${root}migrations/0001_page_feedback.sql`;
const apiSource = `${root}functions/api/feedback.ts`;

const visitorId = '123e4567-e89b-42d3-a456-426614174000';

function createDatabase({ failRun = false, failFirst = false } = {}) {
  const rows = new Map();
  const statements = [];
  return {
    rows,
    statements,
    prepare(query) {
      const statement = {
        query,
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
        async run() {
          if (failRun) throw new Error('D1 unavailable');
          const [pageId, boundVisitorId, vote, reason, createdAt, updatedAt] = this.values;
          const key = `${pageId}:${boundVisitorId}`;
          const previous = rows.get(key);
          rows.set(key, {
            pageId,
            visitorId: boundVisitorId,
            vote,
            reason,
            createdAt: previous?.createdAt ?? createdAt,
            updatedAt,
          });
          return { success: true };
        },
        async first() {
          if (failFirst) throw new Error('D1 unavailable');
          const [pageId, boundVisitorId] = this.values;
          const row = rows.get(`${pageId}:${boundVisitorId}`);
          return row ? { vote: row.vote, reason: row.reason } : null;
        },
      };
      statements.push(statement);
      return statement;
    },
  };
}

function requestFor(path = 'gdp', body, { cookie = visitorId, origin = 'https://macrolens.example', headers = {} } = {}) {
  const requestHeaders = {
    accept: 'application/json',
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(cookie === null ? {} : { cookie: `${VISITOR_COOKIE}=${cookie}` }),
    ...(origin === null ? {} : { origin }),
    ...headers,
  };
  return new Request(`https://macrolens.example/api/feedback${path ? `?pageId=${encodeURIComponent(path)}` : ''}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: requestHeaders,
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
}

async function responseBody(response) {
  return response.json();
}

test('stores a valid helpful vote without exposing the visitor ID', async () => {
  const database = createDatabase();
  const response = await onRequest({
    request: requestFor('gdp', { pageId: 'gdp', vote: 'helpful' }),
    env: { FEEDBACK_DB: database },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await responseBody(response), { ok: true });
  assert.deepEqual([...database.rows.values()].map(({ pageId, vote, reason }) => ({ pageId, vote, reason })), [
    { pageId: 'gdp', vote: 1, reason: null },
  ]);
  assert.match(database.statements[0].query, /ON CONFLICT\s*\(page_id, visitor_id\)/i);
});

test('stores needs-improvement, reads the current state, and accepts fixed reasons', async () => {
  const database = createDatabase();
  const post = await onRequest({
    request: requestFor('m2', { pageId: 'm2', vote: 'needs-improvement', reason: 'missing_example' }),
    env: { FEEDBACK_DB: database },
  });
  assert.equal(post.status, 200);

  const get = await onRequest({
    request: requestFor('m2'),
    env: { FEEDBACK_DB: database },
  });
  assert.equal(get.status, 200);
  assert.deepEqual(await responseBody(get), { ok: true, vote: 'needs-improvement', reason: 'missing_example' });
  assert.match(database.statements[0].query, /reason\s*=\s*excluded\.reason/i);
});

test('rejects invalid votes, page IDs, and free-text reasons', async () => {
  const database = createDatabase();
  const requests = [
    { pageId: 'gdp', vote: 'yes' },
    { pageId: '../gdp', vote: 'helpful' },
    { pageId: 'gdp', vote: 'needs-improvement', reason: '页面太难了' },
    { pageId: 'gdp', vote: 'helpful', reason: 'too_complex' },
  ];
  for (const body of requests) {
    const response = await onRequest({ request: requestFor(body.pageId, body), env: { FEEDBACK_DB: database } });
    assert.equal(response.status, 400);
    assert.deepEqual(await responseBody(response), { ok: false });
  }
  assert.equal(database.rows.size, 0);
});

test('rejects missing or invalid visitor cookies before writing to D1', async () => {
  const database = createDatabase();
  for (const cookie of [null, 'not-a-uuid']) {
    const response = await onRequest({
      request: requestFor('gdp', { pageId: 'gdp', vote: 'helpful' }, { cookie }),
      env: { FEEDBACK_DB: database },
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await responseBody(response), { ok: false });
  }
  assert.equal(database.rows.size, 0);
});

test('updates one page per visitor and keeps pages independent', async () => {
  const database = createDatabase();
  const submit = (pageId, vote, reason) => onRequest({
    request: requestFor(pageId, { pageId, vote, ...(reason ? { reason } : {}) }),
    env: { FEEDBACK_DB: database },
  });

  await submit('gdp', 'helpful');
  await submit('gdp', 'needs-improvement');
  await submit('m2', 'helpful');

  assert.equal(database.rows.size, 2);
  assert.equal(database.rows.get(`gdp:${visitorId}`).vote, -1);
  assert.equal(database.rows.get(`m2:${visitorId}`).vote, 1);
});

test('enforces JSON, bounded same-origin writes, and failure-safe D1 responses', async () => {
  const database = createDatabase();
  const wrongType = await onRequest({
    request: requestFor('gdp', '{"pageId":"gdp","vote":"helpful"}', { headers: { 'content-type': 'text/plain' } }),
    env: { FEEDBACK_DB: database },
  });
  assert.equal(wrongType.status, 415);

  const crossOrigin = await onRequest({
    request: requestFor('gdp', { pageId: 'gdp', vote: 'helpful' }, { origin: 'https://evil.example' }),
    env: { FEEDBACK_DB: database },
  });
  assert.equal(crossOrigin.status, 403);

  const tooLarge = await onRequest({
    request: requestFor('gdp', '{}', { headers: { 'content-type': 'application/json', 'content-length': '2049' } }),
    env: { FEEDBACK_DB: database },
  });
  assert.equal(tooLarge.status, 413);

  const unavailable = await onRequest({
    request: requestFor('gdp', { pageId: 'gdp', vote: 'helpful' }),
    env: { FEEDBACK_DB: createDatabase({ failRun: true }) },
  });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await responseBody(unavailable), { ok: false });
});

test('renders feedback on concept pages outside relationship navigation', () => {
  const component = readFileSync(feedbackComponent, 'utf8');
  const page = readFileSync(conceptPage, 'utf8');
  const api = readFileSync(apiSource, 'utf8');
  const sql = readFileSync(migration, 'utf8');

  assert.match(component, /这篇解释对你有帮助吗/);
  assert.match(component, /data-feedback-vote="helpful"/);
  assert.match(component, /aria-pressed/);
  assert.match(component, /credentials:\s*['"]same-origin['"]/);
  for (const reason of ['too_complex', 'missing_example', 'unclear_chart', 'incomplete', 'questionable']) {
    assert.match(component, new RegExp(reason));
    assert.match(api, new RegExp(reason));
  }
  assert.doesNotMatch(component, /textarea|contenteditable|自由文本/);
  assert.match(page, /import PageFeedback from .*PageFeedback\.astro/);
  assert.ok(page.indexOf('<PageFeedback pageId={entry.data.id} />') < page.indexOf('<RelationshipCards'), 'feedback should precede relationship navigation');
  assert.match(api, /parseVisitorCookie/);
  assert.match(api, /FEEDBACK_DB/);
  assert.match(sql, /PRIMARY KEY\s*\(page_id, visitor_id\)/i);
  assert.match(sql, /CHECK\s*\(vote\s+IN\s*\(-1, 1\)\)/i);
});
