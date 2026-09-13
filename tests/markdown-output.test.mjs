import assert from 'node:assert/strict';
import test from 'node:test';
import { findUnrenderedEmphasis } from '../scripts/verify/markdown-output.mjs';

test('catches literal emphasis left in rendered Chinese prose', () => {
  assert.equal(findUnrenderedEmphasis('<p>投资。**贷款会创造存款。**但有条件。</p>').length, 1);
  assert.equal(findUnrenderedEmphasis('<p>__强调__ 与 ~~删除线~~</p>').length, 1);
  assert.deepEqual(findUnrenderedEmphasis('<p>投资。<strong>贷款会创造存款</strong>。但有条件。</p>'), []);
});

test('ignores literal syntax in code, attributes, scripts, styles and comments', () => {
  const html = '<p data-pattern="**">正文 <code>**加粗**</code></p><pre>__代码__</pre><script>"**"</script><style>/* ** */</style><!-- ** -->';
  assert.deepEqual(findUnrenderedEmphasis(html), []);
});
