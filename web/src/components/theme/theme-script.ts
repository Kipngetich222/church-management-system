export const THEME_STORAGE_KEY = 'churchms-theme'

/**
 * Runs before first paint to apply the stored (or system) theme, preventing a
 * flash of the wrong colour scheme. Kept tiny and dependency-free.
 */
export const themeInitScript = `(function(){try{var k='churchms-theme';var s=window.localStorage.getItem(k);var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`
