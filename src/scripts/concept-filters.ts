const form = document.querySelector<HTMLFormElement>('[data-concept-filters]');
const cards = [...document.querySelectorAll<HTMLElement>('[data-concept-card]')];
const sections = [...document.querySelectorAll<HTMLElement>('[data-category-section]')];
const empty = document.querySelector<HTMLElement>('[data-filter-empty]');
const filterNames = ['category', 'level'] as const;

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
  writeUrl({ replace: true });
}

function writeUrl({ replace = false } = {}) {
  const url = new URL(window.location.href);
  for (const name of filterNames) {
    const value = selected(name)?.value ?? 'all';
    if (value === 'all') url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  }
  url.searchParams.delete('topic');
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === next) return;
  if (replace) window.history.replaceState(null, '', next);
  else window.history.pushState(null, '', next);
}

function apply({ syncUrl = false } = {}) {
  const category = selected('category')?.value ?? 'all';
  const level = selected('level')?.value ?? 'all';
  let visible = 0;

  for (const card of cards) {
    const matches = (category === 'all' || card.dataset.category === category)
      && (level === 'all' || card.dataset.level === level);
    card.hidden = !matches;
    if (matches) visible += 1;
  }
  for (const section of sections) {
    const matches = section.querySelectorAll('[data-concept-card]:not([hidden])').length;
    section.hidden = matches === 0;
  }
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
