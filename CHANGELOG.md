# Changelog

## 0.1.0 (unreleased)

  * initial scaffold
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
