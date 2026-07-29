#!/usr/bin/env python3
"""Generate hover tooltip JSON for OpenSIPS from the in-repo Markdown docs.

Unlike the Kamailio generator (docbook XML -> pandoc -> md -> mistune AST),
OpenSIPS ships Markdown directly since the July 2026 docs redesign, so this
needs no pandoc, no mistune, no wiki scraping: stdlib only.

Sources (single git repo):
  modules/<mod>/README.md        -> modules.json
  docs/manual/Script-Core*.md    -> core.json
  docs/manual/Script-Tran.md     -> core.json (transformations)
"""
import json
import logging
import os
import re
import shutil
import sys
import urllib.request

ref = os.environ.get("OPENSIPS_REF", "master")
src_url = "https://github.com/OpenSIPS/opensips/archive/refs/heads/%s.zip"
tmp_dir = "tmp"

log = logging.getLogger()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

FENCE_RE = re.compile(r"^(?P<f>```+|~~~+)")
HEAD_RE = re.compile(r"^(?P<hashes>#{1,6})\s+(?P<title>.*?)\s*$")


# ---------------------------------------------------------------- source fetch

def download_src(ref):
    os.makedirs(tmp_dir, exist_ok=True)
    dstzip = os.path.join(tmp_dir, "opensips-%s.zip" % ref)
    if not os.path.exists(dstzip):
        urllib.request.urlretrieve(src_url % ref, dstzip)
        log.info("downloaded %s", dstzip)
    dstdir = os.path.join(tmp_dir, "opensips-%s" % ref)
    if not os.path.exists(dstdir):
        shutil.unpack_archive(dstzip, tmp_dir)
    return dstdir


# ------------------------------------------------------------------- md parser

def parse_md(path):
    """Return a flat list of blocks: ('heading', level, title) | ('body', text).

    Fence-aware: a `# comment` inside a ```opensips block is NOT a heading.
    YAML frontmatter is stripped.
    """
    with open(path, encoding="utf-8") as f:
        lines = f.read().split("\n")

    i = 0
    if lines and lines[0].strip() == "---":            # frontmatter
        i = 1
        while i < len(lines) and lines[i].strip() != "---":
            i += 1
        i += 1

    blocks, buf, fence = [], [], None
    for line in lines[i:]:
        m = FENCE_RE.match(line)
        if m:
            tok = m.group("f")
            if fence is None:
                fence = tok
            elif line.startswith(fence):
                fence = None
            buf.append(line)
            continue
        if fence is None:
            h = HEAD_RE.match(line)
            if h:
                if buf:
                    blocks.append(("body", "\n".join(buf)))
                    buf = []
                blocks.append(("heading", len(h.group("hashes")), h.group("title")))
                continue
        buf.append(line)
    if buf:
        blocks.append(("body", "\n".join(buf)))
    return blocks


class Path:
    """Current heading path, e.g. ['Admin Guide', 'Exported Parameters', 'hash_size']."""

    def __init__(self):
        self.heads = [""] * 8
        self.level = 0

    def set(self, title, level):
        self.heads[level] = title
        for l in range(level + 1, 8):
            self.heads[l] = ""
        self.level = level

    def full(self):
        # module READMEs start at level 2 ("## Admin Guide"), so heads[1] is
        # empty -- drop empties instead of hardcoding a start level
        return [h for h in self.heads[1:self.level + 1] if h]

    def parent(self):
        return [h for h in self.heads[1:self.level] if h]


def render(title, blocks, lang_fix=True):
    """Blocks -> markdown string for the hover popup."""
    md = "### %s\n" % title + "\n".join(t[1] for t in blocks)
    md = re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"
    if lang_fix:
        # ```opensips title="..."  ->  ```c   (VSCode has no `opensips` grammar
        # for markdown hovers; `c` gives usable highlighting)
        md = re.sub(r"^(```+)opensips[^\n]*$", r"\1c", md, flags=re.M)
    return md


# --------------------------------------------------------------- name parsing

