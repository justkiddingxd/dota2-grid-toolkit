// Keep native <details> semantics, including keyboard activation and the no-JS
// fallback. Delegation also covers disclosure controls mounted inside dialogs.
export function mountDisclosureMotion(root) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Map();
  function settle(details, state) {
    if (active.get(details) !== state) return;
    active.delete(details);
    state.animation?.cancel();
    details.open = state.open;
    details.style.overflow = state.overflow;
    details.style.removeProperty('--disclosure-duration');
    delete details.dataset.disclosureState;
  }
  function click(event) {
    if (event.defaultPrevented || event.button !== 0) return;
    const summary = event.target.closest?.('summary');
    const details = summary?.parentElement;
    if (details?.tagName !== 'DETAILS' || details.firstElementChild !== summary) return;
    if (event.target.closest('a,button,input,select,textarea')) return;
    const previous = active.get(details);
    const open = !(previous ? previous.open : details.open);
    // Let the browser handle the instant path. If the preference changed in
    // flight, the change listener has already settled the previous animation.
    if (reduced.matches || !details.animate) return;
    event.preventDefault();
    const start = details.getBoundingClientRect().height;
    previous?.animation.cancel();
    const overflow = previous ? previous.overflow : details.style.overflow;
    details.style.overflow = overflow;
    delete details.dataset.disclosureState;
    details.open = open;
    const end = details.getBoundingClientRect().height;
    // Large guides need time to unfold. Ease in as well as out: the previous
    // exponential curve spent almost its entire travel in the first 100ms.
    const distance = Math.abs(end - start);
    const duration = open ? Math.min(560, 300 + distance * .55) : Math.min(380, 220 + distance * .35);
    details.style.setProperty('--disclosure-duration', `${duration}ms`);
    // Closing keeps the content painted until it has folded away.
    details.open = true;
    details.style.overflow = 'clip';
    details.dataset.disclosureState = open ? 'opening' : 'closing';
    if (!open && details.contains(document.activeElement) && document.activeElement !== summary) {
      summary.focus({ preventScroll: true });
    }
    const style = getComputedStyle(details);
    const inset = style.boxSizing === 'border-box' ? 0 :
      ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
        .reduce((sum, name) => sum + (parseFloat(style[name]) || 0), 0);
    const state = { open, overflow, animation: null };
    active.set(details, state);
    state.animation = details.animate([
      { height: `${Math.max(0, start - inset)}px` },
      { height: `${Math.max(0, end - inset)}px` }
    ], { duration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
    state.animation.onfinish = () => settle(details, state);
  }
  function finishAll() { for (const [details, state] of active) settle(details, state); }
  function preferenceChanged() { if (reduced.matches) finishAll(); }
  root.addEventListener('click', click);
  reduced.addEventListener('change', preferenceChanged);
  return () => {
    root.removeEventListener('click', click);
    reduced.removeEventListener('change', preferenceChanged);
    finishAll();
  };
}
