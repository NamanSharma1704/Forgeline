'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { WeaponSearch } from '../WeaponSearch';
import { onOpenSearch } from './search-bus';

/**
 * Search from anywhere (design plan 2.1): a modal over the current screen, opened by the top bar's
 * button, the phone bar's Search tab, "/" on screens without their own search, and Ctrl+K
 * everywhere. A native <dialog>, so focus moves into it, the page behind is inert, and Esc closes
 * it (the search field takes the first Esc to close its list or clear itself). The search is only
 * mounted while open, so no page loads the index until it is wanted.
 */
export function SearchOverlay({ weaponCount }: { weaponCount: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(
    () =>
      onOpenSearch(() => {
        setOpen(true);
        if (!dialog.current?.open) dialog.current?.showModal();
      }),
    []
  );

  // The field mounts after the dialog opens, so the dialog's own first-focus misses it: focus it once it is there.
  useEffect(() => {
    if (open) dialog.current?.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
  }, [open]);

  // Choosing a weapon navigates; the overlay goes with the screen it was opened on.
  useEffect(() => {
    if (dialog.current?.open) dialog.current.close();
  }, [path]);

  return (
    <dialog
      ref={dialog}
      className="search-overlay"
      aria-labelledby="search-overlay-title"
      onClose={() => setOpen(false)}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="search-overlay__frame shape shape--frame">
        <p id="search-overlay-title" className="search-overlay__title">
          Search {weaponCount} weapons
        </p>
        {open && <WeaponSearch variant="hero" label="Search weapons" />}
        <p className="search-overlay__hint">
          <kbd className="keycap">Enter</kbd> opens a weapon <kbd className="keycap">Esc</kbd> closes
        </p>
      </div>
    </dialog>
  );
}