# every namer returns a LIST of keys, because some headings document more than
# one spelling: "memlog | mem_log", "### Script variables" -> $var

def name_param(h):        # "hash_size (integer)" -> [hash_size]
                          # "memlog | mem_log"    -> [memlog, mem_log]
    out = []
    for alt in h.split("|"):
        m = re.match(r"\s*([a-zA-Z0-9_]+)", alt)
        if m:
            out.append(m.group(1))
    return out


def name_func(h):         # "create_dialog([flags])"  -> [create_dialog]
    m = re.match(r"([a-zA-Z0-9_]+)", h)
    return [m.group(1)] if m else []


# The generic "$var(name)" / "$avp(name)" families are documented as prose
# sections without a "$" in the heading, so map them explicitly.
PVAR_SECTIONS = {
    "Script variables": "var",
    "AVP variables": "avp",
}


def name_pvar(h):
    """'Auth nonce - $an' | '$DLG_count' | '$dlg_val(name)' -> [an] | [DLG_count] | [dlg_val]"""
    if h in PVAR_SECTIONS:
        return [PVAR_SECTIONS[h]]
    m = re.findall(r"\$\{?([a-zA-Z_][a-zA-Z0-9_.]*)", h)
    return [m[-1]] if m else []


def name_tran(h):         # "{s.substr,offset,length}" -> [s.substr]
    m = re.match(r"\{([a-zA-Z0-9_.]+)", h)
    return [m.group(1)] if m else []


def name_mi(h):           # "dialog:list"
    m = re.match(r"([a-zA-Z0-9_:.]+)", h)
    return [m.group(1)] if m else []


# ------------------------------------------------------------ module extractor

SECTION_KEY = {
    "Exported Parameters":       "parameters",
    "Exported Functions":        "functions",
    "Exported Async Functions":  "functions",
    "Exported Pseudo-Variables": "pseudovariables",
    "Exported MI Functions":     "mi",
    "Exported Statistics":       "statistics",
    "Exported Events":           "events",
}
NAMER = {
    "parameters": name_param,
    "functions": name_func,
    "pseudovariables": name_pvar,
    "mi": name_mi,
    "statistics": name_param,
    "events": name_param,
}


def extract_module(path, mod):
    data = {"overview": "", "parameters": {}, "functions": {},
            "pseudovariables": {}, "mi": {}, "statistics": {}, "events": {}}
    p = Path()
    bucket = title = None
    acc, overview = [], []

    def flush():
        if bucket and title:
            for n in NAMER[bucket](title):
                data[bucket][n] = render(title, acc)

    for block in parse_md(path):
        if block[0] == "heading":
            _, level, h = block
            key = SECTION_KEY.get(h)
            if key or level <= 3:
                flush()
                acc, bucket, title = [], key, None
                p.set(h, level)
                continue
            p.set(h, level)
            parent = p.parent()
            if parent and SECTION_KEY.get(parent[-1]):
                flush()
                bucket, title, acc = SECTION_KEY[parent[-1]], h, []
            else:
                flush()
                bucket = title = None
                acc = []
        else:
            if p.full()[:2] == ["Admin Guide", "Overview"]:
                overview.append(block)
            elif title:
                acc.append(block)
    flush()

    data["overview"] = render(mod, overview).split("\n", 1)[1].strip() + "\n" if overview else ""
    return data


# -------------------------------------------------------------- core extractor

