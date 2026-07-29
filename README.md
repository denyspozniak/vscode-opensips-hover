# opensips-hover

[![refresh-docs](https://github.com/denyspozniak/vscode-opensips-hover/actions/workflows/refresh-docs.yml/badge.svg)](https://github.com/denyspozniak/vscode-opensips-hover/actions/workflows/refresh-docs.yml)
[![license](https://img.shields.io/github/license/denyspozniak/vscode-opensips-hover?color=blue)](LICENSE)
[![docs source](https://img.shields.io/badge/docs-opensips%40master-blue)](https://github.com/OpenSIPS/opensips/tree/master/docs/manual)
[![modules](https://img.shields.io/badge/modules-195-blue)](#sources)
[![vscode](https://img.shields.io/badge/vscode-%E2%89%A51.87-blue)](https://code.visualstudio.com/)

<!-- uncomment once the first version is published to the registries:
[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/denyspozniak.opensips-hover)](https://marketplace.visualstudio.com/items?itemName=denyspozniak.opensips-hover)
[![Marketplace installs](https://img.shields.io/visual-studio-marketplace/i/denyspozniak.opensips-hover)](https://marketplace.visualstudio.com/items?itemName=denyspozniak.opensips-hover)
[![Open VSX](https://img.shields.io/open-vsx/v/denyspozniak/opensips-hover)](https://open-vsx.org/extension/denyspozniak/opensips-hover)
-->

VS Code / Cursor extension that shows OpenSIPS documentation in a hover tooltip:
core parameters and functions, script variables, transformations, route blocks,
and per-module parameters / functions / pseudo-variables / MI commands.

![Hovering a module function in opensips.cfg](https://raw.githubusercontent.com/denyspozniak/vscode-opensips-hover/main/docs/hover.png)

Modelled on [braams/vscode-kamailio-hover](https://github.com/braams/vscode-kamailio-hover),
but the tooltip content comes straight from the Markdown docs that live in the
OpenSIPS git repo since the [July 2026 documentation redesign](https://blog.opensips.org/2026/07/28/the-re-design-of-the-opensips-documentation/)
— no DocBook, no pandoc, no wiki scraping. `generator.py` is stdlib-only.

Current data set (generated from `opensips@master`):

| | count |
|---|---|
| modules | 195 |
| module parameters | 1529 |
| module functions | 517 |
| MI commands | 232 |
| core parameters | 109 |
| core functions | 66 |
| transformations | 92 |
| pseudo-variables | 201 (120 core + 81 module-exported) |
| route blocks / statements | 13 |

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
* ` ```opensips title="..." ` is rewritten to ` ```c ` — VS Code has no
  `opensips` grammar available inside a hover popup.
* `### memlog | mem_log` registers both spellings.
* `$var(...)` / `$avp(...)` are documented as prose sections without a `$` in
  the heading, so they are mapped explicitly.
* `LEGACY_PARAMS` in `generator.py` maps pre-3.x core parameter names
  (`children`, `listen`, `log_stderror`, …) onto the current ones, so hovering
  an old config shows the replacement plus a "Removed" note instead of nothing.

## Build

```sh
python3 generator.py                 # OPENSIPS_REF=3.6 to pin a branch/tag
cp tmp/out/*.json src/generated/
npm install && npm run compile
npm run package                      # -> opensips-hover-<version>.vsix
```

`.npmrc` pins the public npm registry explicitly.

## Install locally

Three ways, in increasing order of permanence.

**1. Development host** — no install at all. `F5` in VS Code / Cursor opens an
Extension Development Host window with the extension loaded from source;
`Ctrl+R` in that window reloads after an edit. This is the loop to use while
changing `src/extension.ts`.

**2. From the built `.vsix`** — installs into the real editor, shows up in the
Extensions panel under `@installed`:

```sh
npm run package                                             # -> opensips-hover-<version>.vsix
cursor --install-extension opensips-hover-0.1.0.vsix --force # or: code --install-extension
cursor --list-extensions --show-versions | grep opensips     # verify
```

`--force` is needed to overwrite an already-installed same version. After
installing, run **Developer: Reload Window** (`Ctrl+Shift+P`) — without it the
old copy stays loaded in the extension host.

Without a CLI, the same thing from the UI: Extensions panel → `...` menu →
**Install from VSIX**.

Uninstall with `cursor --uninstall-extension <publisher>.opensips-hover`.

**Remote / WSL note.** A hover provider runs in the extension host, so in a
Remote-WSL (or SSH, or devcontainer) window it must be installed **on the remote
side** — that is what `cursor --install-extension` does when run inside WSL.
Grammar-only extensions such as `tommybrecher.vscode-opensips` are UI extensions
and install on the local side instead. Both being present is normal and correct:
highlighting comes from the local one, tooltips from the remote one. If you open
a plain local folder rather than a remote window, install the `.vsix` in the
local editor too.

**3. Published** — see [Register and publish](#register-and-publish).

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

## Language id and the `.cfg` collision

This extension contributes the language id `opensips`, the same id
[tommybrecher.vscode-opensips](https://marketplace.visualstudio.com/items?itemName=TommyBrecher.vscode-opensips)
uses for syntax highlighting, so the two compose: grammar from there, tooltips
from here.

`kamailio-hover` also claims `.cfg` / `.inc`. If both are installed, pin the
language per workspace:

```json
{
  "files.associations": {
    "**/opensips*/**/*.cfg": "opensips",
    "**/kamailio*/**/*.cfg": "kamailio"
  }
}
```

The hover provider is additionally registered for the globs `**/opensips*.cfg`
and `**/opensips*.cfg.j2`, so those work even when the language id resolves to
something else.

## Register and publish

Two independent registries, and both matter:

| Registry | Read by | CLI | Token |
|---|---|---|---|
| VS Code Marketplace | VS Code | `vsce` | `VSCE_PAT` |
| [Open VSX](https://open-vsx.org) | **Cursor**, Windsurf, VSCodium, Theia | `ovsx` | `OVSX_PAT` |

Cursor's extension panel is backed by Open VSX, so publishing only to the
Marketplace leaves the extension unfindable in Cursor.

One-time registration — the `publisher` field in `package.json` must match the
name registered in *both* places:

```sh
# VS Code Marketplace: create an Azure DevOps org, then a publisher at
# https://marketplace.visualstudio.com/manage
# PAT: All accessible organizations + Marketplace > Manage scope
npx vsce login <publisher>

# Open VSX: sign in with GitHub at https://open-vsx.org, create an access token
npx ovsx create-namespace <publisher> -p "$OVSX_PAT"
```

Then store `VSCE_PAT` and `OVSX_PAT` as repository secrets
(Settings → Secrets and variables → Actions) and release by tag:

```sh
# bump "version" in package.json first
git tag v0.2.0 && git push --tags
```

`publish.yml` packages the `.vsix`, pushes it to both registries and attaches it
to the GitHub release. Editors auto-update installed extensions once the new
version is live, so there is nothing to do on the client side.

Manual publish, if you'd rather not use CI:

```sh
npm run publish:vsce      # vsce publish
npm run publish:ovsx      # ovsx publish
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
