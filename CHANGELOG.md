# Changelog

## 0.2.2

  * no functional changes — the changelog shipped inside 0.2.0 and 0.2.1 still
    carried the pre-release scaffold entry; this release is what publishes the
    real 0.2.0 and 0.2.1 notes to the registry

## 0.2.1

  * hover works in the `/etc/opensips/*.cfg` layout: any `.cfg` below a directory
    whose name contains `opensips` (`**/*opensips*/**/*.cfg`) is picked up, both
    through the language id and through the hover provider's own selector
  * `.cfg`, `.inc` and `.cfg.j2` are no longer claimed wholesale — the language id
    is limited to `opensips.cfg`, `**/opensips*.cfg` and the `#!OPENSIPS` shebang,
    so unrelated `.cfg` files keep their own association
  * extension icon
  * README rewritten for the extension listing; build, publish and parser notes
    moved to `DEVELOPMENT.md`

## 0.2.0

First published release; 0.1.0 was a local scaffold and never tagged.

  * tooltips generated from OpenSIPS `master` (post-July-2026 Markdown docs):
    195 modules, 1529 module parameters, 517 module functions, 232 MI commands,
    109 core parameters, 66 core functions, 92 transformations,
    201 pseudo-variables (120 core + 81 module-exported), 13 route/statement keywords
  * hover for: `loadmodule`, `modparam`, core parameters/functions, route blocks,
    module functions, pseudo-variables, transformations
  * `net/proto_udp` and `net/proto_tcp` docs folded into the module namespace
  * pre-3.x core parameter names (`children`, `listen`, `log_stderror`, …) resolve
    to their replacement with a "Removed" note
  * `tools/coverage.js` smoke test: 100% resolution on upstream `etc/opensips.cfg`
  * release by tag: `publish.yml` takes the version from the tag and publishes to
    Open VSX before the VS Code Marketplace
