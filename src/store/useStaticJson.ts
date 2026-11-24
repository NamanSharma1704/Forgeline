'use client';

import { useEffect, useState } from 'react';

/**
 * Fetch one of the site's static JSON files once per page view, shared by every caller. For small
 * build-time files such as /materials.json; the recipe graph has its own loader (useRecipeGraph).
 */

const cache = new Map<string, Promise<unknown>>();

function load<T>(url: string): Promise<T> {
  let pending = cache.get(url) as Promise<T> | undefined;
  if (!pending) {
    pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      return response.json() as Promise<T>;
    });
    pending.catch(() => cache.delete(url));
    cache.set(url, pending);
  }
  return pending;
}

export function useStaticJson<T>(url: string, enabled = true): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    load<T>(url).then(
      (value) => live && setData(value),
      () => undefined
    );
    return () => {
      live = false;
    };
  }, [url, enabled]);
  return data;
}
