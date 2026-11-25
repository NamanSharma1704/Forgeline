'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { currentActions, keyAria, keyLabel, markMovedInApp, useActions, type ScreenAction } from './actions';
import { focusScreenSearch, openSearchOverlay } from './search-bus';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const matches = (action: ScreenAction, key: string) =>
  action.keyName !== undefined &&
  (action.keyName === 'Escape' ? key === 'Escape' : action.keyName === key.toLowerCase());

/** The keys every screen has, before the screen's own. */
const GLOBAL_KEYS: readonly [string, string][] = [
  ['/', 'Search, or the screen’s own search box'],
  ['Ctrl K', 'Search from anywhere, even while typing'],
  ['?', 'This list'],
];

/**
 * The action bar (design plan 4.4): the screen's primary actions bottom right, each with its key
 * in a cap, as the game shows them; above the bottom bar on phones, where the caps are hidden.
 *
 * It also owns the keyboard. Keys never fire while the player is typing in a field (Ctrl+K is the
 * one exception, as command palettes do), while a dialog is open, or with Ctrl, Alt or Cmd held.
 * "?" lists every key that works on the current screen.
 */
export function ActionDock() {
  const actions = useActions();
  const visible = actions.filter((action) => !action.keyOnly);
  const router = useRouter();
  const path = usePathname();
  const help = useRef<HTMLDialogElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // "Back" stays on the site once the player has moved between screens here.
  const firstPath = useRef(path);
  useEffect(() => {
    if (path !== firstPath.current) markMovedInApp();
  }, [path]);

  const run = (action: ScreenAction) => {
    if (action.run) action.run();
    else if (action.href) router.push(action.href);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const { key } = event;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && key.toLowerCase() === 'k') {
        event.preventDefault();
        if (!document.querySelector('dialog[open]')) openSearchOverlay();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('dialog[open]')) return;
      if (key === '/') {
        event.preventDefault();
        focusScreenSearch();
        return;
      }
      if (key === '?') {
        event.preventDefault();
        setHelpOpen(true);
        help.current?.showModal();
        return;
      }
      const action = currentActions().find((candidate) => matches(candidate, key));
      if (!action) return;
      event.preventDefault();
      if (action.run) action.run();
      else if (action.href) router.push(action.href);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  const keyed = actions.filter((action) => action.keyName);

  return (
    <>
      {visible.length > 0 && (
        <div className="action-dock" role="group" aria-label="Screen actions">
          {visible.map((action) => {
            const body = (
              <>
                {action.keyName && <kbd className="keycap">{keyLabel(action.keyName)}</kbd>}
                {action.icon && <Icon name={action.icon} size={16} />}
                <span className="dock-action__label">{action.label}</span>
              </>
            );
            const className = [
              'dock-action',
              action.primary && 'dock-action--primary',
              action.compact && 'dock-action--compact',
            ]
              .filter(Boolean)
              .join(' ');
            const shortcut = action.keyName ? keyAria(action.keyName) : undefined;
            return action.href && !action.run ? (
              <Link key={action.id} href={action.href} className={className} aria-keyshortcuts={shortcut}>
                {body}
              </Link>
            ) : (
              <button key={action.id} type="button" className={className} onClick={() => run(action)} aria-keyshortcuts={shortcut}>
                {body}
              </button>
            );
          })}
          <button
            type="button"
            className="dock-action dock-action--help"
            onClick={() => {
              setHelpOpen(true);
              help.current?.showModal();
            }}
            aria-keyshortcuts="?"
            aria-label="Keyboard keys"
            title="Keyboard keys"
          >
            <kbd className="keycap">?</kbd>
          </button>
        </div>
      )}

      <dialog ref={help} className="keys-help" aria-labelledby="keys-help-title" onClose={() => setHelpOpen(false)}>
        <div className="keys-help__frame shape shape--frame">
          <h2 id="keys-help-title" className="keys-help__title">
            Keys
          </h2>
          {helpOpen && (
            <dl className="keys-help__list">
              {GLOBAL_KEYS.map(([key, what]) => (
                <div key={key} className="keys-help__row">
                  <dt>
                    <kbd className="keycap">{key}</kbd>
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
              {keyed.map((action) => (
                <div key={action.id} className="keys-help__row">
                  <dt>
                    <kbd className="keycap">{keyLabel(action.keyName!)}</kbd>
                  </dt>
                  <dd>{action.label}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="keys-help__note">Keys do nothing while you are typing in a field.</p>
          <form method="dialog">
            <button type="submit" className="button button--small">
              Close
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
