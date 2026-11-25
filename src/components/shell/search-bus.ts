/**
 * Opening search from anywhere: the top bar's button, the phone bar's tab, "/" and Ctrl+K all ask
 * the one overlay to open, through a window event, so none of them needs to be its parent.
 */
const OPEN_SEARCH = 'forgeline:open-search';

export function openSearchOverlay() {
  window.dispatchEvent(new Event(OPEN_SEARCH));
}

export function onOpenSearch(handler: () => void) {
  window.addEventListener(OPEN_SEARCH, handler);
  return () => window.removeEventListener(OPEN_SEARCH, handler);
}

/**
 * "/" prefers the screen's own search (Home's console, the Foundry's weapon picker), as it always
 * has; screens without one get the overlay.
 */
export function focusScreenSearch() {
  const own = document.querySelector<HTMLInputElement>('main [data-search-input="hero"]');
  if (!own) {
    openSearchOverlay();
    return;
  }
  own.focus();
  own.select();
  own.scrollIntoView({ block: 'center' });
}
