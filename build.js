/* Build a self-contained static publication. No server or runtime framework is required. */
const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = __dirname;
const localEnvFile = path.join(ROOT, '.env');
if (fs.existsSync(localEnvFile)) {
  for (const line of fs.readFileSync(localEnvFile, 'utf8').split(/\r?\n/)) {
    const entry = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!entry || process.env[entry[1]] !== undefined) continue;
    process.env[entry[1]] = entry[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const CONTENT_DIR = path.join(ROOT, 'content');
const TEMPLATE_DIR = path.join(ROOT, 'templates');
const DIST_DIR = path.join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://example.com').replace(/\/+$/, '');
const ADSENSE_ID = process.env.ADSENSE_PUBLISHER_ID || 'ca-pub-REPLACE_ME';
const CATEGORY_PAGE_SIZE = 2;
const CATEGORY_DESCRIPTIONS = {
  Technology: 'Ideas and tools changing how we live, work and connect.',
  Science: 'Research and discoveries that help explain our changing world.',
  Business: 'The people, choices and new models shaping the economy.',
  Culture: 'The places, ideas and creative work bringing people together.'
};
const STATIC_PAGES = {
  about: { title: 'About Stack Over News', description: 'Meet Stack Over News and learn what our independent demo publication covers.', body: '<p>Stack Over News is a demo independent publication built to make useful reporting clear and accessible. Our newsroom follows technology, science, business and culture, with an emphasis on practical context and thoughtful questions.</p><h2>Our approach</h2><p>We explain what changed, who it affects and what readers can learn next. Every story is written for curious people who want more than a headline.</p>' },
  contact: { title: 'Contact Stack Over News', description: 'Get in touch with the Stack Over News editorial team.', body: '<p>Have a correction, question or story idea? Write to <a href="mailto:hello@example.com">hello@example.com</a>. This demo address should be replaced with your publication’s contact address before launch.</p><h2>Corrections</h2><p>Please include the story URL and the detail you believe needs attention. We review correction requests and update published stories when the evidence supports a change.</p>' },
  'privacy-policy': { title: 'Privacy Policy', description: 'Read how Stack Over News handles reader information and privacy.', body: '<p>This demo site is a static publication. It does not use a server-side account system or database. Basic browser storage may be used to remember your display preference, such as dark mode.</p><h2>Search and advertising</h2><p>Search runs in your browser using a static index. If you enable advertising, the ad provider may use cookies or similar technologies under its own privacy terms. Update this policy to describe the services and laws that apply to your publication before launch.</p><h2>Your choices</h2><p>You can clear browser storage and adjust cookie settings in your browser. Contact hello@example.com with privacy questions.</p>' },
  terms: { title: 'Terms of Use', description: 'Read the terms for using the Stack Over News website.', body: '<p>Stack Over News is provided as an informational demo. You may read and share links to our stories. Please do not republish full articles without permission.</p><h2>Accuracy and availability</h2><p>We work to make reporting accurate and the site available, but demo content may be incomplete and the site may change. Nothing on this site is professional legal, financial or medical advice.</p>' },
  'editorial-policy': { title: 'Editorial Policy', description: 'Learn about the editorial standards guiding Stack Over News reporting.', body: '<p>Our editorial work aims to be accurate, fair and useful. We distinguish reporting from opinion, use named sources when possible and give readers enough context to understand a claim.</p><h2>Corrections and independence</h2><p>When we find an error, we correct it and explain meaningful changes. Editorial decisions are made for readers and are kept separate from advertising relationships.</p><h2>AI and tools</h2><p>Technology can help with research and production, but editors remain responsible for published work. People review facts, sources and final copy.</p>' }
};

function readTemplate(name) { return fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf8'); }
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function xml(value = '') { return String(value).replace(/[<>&'\"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char])); }
function formatDate(value, options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) {
  return new Intl.DateTimeFormat('en-US', options).format(new Date(`${value}T00:00:00Z`));
}
function walkMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkMarkdown(full) : entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}
function loadArticles() {
  const articles = walkMarkdown(CONTENT_DIR).map(file => {
    const parsed = matter(fs.readFileSync(file, 'utf8'));
    const data = parsed.data;
    for (const key of ['title', 'description', 'category', 'date', 'image', 'author', 'slug']) {
      if (!data[key]) throw new Error(`${path.relative(ROOT, file)} is missing required front matter: ${key}`);
    }
    const normalizedDate = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) throw new Error(`${data.slug}: date must use YYYY-MM-DD`);
    if (!Object.hasOwn(CATEGORY_DESCRIPTIONS, data.category)) throw new Error(`${data.slug}: category must be one of ${Object.keys(CATEGORY_DESCRIPTIONS).join(', ')}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) throw new Error(`${data.slug}: slug must contain lowercase letters, numbers and hyphens`);
    return { ...data, date: normalizedDate, markdown: parsed.content.trim(), url: `/news/${data.slug}/` };
  });
  const slugs = articles.map(article => article.slug);
  if (new Set(slugs).size !== slugs.length) throw new Error('Article slugs must be unique.');
  return articles.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}
function replace(template, values) {
  let output = template;
  for (const [key, value] of Object.entries(values)) output = output.replaceAll(`{{${key}}}`, String(value ?? ''));
  const unresolved = output.match(/\{\{[^}]+\}\}/);
  if (unresolved) throw new Error(`Unresolved template placeholder: ${unresolved[0]}`);
  return output;
}
function writeFile(relative, contents) {
  const target = path.join(DIST_DIR, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}
function card(article, rootPath) {
  return `<article class="overflow-hidden"><a class="group block no-underline" href="${rootPath}news/${escapeHtml(article.slug)}/"><img class="aspect-[16/9] w-full rounded object-cover" src="${escapeHtml(article.image)}" width="800" height="450" alt="${escapeHtml(article.title)}" loading="lazy"><p class="mt-3 text-xs font-bold uppercase tracking-[.15em] text-accent">${escapeHtml(article.category)}</p><h3 class="mt-1 text-xl font-extrabold leading-snug group-hover:underline">${escapeHtml(article.title)}</h3><p class="mt-2 text-sm leading-relaxed text-muted">${escapeHtml(article.description)}</p><p class="mt-3 text-xs text-muted">${escapeHtml(formatDate(article.date))} · ${escapeHtml(article.author)}</p></a></article>`;
}
function layout(content, { title, description, canonical, image, rootPath, crumbs, type = 'website', articleData }) {
  const breadcrumb = crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: `${SITE_URL}${crumb.url}` }));
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: title, description, image: [image], datePublished: articleData?.date || new Date().toISOString().slice(0, 10), author: { '@type': articleData ? 'Person' : 'Organization', name: articleData?.author || 'Stack Over News' }, publisher: { '@type': 'Organization', name: 'Stack Over News' }, mainEntityOfPage: canonical },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumb }
  ];
  const navCategories = Object.keys(CATEGORY_DESCRIPTIONS).map(category => `<a class="hover:text-accent" href="${rootPath}category/${category.toLowerCase()}/">${category}</a>`).join('');
  const navPages = Object.entries(STATIC_PAGES).map(([slug, page]) => `<a class="hover:text-accent" href="${rootPath}${slug}/">${page.title.replace(' Stack Over News', '')}</a>`).join('');
  return replace(readTemplate('base.html'), {
    title: escapeHtml(title), description: escapeHtml(description), canonical: escapeHtml(canonical), image: escapeHtml(image), og_type: type,
    site_url: SITE_URL, root_path: rootPath, json_ld: JSON.stringify(jsonLd).replace(/</g, '\\u003c'), nav_categories: navCategories,
    nav_pages: navPages, footer_pages: navPages, year: new Date().getFullYear(), adsense_id: escapeHtml(ADSENSE_ID), content
  });
}
function renderHome(articles) {
  const hero = articles[0];
  const rootPath = './';
  const trending = articles.slice(1, 5).map((article, index) => `<a class="group flex gap-4 py-4 no-underline" href="${rootPath}news/${escapeHtml(article.slug)}/"><span class="text-3xl font-black text-emerald-900/40">0${index + 1}</span><span><span class="text-xs font-bold uppercase tracking-wide text-accent">${escapeHtml(article.category)}</span><span class="mt-1 block font-bold leading-snug group-hover:underline">${escapeHtml(article.title)}</span><span class="mt-1 block text-xs text-muted">${escapeHtml(formatDate(article.date))}</span></span></a>`).join('');
  const latest = articles.slice(1, 7).map(article => card(article, rootPath)).join('');
  const categorySections = Object.keys(CATEGORY_DESCRIPTIONS).map(category => {
    const stories = articles.filter(article => article.category === category).slice(0, 3);
    return `<section class="mt-12"><div class="mb-5 flex items-end justify-between border-b border-soft pb-3"><h2 class="text-2xl font-black tracking-tight">${category}</h2><a class="text-sm font-semibold text-accent" href="${rootPath}category/${category.toLowerCase()}/">More ${category.toLowerCase()} →</a></div><div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${stories.map(article => card(article, rootPath)).join('')}</div></section>`;
  }).join('');
  const content = replace(readTemplate('home.html'), {
    today: formatDate(new Date().toISOString().slice(0, 10)), hero_url: `${rootPath}news/${hero.slug}/`, hero_image: escapeHtml(hero.image), hero_image_alt: escapeHtml(hero.title),
    hero_category: escapeHtml(hero.category), hero_title: escapeHtml(hero.title), hero_description: escapeHtml(hero.description), hero_author: escapeHtml(hero.author), hero_date: formatDate(hero.date),
    trending, latest, latest_url: `${rootPath}category/${articles[0].category.toLowerCase()}/`, latest_label: `Explore ${articles[0].category} →`, category_sections: categorySections
  });
  return layout(content, { title: 'Stack Over News | Clarity for a changing world', description: 'Independent explainers and reporting across technology, science, business and culture.', canonical: `${SITE_URL}/`, image: hero.image, rootPath, crumbs: [{ name: 'Home', url: '/' }] });
}
function insertMidAd(html) {
  const paragraphEnds = [...html.matchAll(/<\/p>/g)];
  if (paragraphEnds.length < 2) return `${html}<div class="ad-slot ad-mid" aria-label="Advertisement">Advertisement</div>`;
  const middle = paragraphEnds[Math.floor(paragraphEnds.length / 2) - 1].index + 4;
  return `${html.slice(0, middle)}<div class="ad-slot ad-mid" aria-label="Advertisement">Advertisement</div>${html.slice(middle)}`;
}
function renderArticle(article, articles) {
  const rootPath = '../../';
  const categoryUrl = `${rootPath}category/${article.category.toLowerCase()}/`;
  const related = articles.filter(other => other.slug !== article.slug).sort((a, b) => (a.category === article.category ? -1 : 1) - (b.category === article.category ? -1 : 1)).slice(0, 3).map(item => card(item, rootPath)).join('');
  const words = article.markdown.split(/\s+/).length;
  const content = replace(readTemplate('article.html'), {
    root_path: rootPath, category_url: categoryUrl, category: escapeHtml(article.category), title: escapeHtml(article.title), description: escapeHtml(article.description),
    author: escapeHtml(article.author), date_iso: article.date, date: formatDate(article.date), reading_time: Math.max(1, Math.ceil(words / 220)),
    image: escapeHtml(article.image), image_alt: escapeHtml(article.title), body: insertMidAd(marked.parse(article.markdown.replace(/^#\s+/gm, '## '))), related
  });
  return layout(content, {
    title: `${article.title} | Stack Over News`, description: article.description, canonical: `${SITE_URL}${article.url}`, image: article.image, rootPath,
    type: 'article', articleData: article, crumbs: [{ name: 'Home', url: '/' }, { name: article.category, url: `/category/${article.category.toLowerCase()}/` }, { name: article.title, url: article.url }]
  });
}
function renderCategory(category, articles, pageNumber, totalPages) {
  const basePath = `/category/${category.toLowerCase()}/`;
  const relativeBase = '../'.repeat(pageNumber > 1 ? 4 : 2);
  const pageUrl = pageNumber === 1 ? basePath : `${basePath}page/${pageNumber}/`;
  const start = (pageNumber - 1) * CATEGORY_PAGE_SIZE;
  const current = articles.slice(start, start + CATEGORY_PAGE_SIZE);
  const links = [];
  if (pageNumber > 1) links.push(`<a class="rounded border border-soft px-4 py-2 text-sm font-semibold" href="${pageNumber === 2 ? `${relativeBase}category/${category.toLowerCase()}/` : `${relativeBase}category/${category.toLowerCase()}/page/${pageNumber - 1}/`}">← Previous</a>`);
  for (let number = 1; number <= totalPages; number++) {
    const url = number === 1 ? `${relativeBase}category/${category.toLowerCase()}/` : `${relativeBase}category/${category.toLowerCase()}/page/${number}/`;
    links.push(`<a class="rounded border border-soft px-4 py-2 text-sm ${number === pageNumber ? 'bg-emerald-800 text-white' : ''}" href="${url}" ${number === pageNumber ? 'aria-current="page"' : ''}>${number}</a>`);
  }
  if (pageNumber < totalPages) links.push(`<a class="rounded border border-soft px-4 py-2 text-sm font-semibold" href="${relativeBase}category/${category.toLowerCase()}/page/${pageNumber + 1}/">Next →</a>`);
  const related = articles.filter(item => !current.some(currentArticle => currentArticle.slug === item.slug)).slice(0, 3).map(item => card(item, relativeBase)).join('');
  const content = replace(readTemplate('category.html'), {
    root_path: relativeBase, category: escapeHtml(category), category_description: escapeHtml(CATEGORY_DESCRIPTIONS[category]), articles: current.map(item => card(item, relativeBase)).join(''),
    pagination: links.join(''), related
  });
  return { url: pageUrl, html: layout(content, {
    title: `${category}${pageNumber > 1 ? ` — Page ${pageNumber}` : ''} | Stack Over News`, description: `${CATEGORY_DESCRIPTIONS[category]} Browse ${category.toLowerCase()} stories from Stack Over News.`,
    canonical: `${SITE_URL}${pageUrl}`, image: articles[0]?.image || `${SITE_URL}/`, rootPath: relativeBase,
    crumbs: [{ name: 'Home', url: '/' }, { name: category, url: basePath }, ...(pageNumber > 1 ? [{ name: `Page ${pageNumber}`, url: pageUrl }] : [])]
  }) };
}
function build() {
  const articles = loadArticles();
  if (!articles.length) throw new Error('Add at least one Markdown article under /content.');
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
  writeFile('script.js', fs.readFileSync(path.join(ROOT, 'src', 'script.js'), 'utf8'));
  writeFile('index.html', renderHome(articles));
  for (const article of articles) writeFile(`news/${article.slug}/index.html`, renderArticle(article, articles));
  const categoryPages = [];
  for (const category of Object.keys(CATEGORY_DESCRIPTIONS)) {
    const stories = articles.filter(article => article.category === category);
    const totalPages = Math.max(1, Math.ceil(stories.length / CATEGORY_PAGE_SIZE));
    for (let page = 1; page <= totalPages; page++) {
      const result = renderCategory(category, stories, page, totalPages);
      categoryPages.push(result.url);
      writeFile(result.url.replace(/^\//, '') + (page === 1 ? 'index.html' : 'index.html'), result.html);
    }
  }
  for (const [slug, page] of Object.entries(STATIC_PAGES)) {
    const url = `/${slug}/`;
    const rootPath = '../';
    const content = `<section class="mx-auto max-w-3xl px-4 py-12 sm:px-6"><nav class="mb-6 text-sm text-muted" aria-label="Breadcrumbs"><a href="${rootPath}">Home</a> / <span aria-current="page">${escapeHtml(page.title)}</span></nav><h1 class="text-4xl font-black tracking-tight">${escapeHtml(page.title)}</h1><div class="article-copy mt-6">${page.body}</div><section class="mt-12 border-t border-soft pt-7"><h2 class="mb-5 text-2xl font-black">Related stories</h2><div class="grid gap-6 sm:grid-cols-2">${articles.slice(0, 2).map(item => card(item, rootPath)).join('')}</div></section></section>`;
    writeFile(`${slug}/index.html`, layout(content, { title: `${page.title} | Stack Over News`, description: page.description, canonical: `${SITE_URL}${url}`, image: articles[0].image, rootPath, crumbs: [{ name: 'Home', url: '/' }, { name: page.title, url }] }));
  }
  const urls = [`${SITE_URL}/`, ...articles.map(article => `${SITE_URL}${article.url}`), ...categoryPages.map(url => `${SITE_URL}${url}`), ...Object.keys(STATIC_PAGES).map(slug => `${SITE_URL}/${slug}/`)];
  writeFile('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${xml(url)}</loc></url>`).join('')}</urlset>`);
  const recent = articles.filter(article => (Date.now() - new Date(`${article.date}T00:00:00Z`).getTime()) <= 48 * 60 * 60 * 1000);
  writeFile('news-sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${recent.map(article => `<url><loc>${xml(`${SITE_URL}${article.url}`)}</loc><news:news><news:publication><news:name>Stack Over News</news:name><news:language>en</news:language></news:publication><news:publication_date>${article.date}</news:publication_date><news:title>${xml(article.title)}</news:title></news:news></url>`).join('')}</urlset>`);
  const rssItems = articles.slice(0, 20).map(article => `<item><title>${xml(article.title)}</title><link>${xml(`${SITE_URL}${article.url}`)}</link><guid>${xml(`${SITE_URL}${article.url}`)}</guid><pubDate>${new Date(`${article.date}T00:00:00Z`).toUTCString()}</pubDate><description>${xml(article.description)}</description><category>${xml(article.category)}</category></item>`).join('');
  writeFile('rss.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Stack Over News</title><link>${xml(SITE_URL)}</link><description>Clarity for a changing world.</description><language>en</language>${rssItems}</channel></rss>`);
  writeFile('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  writeFile('search.json', JSON.stringify(articles.map(article => ({ title: article.title, description: article.description, category: article.category, date: article.date, url: article.url, image: article.image })), null, 2));
  console.log(`Built ${articles.length} articles, ${categoryPages.length} category pages and ${Object.keys(STATIC_PAGES).length} policy/about pages into dist/`);
}

build();
if (process.argv.includes('--watch')) {
  for (const directory of [CONTENT_DIR, TEMPLATE_DIR, path.join(ROOT, 'src')]) {
    fs.watch(directory, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      clearTimeout(build.timer);
      build.timer = setTimeout(() => { try { build(); } catch (error) { console.error(error.stack || error); } }, 150);
    });
  }
  console.log('Watching content/ and templates/ for changes…');
}
