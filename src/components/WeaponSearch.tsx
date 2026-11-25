'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SLOT_LABEL } from '@/data/types';
import { createSearcher, type SearchEntry, type Searcher } from '@/search/rank';
import { Icon } from './Icon';
import { WeaponArt } from './WeaponArt';

/**
 * The search box (spec 5.1): matches as you type, tolerates typos, shows each weapon's picture,
 * and opens the weapon's page, where the verdict is the first thing on screen.
 *
 * Follows the ARIA combobox pattern: the input keeps focus while arrow keys move the active
 * option, Enter opens it, Escape closes the list and then clears the field.
 *
 * The index is one small static file shared by every search box on the page, fetched once.
 */

let pending: Promise<Searcher> | null = null;

function loadSearcher(): Promise<Searcher> {
  if (!pending) {
    pending = fetch('/search-index.json')
      .then((response) => {
        if (!response.ok) throw new Error(`search index: HTTP ${response.status}`);
        return response.json() as Promise<SearchEntry[]>;
      })
      .then((entries) => createSearcher(entries));
    // A failed load must not poison later attempts.
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function WeaponSearch({
  variant,
  onSelect,
  placeholder,
  label = 'Search weapons',
  filter,
}: {
  variant: 'hero' | 'compact';
  /** Pick a weapon instead of opening its page (the build planner uses this). */
  onSelect?: (entry: SearchEntry) => void;
  placeholder?: string;
  label?: string;
  /** Narrow the results, as the home page's category strip does. Keep it stable (memoised). */
  filter?: (entry: SearchEntry) => boolean;
}) {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [searcher, setSearcher] = useState<Searcher | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const ensureLoaded = useCallback(() => {
    if (searcher || status === 'loading') return;
    setStatus('loading');
    loadSearcher().then(
      (loaded) => {
        setSearcher(() => loaded);
        setStatus('ready');
      },
      () => setStatus('error')
    );
  }, [searcher, status]);

  // The home page's search is the page: have the index ready before the first keystroke.
  useEffect(() => {
    if (variant === 'hero') ensureLoaded();
  }, [variant, ensureLoaded]);

  const trimmed = query.trim();
  // With a filter (the home page's category strip), rank wider first so eight still survive it.
  const results = useMemo(
    () =>
      searcher && trimmed
        ? filter
          ? searcher(trimmed, 80).filter(filter).slice(0, 8)
          : searcher(trimmed, 8)
        : [],
    [searcher, trimmed, filter]
  );
  const activeEntry = results[Math.min(active, results.length - 1)];

  // Warm the page the player is most likely to open next.
  useEffect(() => {
    if (activeEntry && !onSelect) router.prefetch(`/w/${activeEntry.s}/`);
  }, [activeEntry, router, onSelect]);

  const go = (entry: SearchEntry) => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    if (onSelect) onSelect(entry);
    else router.push(`/w/${entry.s}/`);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setOpen(true);
        setActive((i) => (results.length ? (i + 1) % results.length : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setOpen(true);
        setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
        break;
      case 'Enter':
        if (activeEntry) {
          event.preventDefault();
          go(activeEntry);
        }
        break;
      case 'Escape':
        if (open && trimmed) setOpen(false);
        else {
          setQuery('');
          inputRef.current?.blur();
        }
        break;
    }
  };

  const showPanel = open && trimmed.length > 0;
  const optionId = (index: number) => `${id}-option-${index}`;

  let panel: React.ReactNode = null;
  if (showPanel) {
    if (status === 'error') {
      panel = (
        <p className="search__status">
          Couldn&apos;t load the weapon list. Check your connection, then type again to retry.
        </p>
      );
    } else if (!searcher) {
      panel = <p className="search__status">Loading weapons…</p>;
    } else if (results.length === 0) {
      panel = (
        <p className="search__status">
          No weapon matches &ldquo;{trimmed}&rdquo;. Try part of the name, like &ldquo;bolt&rdquo;.
        </p>
      );
    } else {
      panel = (
        <ul className="search__list" role="listbox" id={listId} aria-label="Weapons">
          {results.map((entry, index) => (
            <li
              key={entry.s}
              id={optionId(index)}
              role="option"
              aria-selected={entry === activeEntry}
              className="search__option"
              // Keep focus in the input so the list does not close before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => go(entry)}
            >
              <WeaponArt
                weapon={{
                  name: entry.n,
                  slot: entry.t,
                  thumb: `img/thumb/${entry.s}.webp`,
                  image: `img/${entry.s}.webp`,
                }}
              />
              <span className="search__option-text">
                <span className="search__option-name">{entry.n}</span>
                <span className="search__option-meta">
                  {SLOT_LABEL[entry.t]}
                  {entry.b > 0 && (
                    <span className="search__feeds">
                      {' '}
                      · used in {entry.b} {entry.b === 1 ? 'recipe' : 'recipes'}
                    </span>
                  )}
                </span>
              </span>
            </li>
          ))}
        </ul>
      );
    }
  }

  return (
    <form
      role="search"
      className={`search search--${variant}`}
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="search__field shape">
        <Icon name="search" className="search__icon" />
        <input
          ref={inputRef}
          className="search__input"
          data-search-input={variant}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={
            placeholder ?? (variant === 'hero' ? 'Type a weapon, like Bolto' : 'Search weapons')
          }
          aria-label={label}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel && results.length > 0}
          aria-controls={listId}
          aria-activedescendant={
            showPanel && activeEntry ? optionId(results.indexOf(activeEntry)) : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
            ensureLoaded();
          }}
          onFocus={() => {
            ensureLoaded();
            if (trimmed) setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="search__clear"
            aria-label="Clear search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" size={18} />
          </button>
        ) : (
          <kbd className="search__kbd" aria-hidden="true">
            /
          </kbd>
        )}
      </div>
      {panel && <div className="search__panel">{panel}</div>}
      <p className="sr-only" role="status" aria-live="polite">
        {showPanel && searcher
          ? results.length === 0
            ? 'No matching weapons'
            : `${results.length} ${results.length === 1 ? 'weapon' : 'weapons'} found`
          : ''}
      </p>
    </form>
  );
}
