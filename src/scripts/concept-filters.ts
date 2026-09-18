const form = document.querySelector<HTMLFormElement>('[data-concept-filters]');
const cards = [...document.querySelectorAll<HTMLElement>('[data-concept-card]')];
const sections = [...document.querySelectorAll<HTMLElement>('[data-category-section]')];
const count = document.querySelector<HTMLElement>('[data-filter-count]');
const categoryCount = document.querySelector<HTMLElement>('[data-filter-category-count]');
const empty = document.querySelector<HTMLElement>('[data-filter-empty]');
const filterNames = ['category', 'level', 'topic'] as const;
const filterPanel = document.querySelector<HTMLDetailsElement>('[data-filter-panel]');

function selected(name: string) {
  return form?.elements.namedItem(name) as HTMLSelectElement | null;
}

function readUrl() {
  const params = new URLSearchParams(window.location.search);
  for (const name of filterNames) {
    const control = selected(name);
    const value = params.get(name);
    if (control) control.value = value && [...control.options].some(option => option.value === value) ? value : 'all';
  }
  if (filterPanel && filterNames.some((name) => params.get(name) && params.get(name) !== 'all')) filterPanel.open = true;
}

function writeUrl() {
  const url = new URL(window.location.href);
  for (const name of filterNames) {
    const value = selected(name)?.value ?? 'all';
    if (value === 'all') url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current !== next) window.history.pushState(null, '', next);
}

function apply({ syncUrl = false } = {}) {
  const category = selected('category')?.value ?? 'all';
  const topic = selected('topic')?.value ?? 'all';
  const level = selected('level')?.value ?? 'all';
  let visible = 0;

  for (const card of cards) {
    const matches = (category === 'all' || card.dataset.category === category)
      && (topic === 'all' || card.dataset.topics?.split(' ').includes(topic))
      && (level === 'all' || card.dataset.level === level);
    card.hidden = !matches;
    if (matches) visible += 1;
  }
  let visibleCategories = 0;
  for (const section of sections) {
    const matches = section.querySelectorAll('[data-concept-card]:not([hidden])').length;
    section.hidden = matches === 0;
    if (matches) visibleCategories += 1;
    const sectionCount = section.querySelector<HTMLElement>('[data-category-count]');
    if (sectionCount) sectionCount.textContent = `${matches} 个概念`;
  }
  if (count) count.textContent = `${visible} 个概念`;
  if (categoryCount) categoryCount.textContent = `${visibleCategories} 个领域`;
  if (empty) empty.hidden = visible !== 0;
  if (syncUrl) writeUrl();
}

form?.addEventListener('change', () => apply({ syncUrl: true }));
window.addEventListener('popstate', () => {
  readUrl();
  apply();
});
document.querySelector<HTMLButtonElement>('[data-filter-reset]')?.addEventListener('click', () => {
  form?.reset();
  apply({ syncUrl: true });
  selected('category')?.focus();
});
readUrl();
apply();
