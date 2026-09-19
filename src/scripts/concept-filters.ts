const form = document.querySelector<HTMLFormElement>('[data-concept-filters]');
const cards = [...document.querySelectorAll<HTMLElement>('[data-concept-card]')];
const sections = [...document.querySelectorAll<HTMLElement>('[data-category-section]')];
const empty = document.querySelector<HTMLElement>('[data-filter-empty]');
const filterNames = ['category', 'level', 'topic'] as const;

function selected(name: string) {
  return form?.elements.namedItem(name) as HTMLSelectElement | null;
}

function syncTopicOptions() {
  const category = selected('category')?.value ?? 'all';
  const topic = selected('topic');
  if (!topic) return;

  for (const option of [...topic.options]) {
    const topicCategory = option.dataset.topicCategory;
    option.disabled = option.value !== 'all' && category !== 'all' && topicCategory !== category;
  }

  const current = topic.selectedOptions[0];
  if (current?.disabled) topic.value = 'all';
}

function readUrl() {
  const params = new URLSearchParams(window.location.search);
  for (const name of filterNames) {
    const control = selected(name);
    const value = params.get(name);
    if (control) control.value = value && [...control.options].some(option => option.value === value) ? value : 'all';
  }
  syncTopicOptions();
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
  for (const section of sections) {
    const matches = section.querySelectorAll('[data-concept-card]:not([hidden])').length;
    section.hidden = matches === 0;
  }
  if (empty) empty.hidden = visible !== 0;
  if (syncUrl) writeUrl();
}

form?.addEventListener('change', (event) => {
  if ((event.target as HTMLSelectElement | null)?.name === 'category') syncTopicOptions();
  apply({ syncUrl: true });
});
window.addEventListener('popstate', () => {
  readUrl();
  apply();
});
document.querySelector<HTMLButtonElement>('[data-filter-reset]')?.addEventListener('click', () => {
  form?.reset();
  syncTopicOptions();
  apply({ syncUrl: true });
  selected('category')?.focus();
});
readUrl();
apply();
