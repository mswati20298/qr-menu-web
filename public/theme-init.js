// Runs before the page paints, so a dark-mode visitor never sees a white flash. Kept as a file (not inline)
// so the Content-Security-Policy can forbid inline scripts.
try {
  var t = localStorage.getItem('qrmenu_theme');
  if (t !== 'dark' && t !== 'light') {
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
