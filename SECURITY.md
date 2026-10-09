# Security

This is a static site with no server-side code, no forms, no cookies, no
accounts and no third-party requests.

## What the pages enforce

Every page carries a Content-Security-Policy in a `<meta>` tag:

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self';
font-src 'self'; connect-src 'none'; media-src 'self'; object-src 'none';
frame-src 'none'; worker-src 'none'; manifest-src 'self'; base-uri 'none';
form-action 'none'; upgrade-insecure-requests
```

- No inline scripts and no inline styles. All JavaScript and CSS are files in
  this repository.
- Nothing is loaded from another origin: fonts are self-hosted, there are no
  CDNs, analytics, trackers or embeds.
- `connect-src 'none'`: the pages make no network requests from script.
- The codebase map builds its DOM with `textContent`, never `innerHTML`.
- `<meta name="referrer" content="no-referrer">` on every page, so following a
  link out sends no referrer.
- The theme choice is the only thing stored in the browser (`localStorage`,
  key `ovat-theme`).

## Known limits

GitHub Pages does not let a repository set HTTP response headers, so
`frame-ancestors`, `X-Content-Type-Options` and HSTS cannot be configured here.
`frame-ancestors` is ignored when set from a `<meta>` tag, so it is not
included. HTTPS is provided by GitHub Pages.

## Reporting a problem

Open an issue at https://github.com/Lagmator22/ovat-navigate/issues, or for
anything sensitive, contact the owner through his GitHub profile
(https://github.com/Lagmator22) rather than in public.
