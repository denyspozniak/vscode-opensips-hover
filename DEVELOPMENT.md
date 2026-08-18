# Development

[![refresh-docs](https://github.com/denyspozniak/vscode-opensips-hover/actions/workflows/refresh-docs.yml/badge.svg)](https://github.com/denyspozniak/vscode-opensips-hover/actions/workflows/refresh-docs.yml)

Everything that is about working on the extension rather than using it. The
user-facing description lives in [README.md](README.md), which is also what gets
rendered on the extension's marketplace page.

## Build

```sh
python3 generator.py                 # OPENSIPS_REF=3.6 to pin a branch/tag
cp tmp/out/*.json src/generated/
npm install && npm run compile
npm run package                      # -> opensips-hover-<version>.vsix
```

`.npmrc` pins the public npm registry explicitly.

## Running from source

**1. Development host** — no install at all. `F5` opens an Extension Development
Host window with the extension loaded from source; `Ctrl+R` in that window
reloads after an edit. This is the loop to use while changing `src/extension.ts`.

**2. From the built `.vsix`** — installs into the real editor, shows up in the
Extensions panel under `@installed`:

```sh
npm run package                                              # -> opensips-hover-<version>.vsix
cursor --install-extension opensips-hover-<version>.vsix --force
cursor --list-extensions --show-versions | grep opensips     # verify
```

`--force` is needed to overwrite an already-installed same version. After
installing, run **Developer: Reload Window** (`Ctrl+Shift+P`) — without it the
old copy stays loaded in the extension host.

Without a CLI, the same thing from the UI: Extensions panel → `...` menu →
**Install from VSIX**. Uninstall with
`cursor --uninstall-extension denyspozniak.opensips-hover`.

## Smoke test

`tools/coverage.js` runs the same lookups the hover provider does over real
config files and reports what would actually produce a tooltip:

```sh
npm run coverage -- /path/to/opensips.cfg /path/to/routing.d
```

Against upstream `etc/opensips.cfg` everything resolves (11/11 `loadmodule`,
13/13 `modparam`, 46/46 functions, 10/10 variables). Against a 2.x-era config
the misses are the things OpenSIPS actually deleted since — modules `uri` and
`avpops`, functions `uac_replace_to` and `has_body` — which is the correct
answer, not a gap.

## Sources

| Source in `OpenSIPS/opensips` | Goes into |
|---|---|
| `modules/<mod>/README.md` → `Admin Guide / Overview` | `modules.json[mod].overview` |
| `modules/<mod>/README.md` → `Exported Parameters` | `modules.json[mod].parameters` |
| `modules/<mod>/README.md` → `Exported Functions` | `modules.json[mod].functions` |
| `modules/<mod>/README.md` → `Exported Pseudo-Variables` | `modules.json[mod].pseudovariables` + `core.json.pseudovariables` |
| `modules/<mod>/README.md` → `Exported MI Functions` / `Statistics` / `Events` | `modules.json[mod].mi` / `.statistics` / `.events` |
| `net/proto_{udp,tcp}/README.md` | same namespace as modules (core-built, but still `loadmodule`d) |
| `docs/manual/Script-CoreParameters.md` | `core.json.parameters` |
| `docs/manual/Script-CoreFunctions.md` | `core.json.functions` |
| `docs/manual/Script-CoreVar.md` | `core.json.pseudovariables` |
| `docs/manual/Script-Tran.md` | `core.json.transformations` |
| `docs/manual/Script-Routes.md`, `Script-Statements.md` | `core.json.keywords` |

Parser notes, all of them things the docs actually do:

* YAML frontmatter is stripped; fenced blocks are tracked, because the examples
  are full of `# comment` lines that would otherwise read as headings.
* ` ```opensips title="..." ` is rewritten to ` ```c ` — no `opensips` grammar
  is available inside a hover popup.
* `### memlog | mem_log` registers both spellings.
* `$var(...)` / `$avp(...)` are documented as prose sections without a `$` in
  the heading, so they are mapped explicitly.
* `LEGACY_PARAMS` in `generator.py` maps pre-3.x core parameter names
  (`children`, `listen`, `log_stderror`, …) onto the current ones, so hovering
  an old config shows the replacement plus a "Removed" note instead of nothing.

## Document selector

`package.json` claims the language id narrowly — `opensips.cfg`, the
`opensips*.cfg` pattern, and the `#!OPENSIPS` shebang — so a bare `.cfg` is
never hijacked.

`src/extension.ts` additionally registers the hover provider for the glob
`**/opensips*.cfg`, so tooltips still work when the language id resolves to
something else (for instance when a Kamailio extension wins the association).

## Register and publish

Two independent registries:

| Registry | Read by | CLI | Token | Status |
|---|---|---|---|---|
| [Open VSX](https://open-vsx.org) | **Cursor**, Windsurf, VSCodium, Theia | `ovsx` | `OVSX_PAT` | live |
| VS Code Marketplace | VS Code | `vsce` | `VSCE_PAT` | planned |

Cursor does not read Open VSX directly — it mirrors it through
`marketplace.cursorapi.com`, so a freshly published version reaches the
Extensions panel a few minutes later than open-vsx.org.

One-time registration — the `publisher` field in `package.json` must match the
registered name:

```sh
# Open VSX: sign in with GitHub at https://open-vsx.org, sign the publisher
# agreement, then create an access token
npx ovsx create-namespace <publisher> -p "$OVSX_PAT"
```

Store the token as the repository secret `OVSX_PAT`
(Settings → Secrets and variables → Actions) and release by tag:

```sh
git tag v0.3.0 && git push origin v0.3.0
```

`publish.yml` takes the version straight from the tag, so nothing needs bumping
by hand. It packages the `.vsix`, publishes it, and attaches it to the GitHub
release. The Marketplace step is skipped unless `VSCE_PAT` is also set — which
is what makes VS Code support a matter of adding one secret. Editors auto-update
installed extensions once the new version is live.

Manual publish, if you'd rather not use CI:

```sh
npm run publish:ovsx      # ovsx publish
npm run publish:vsce      # vsce publish
```

## Keeping the docs fresh

`refresh-docs.yml` regenerates the JSON weekly (or on demand for a given
OpenSIPS ref), gates it on sanity floors, and opens a PR only when the data
changed.

For that PR to be created, the repo needs Settings → Actions → General →
Workflow permissions set to *Read and write* **and** *Allow GitHub Actions to
create and approve pull requests*.

Versioning convention: extension minor tracks the OpenSIPS branch —
`0.36.x` → OpenSIPS 3.6, `0.40.x` → 4.0.
