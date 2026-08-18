# OpenSIPS Hover

[![Open VSX](https://img.shields.io/open-vsx/v/denyspozniak/opensips-hover)](https://open-vsx.org/extension/denyspozniak/opensips-hover)
[![Open VSX downloads](https://img.shields.io/open-vsx/dt/denyspozniak/opensips-hover)](https://open-vsx.org/extension/denyspozniak/opensips-hover)
[![docs source](https://img.shields.io/badge/docs-opensips%40master-blue)](https://github.com/OpenSIPS/opensips/tree/master/docs/manual)
[![license](https://img.shields.io/github/license/denyspozniak/vscode-opensips-hover?color=blue)](https://github.com/denyspozniak/vscode-opensips-hover/blob/main/LICENSE)

<!-- uncomment once the extension is published to the VS Code Marketplace:
[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/denyspozniak.opensips-hover)](https://marketplace.visualstudio.com/items?itemName=denyspozniak.opensips-hover)
[![Marketplace installs](https://img.shields.io/visual-studio-marketplace/i/denyspozniak.opensips-hover)](https://marketplace.visualstudio.com/items?itemName=denyspozniak.opensips-hover)
-->

Read OpenSIPS documentation without leaving your config. Hover any keyword in
`opensips.cfg` and the official docs appear inline — no tab switching, no
guessing which module a function came from.

> **VS Code support is coming soon.** The extension already runs on any editor
> built on the same API; a Marketplace listing is the only thing still missing.

![Hovering a module function in opensips.cfg](https://raw.githubusercontent.com/denyspozniak/vscode-opensips-hover/main/docs/hover.png)

## What you get a tooltip for

* **Modules** — `loadmodule "dialog.so"` shows the module overview
* **Module parameters** — every `modparam` key, with type, default and description
* **Module functions** — signature, parameter list, and which route blocks it may be called from
* **Core parameters and functions** — the whole `docs/manual` script reference
* **Pseudo-variables** — `$ru`, `$avp(...)`, `$var(...)`, plus module-exported ones
* **Transformations** — `{s.len}`, `{uri.user}`, and the rest
* **Route blocks and statements** — `route`, `branch_route`, `onreply_route`, …
* **MI commands**, statistics and events exported by each module

Legacy names are covered too: hovering a pre-3.x parameter such as `children`
or `log_stderror` shows its modern replacement plus a "Removed" note, instead of
nothing at all.

## Install

Open the Extensions panel (`Ctrl+Shift+X`) and search for `denyspozniak.opensips-hover`.
Searching plain `opensips` finds it as well, further down the list. From a terminal:

```sh
cursor --install-extension denyspozniak.opensips-hover
```

Then open a config and hover something.

## Which files it activates on

Only OpenSIPS configs, deliberately:

* `opensips.cfg`
* anything matching `opensips*.cfg` — `opensips-prod.cfg`, `opensips_test.cfg`, …
* any `.cfg` anywhere below a directory with `opensips` in its name — so
  `/etc/opensips/routing.cfg`, `/etc/opensips-prod/dispatcher.cfg` and
  `/srv/my-opensips/conf/routing.d/nat.cfg` are all covered
* any file whose first line is `#!OPENSIPS`

A bare `.cfg` elsewhere is left alone, so nothing is taken away from Kamailio
extensions or anything else using that suffix. If your config lives outside all
of the above, pin it per workspace:

```json
{
  "files.associations": {
    "**/opensips*/**/*.cfg": "opensips",
    "**/kamailio*/**/*.cfg": "kamailio"
  }
}
```

**Syntax highlighting** comes from a separate extension. This one contributes
the language id `opensips` — the same id
[TommyBrecher.vscode-opensips](https://marketplace.visualstudio.com/items?itemName=TommyBrecher.vscode-opensips)
uses — so the two compose: grammar from there, tooltips from here.

**Remote / WSL.** A hover provider runs in the extension host, so in a
Remote-WSL, SSH or devcontainer window it has to be installed on the **remote**
side — which is what running `cursor --install-extension` inside WSL does.
Grammar-only extensions are UI extensions and install locally instead. Having
both is normal: highlighting local, tooltips remote.

## Where the content comes from

Straight from the Markdown docs in the OpenSIPS git repository, as of the
[July 2026 documentation redesign](https://blog.opensips.org/2026/07/28/the-re-design-of-the-opensips-documentation/)
— no DocBook, no pandoc, no wiki scraping. The data is regenerated weekly from
`opensips@master`, so tooltips track upstream rather than drifting behind it.

Current data set:

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

Modelled on [braams/vscode-kamailio-hover](https://github.com/braams/vscode-kamailio-hover).

## Settings

| Setting | Default | Effect |
|---|---|---|
| `opensipsHover.enable` | `true` | Show documentation tooltips in OpenSIPS config files |

## Contributing

Build instructions, the generator's parsing rules and the release process live in
[DEVELOPMENT.md](https://github.com/denyspozniak/vscode-opensips-hover/blob/main/DEVELOPMENT.md).
Issues and pull requests are welcome at
[denyspozniak/vscode-opensips-hover](https://github.com/denyspozniak/vscode-opensips-hover).

MIT licensed.