def extract_core(docdir):
    core = {"parameters": {}, "functions": {}, "keywords": {},
            "pseudovariables": {}, "transformations": {}}

    def walk(fname, bucket, level, namer, require_parent=None):
        path = os.path.join(docdir, fname)
        if not os.path.exists(path):
            log.warning("missing %s", path)
            return
        p, title, acc = Path(), None, []

        def flush():
            if title:
                for n in namer(title):
                    core[bucket][n] = render(title, acc)

        for block in parse_md(path):
            if block[0] == "heading":
                _, l, h = block
                p.set(h, l)
                if l == level and (require_parent is None or
                                   (p.parent() and p.parent()[0] in require_parent)):
                    flush()
                    title, acc = h, []
                else:
                    flush()
                    title, acc = None, []
            elif title:
                acc.append(block)
        flush()

    walk("Script-CoreParameters.md", "parameters", 3, name_param)
    walk("Script-CoreFunctions.md", "functions", 2, name_func)
    walk("Script-CoreVar.md", "pseudovariables", 3, name_pvar,
         require_parent=["Reference Variables"])
    # $var(...) and $avp(...) are documented as level-2 prose sections
    walk("Script-CoreVar.md", "pseudovariables", 2, name_pvar)
    walk("Script-Tran.md", "transformations", 3, name_tran)
    # route blocks and control statements are level-2 headings ("## branch_route",
    # "## switch"); Script-Operators/Flags are prose, nothing atomic to key on
    walk("Script-Routes.md", "keywords", 2, name_param)
    walk("Script-Statements.md", "keywords", 2, name_param)
    return core


# Pre-3.x core parameter names that OpenSIPS renamed. They are gone from the
# docs, but they are still all over older configs, so point them at the current
# parameter instead of showing nothing.
LEGACY_PARAMS = {
    "children": "udp_workers",
    "tcp_children": "tcp_workers",
    "listen": "socket",
    "log_stderror": "stderror_enabled",
    "log_facility": "syslog_facility",
    "log_name": "syslog_name",
    "disable_tcp": "socket",
    "disable_tls": "socket",
}


def apply_legacy_params(core):
    for old, new in LEGACY_PARAMS.items():
        if old in core["parameters"]:
            continue                      # still documented -- leave it alone
        doc = core["parameters"].get(new)
        if not doc:
            log.warning("legacy alias %s -> %s: target not in docs", old, new)
            continue
        core["parameters"][old] = (
            "### %s\n\n**Removed.** This is the pre-3.x name; use "
            "**`%s`** instead.\n\n---\n\n%s" % (old, new, doc)
        )


# ------------------------------------------------------------------------ main

if __name__ == "__main__":
    srcdir = download_src(ref)
    moddir = os.path.join(srcdir, "modules")
    docdir = os.path.join(srcdir, "docs", "manual")

    modules = {}
    # proto_udp and proto_tcp are built into the core, so their docs live under
    # net/ rather than modules/ -- but `loadmodule "proto_udp.so"` is still
    # written in every config, so they belong in the same namespace
    candidates = [(moddir, m) for m in sorted(os.listdir(moddir))]
    netdir = os.path.join(srcdir, "net")
    candidates += [(netdir, m) for m in sorted(os.listdir(netdir))
                   if m.startswith("proto_")]

    for parent, mod in candidates:
        readme = os.path.join(parent, mod, "README.md")
        if not os.path.isfile(readme):
            log.warning("no README.md for module %s", mod)
            continue
        modules[mod] = extract_module(readme, mod)

    core = extract_core(docdir)
    apply_legacy_params(core)

    # OpenSIPS documents module pseudo-vars inside the module README (Kamailio
    # keeps them all in the cookbook), so fold them into the global namespace
    # too -- $DLG_status must resolve without knowing which module owns it.
    for mod, d in modules.items():
        for pv, doc in d["pseudovariables"].items():
            core["pseudovariables"].setdefault(pv, doc)

    os.makedirs(os.path.join(tmp_dir, "out"), exist_ok=True)
    for fname, data in (("modules.json", modules), ("core.json", core)):
        with open(os.path.join(tmp_dir, "out", fname), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=1, ensure_ascii=False)

    log.info("modules: %d", len(modules))
    for k, v in core.items():
        log.info("core.%s: %d", k, len(v))
    log.info("params: %d, funcs: %d, mi: %d",
             sum(len(m["parameters"]) for m in modules.values()),
             sum(len(m["functions"]) for m in modules.values()),
             sum(len(m["mi"]) for m in modules.values()))
