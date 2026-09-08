// Keep both old article anchors and new section links usable inside disclosures.
function revealHashTarget() {
  if (!location.hash) return;
  let id: string;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (!target) return;
  let opened = false;
  if (target instanceof HTMLDetailsElement && !target.open) {
    target.open = true;
    opened = true;
  }
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement && !parent.open) {
      parent.open = true;
      opened = true;
    }
  }
  if (opened) target.scrollIntoView({ block: 'start' });
}

document.querySelectorAll<HTMLAnchorElement>('[data-detail-navigation] a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    document.querySelectorAll<HTMLDetailsElement>('.detail-mobile-toc').forEach(menu => { menu.open = false; });
    // Run after the native fragment navigation, including repeated clicks on the same hash.
    requestAnimationFrame(() => {
      revealHashTarget();
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: 'start' });
      }
    });
  });
});
document.querySelectorAll<HTMLDetailsElement>('.detail-mobile-toc').forEach(menu => {
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  });
});
window.addEventListener('hashchange', revealHashTarget);
revealHashTarget();
