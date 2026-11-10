# Stack Over News

A framework-free static newspaper demo. Articles are Markdown files, `build.js` generates plain HTML and feeds, and the Tailwind CSS CLI produces the minified stylesheet. There is no backend or database.

## Run locally

Install Node.js 20 or newer, then run:

```sh
npm ci
npm run dev
```

The static preview is available at `http://localhost:4173`. For a production build only, run `npm run build`. To rebuild HTML and CSS as files change, run `npm run watch`.

Copy `.env.example` to `.env` and set `SITE_URL` to the public HTTPS origin before building so canonical tags, feeds and sitemaps use your domain. The default is `https://example.com`. Set `ADSENSE_PUBLISHER_ID` to your AdSense publisher ID to load the deferred AdSense script; the demo placeholder does not load third-party ads. Existing process environment variables take precedence over `.env`.

## Add an article from your phone

GitHub Mobile is useful for finding the repository, reviewing changes and handling pull requests. [GitHub documents file editing in Mobile for pull requests](https://docs.github.com/en/get-started/using-github/github-mobile); to create a new article file, open the repository in your phone’s browser and use GitHub’s [web file editor](https://docs.github.com/en/repositories/working-with-files/managing-files/creating-new-files) (or open `github.dev`). The browser editor can create a file in a new folder. After committing on a branch, return to GitHub Mobile to review and merge the pull request.

1. In GitHub Mobile, open this repository and choose **Open in browser** from the repository menu.
2. In the browser, navigate to `content/` and choose **Add file → Create new file**. Enter a path such as `content/science/clean-energy-storage.md`.
3. Paste the front matter and article text below. Use one of the existing categories: `Technology`, `Science`, `Business`, or `Culture`. Slugs must be lowercase with hyphens and unique.
4. Choose **Preview** to check the Markdown. Commit the file to a new branch and open a pull request, or commit directly to `master` if your repository allows it.
5. Once the change reaches `master`, GitHub Actions builds the site and publishes the contents of `dist/` to GitHub Pages.

```markdown
---
title: "A clear, specific headline"
description: "A one-sentence summary used in cards and search results."
category: Science
date: 2026-11-10
image: https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=85
author: Your Name
slug: clean-energy-storage
---
Start the story here. Use Markdown paragraphs and headings. The build creates one article page at `/news/clean-energy-storage/`.

## A useful section heading

Add the rest of the story here.
```

The generator checks required front matter, valid date format and unique slugs. Article images should be reachable over HTTPS and include a descriptive story subject.

## Content and generated output

```text
content/                 Markdown articles, grouped by category
templates/               Plain HTML templates with {{placeholder}} replacement
src/input.css            Tailwind input and small site-specific styles
src/script.js            Search, theme, navigation and AdSense loading
build.js                 Static page, sitemap, RSS and search-index generator
dist/                    Generated deployable files (not committed)
```

`npm run build` generates the homepage, `/news/{slug}/index.html`, paginated category pages (two stories per page in this demo), five information pages, `sitemap.xml`, `news-sitemap.xml`, `rss.xml`, `robots.txt`, and `search.json`, then builds `dist/style.css` with Tailwind CLI. All navigation and search are client-side or static.

## GitHub Pages deployment

The workflow at `.github/workflows/deploy.yml` runs on pushes to `master` and can also be started manually in the Actions tab. Before its first successful deployment, a repository administrator must enable Pages in **Settings → Pages** and choose **GitHub Actions** as the source; GitHub may deny the workflow permission to enable Pages itself. No FTP credentials are required.

The action builds the static site, uploads `dist/`, and deploys it. It derives the canonical site URL from GitHub Pages, including the repository path for project sites. To enable AdSense, add an `ADSENSE_PUBLISHER_ID` repository secret. The four reserved ad placements remain placeholders until you configure your ad units.

## Included pages and features

- Responsive homepage, article and paginated category templates
- Sticky navigation, mobile menu, dark mode preference and reading progress
- Debounced browser search over the generated JSON index
- Canonical, Open Graph, Twitter and JSON-LD metadata on every page
- Reserved ad areas below the article headline, within and after the article, and in a mobile bottom anchor
- About, Contact, Privacy Policy, Terms and Editorial Policy pages
- Sitemap, Google News sitemap, RSS feed and robots file

Replace demo copy, contact information, images and legal-policy text with publication-specific material before a public launch.
