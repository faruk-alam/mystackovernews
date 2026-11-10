(() => {
  const root = document.documentElement;
  const themeButton = document.getElementById('theme-toggle');
  const menuButton = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  const progress = document.getElementById('reading-progress');

  const storedTheme = localStorage.getItem('son-theme');
  if (storedTheme === 'dark' || (!storedTheme && matchMedia('(prefers-color-scheme: dark)').matches)) root.classList.add('dark');
  themeButton?.addEventListener('click', () => {
    root.classList.toggle('dark');
    localStorage.setItem('son-theme', root.classList.contains('dark') ? 'dark' : 'light');
  });

  menuButton?.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Open menu' : 'Close menu');
    menu?.classList.toggle('hidden', isOpen);
  });

  let scrollQueued = false;
  const updateProgress = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    progress?.style.setProperty('transform', `scaleX(${scrollable > 0 ? window.scrollY / scrollable : 0})`);
    scrollQueued = false;
  };
  window.addEventListener('scroll', () => {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  updateProgress();

  const inputs = [document.getElementById('site-search'), document.getElementById('mobile-site-search')].filter(Boolean);
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const depth = pathParts.length;
  const searchUrl = new URL(`${'../'.repeat(depth)}search.json`, window.location.href);
  let searchItems = [];
  let loadPromise;
  const loadSearch = () => loadPromise ||= fetch(searchUrl).then(response => {
    if (!response.ok) throw new Error('Search index unavailable');
    return response.json();
  }).then(items => (searchItems = items)).catch(() => []);
  const renderResults = (input, query) => {
    const results = input.id === 'mobile-site-search' ? document.getElementById('mobile-search-results') : document.getElementById('search-results');
    if (!results) return;
    results.replaceChildren();
    if (!query) { results.classList.add('hidden'); return; }
    const normalized = query.toLowerCase();
    const matches = searchItems.filter(item => `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(normalized)).slice(0, 7);
    if (!matches.length) {
      const empty = document.createElement('p'); empty.className = 'p-3 text-sm text-muted'; empty.textContent = 'No stories found.'; results.append(empty);
    } else {
      matches.forEach(item => {
        const link = document.createElement('a');
        link.className = 'block rounded p-3 no-underline hover:bg-black/5 dark:hover:bg-white/5';
        link.href = item.url;
        const category = document.createElement('span'); category.className = 'block text-[10px] font-bold uppercase tracking-wide text-accent'; category.textContent = item.category;
        const title = document.createElement('span'); title.className = 'mt-1 block text-sm font-bold'; title.textContent = item.title;
        const description = document.createElement('span'); description.className = 'mt-1 block text-xs text-muted'; description.textContent = item.description;
        link.append(category, title, description); results.append(link);
      });
    }
    results.classList.remove('hidden');
  };
  inputs.forEach(input => {
    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(async () => {
        const query = input.value.trim();
        if (!query) { renderResults(input, ''); return; }
        await loadSearch();
        renderResults(input, query);
      }, 180);
    });
    input.addEventListener('keydown', event => { if (event.key === 'Escape') { input.value = ''; renderResults(input, ''); } });
    input.addEventListener('focus', () => { if (input.value.trim()) input.dispatchEvent(new Event('input')); });
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('[role="search"]')) document.querySelectorAll('#search-results, #mobile-search-results').forEach(el => el.classList.add('hidden'));
  });

  const publisherId = window.ADSENSE_PUBLISHER_ID || '';
  if (/^ca-pub-\d{16}$/.test(publisherId) && !document.querySelector('[data-adsense-loader]')) {
    const script = document.createElement('script');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.dataset.adsenseLoader = 'true';
    document.head.append(script);
  }
})();
