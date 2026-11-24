/**
 * Theme constants shared by the server layout and the client toggle. Kept out of the 'use client'
 * module on purpose: a server component importing from one receives client references, not values,
 * so the inline script string has to live here.
 */

export const THEME_STORAGE_KEY = 'forgeline-theme';

/**
 * Runs in <head> before first paint and applies a saved theme. Dark is the default, so with nothing
 * saved it does nothing. Wrapped in try/catch because storage can be blocked.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
