import * as vscode from 'vscode';
import core from './generated/core.json';
import modules from './generated/modules.json';

type Bag = { [name: string]: string };
type Module = {
	overview: string;
	parameters: Bag;
	functions: Bag;
	pseudovariables: Bag;
	mi: Bag;
	statistics: Bag;
	events: Bag;
};

const MODULES = modules as unknown as { [mod: string]: Module };
const CORE = core as unknown as {
	parameters: Bag;
	functions: Bag;
	keywords: Bag;
	pseudovariables: Bag;
	transformations: Bag;
};

// Built once: function/param name -> list of modules exporting it. OpenSIPS has
// ~520 exported functions across 193 modules and a handful of collisions
// (e.g. w_* wrappers), so we show every owner rather than the last one to win.
const FUNC_OWNERS = index(m => m.functions);
const PVAR_OWNERS = index(m => m.pseudovariables);

function index(pick: (m: Module) => Bag): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const [mod, data] of Object.entries(MODULES)) {
		for (const name of Object.keys(pick(data) ?? {})) {
			const owners = map.get(name);
			owners ? owners.push(mod) : map.set(name, [mod]);
		}
	}
	return map;
}

export function activate(context: vscode.ExtensionContext) {
	// 'opensips' is the same language id tommybrecher.vscode-opensips uses for
	// syntax highlighting, so the two compose. The globs are the fallback for
	// workspaces where .cfg got claimed by kamailio-hover instead.
	const selector: vscode.DocumentSelector = [
		{ language: 'opensips' },
		{ scheme: 'file', pattern: '**/opensips*.cfg' },
		{ scheme: 'file', pattern: '**/opensips*.cfg.j2' },
		{ scheme: 'file', pattern: '**/*.opensips' },
	];

	context.subscriptions.push(
		vscode.languages.registerHoverProvider(selector, { provideHover })
	);
}

export function deactivate() { }

function provideHover(
	document: vscode.TextDocument,
	position: vscode.Position
): vscode.Hover | null {
	if (!vscode.workspace.getConfiguration('opensipsHover').get<boolean>('enable', true)) {
		return null;
	}

	const line = document.lineAt(position).text;

	// order matters: line-scoped lookups first, then token-scoped ones
	return (
		lookupLoadmodule(document, position, line) ??
		lookupModparam(document, position, line) ??
		lookupTransformation(document, position) ??
		lookupPseudoVariable(document, position) ??
		lookupCore(document, position) ??
		lookupModuleFunction(document, position) ??
		null
	);
}

function md(...parts: string[]): vscode.Hover {
	const content = new vscode.MarkdownString(parts.join('\n\n'));
	content.supportHtml = false;
	return new vscode.Hover(content);
}

/** loadmodule "dialog.so" -> module overview */
function lookupLoadmodule(
	document: vscode.TextDocument,
	position: vscode.Position,
	line: string
): vscode.Hover | null {
	if (!line.includes('loadmodule')) {
		return null;
	}
	const range = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_]+/);
	if (!range) {
		return null;
	}
	const word = document.getText(range);
	const mod = MODULES[word];
	return mod?.overview ? md(`### ${word}`, mod.overview) : null;
}

/** modparam("dialog", "hash_size", 4096) -> module overview or parameter doc */
function lookupModparam(
	document: vscode.TextDocument,
	position: vscode.Position,
	line: string
): vscode.Hover | null {
	// OpenSIPS allows a regex/module-list as first arg, e.g. modparam("acc|dialog", ...)
	const m = /modparam\(\s*"(?<mods>[^"]+)"\s*,\s*"(?<param>[\w.]+)"/.exec(line);
	if (!m?.groups) {
		return null;
	}
	const range = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_.]+/);
	if (!range) {
		return null;
	}
	const word = document.getText(range);
	const mods = m.groups['mods'].split('|').map(s => s.trim());

	if (mods.includes(word) && MODULES[word]?.overview) {
		return md(`### ${word}`, MODULES[word].overview);
	}
	if (word === m.groups['param']) {
		for (const mod of mods) {
			const doc = MODULES[mod]?.parameters?.[word];
			if (doc) {
				return md(doc);
			}
		}
	}
	return null;
}

/** {s.len}, {uri.user}, {re.subst,/a/b/} */
function lookupTransformation(
	document: vscode.TextDocument,
	position: vscode.Position
): vscode.Hover | null {
	const range = document.getWordRangeAtPosition(position, /\{[a-zA-Z]+\.[a-zA-Z0-9_.]+/);
	if (!range) {
		return null;
	}
	const name = document.getText(range).substring(1);
	const doc = CORE.transformations[name] ??
		// {s.substr,1,2} is documented as {s.substr,offset,length}
		CORE.transformations[name.split(',')[0]];
	return doc ? md(doc) : null;
}

/** $fu, $var(x), $DLG_status, $avp(foo) -- core vars plus module-exported ones */
function lookupPseudoVariable(
	document: vscode.TextDocument,
	position: vscode.Position
): vscode.Hover | null {
	const range = document.getWordRangeAtPosition(position, /\$\(?[a-zA-Z_][a-zA-Z0-9_.]*/);
	if (!range) {
		return null;
	}
	const name = document.getText(range).replace(/^\$\(?/, '');
	const doc = CORE.pseudovariables[name];
	if (!doc) {
		return null;
	}
	const owners = PVAR_OWNERS.get(name);
	return owners ? md(doc, `_exported by: ${owners.join(', ')}_`) : md(doc);
}

/** core parameters (children=, listen=), core functions (xlog), route blocks */
function lookupCore(
	document: vscode.TextDocument,
	position: vscode.Position
): vscode.Hover | null {
	const range = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_]*/);
	if (!range) {
		return null;
	}
	const word = document.getText(range);
	const doc = CORE.parameters[word] ?? CORE.functions[word] ?? CORE.keywords[word];
	return doc ? md(doc) : null;
}

/** module-exported script functions: create_dialog(), rtpengine_offer(), ... */
function lookupModuleFunction(
	document: vscode.TextDocument,
	position: vscode.Position
): vscode.Hover | null {
	const range = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_]*/);
	if (!range) {
		return null;
	}
	const word = document.getText(range);
	const owners = FUNC_OWNERS.get(word);
	if (!owners) {
		return null;
	}
	const parts = owners.map(mod => MODULES[mod].functions[word]);
	const suffix = owners.length > 1
		? `_exported by: ${owners.join(', ')}_`
		: `_module: ${owners[0]}_`;
	return md(...parts, suffix);
}
