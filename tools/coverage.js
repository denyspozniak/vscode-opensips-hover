#!/usr/bin/env node
// Smoke test: run the same lookups the hover provider does over real .cfg files
// and report what resolves. Usage: node tools/coverage.js <cfg|dir> [...]
// Not a unit test -- it answers "would a tooltip actually appear here", and the
// miss list shows which docs sections the generator is not picking up.
// Rough on purpose: it does not parse string literals, so text like
// xlog("... avp(x)=$avp(x)") shows up as a bogus function miss.
const fs = require('fs');
const path = require('path');

const core = require('../out/generated/core.json');
const modules = require('../out/generated/modules.json');

const funcOwners = new Map();
const modPvars = new Set();
for (const [mod, d] of Object.entries(modules)) {
	for (const f of Object.keys(d.functions || {})) {
		(funcOwners.get(f) || funcOwners.set(f, []).get(f)).push(mod);
	}
	for (const pv of Object.keys(d.pseudovariables || {})) { modPvars.add(pv); }
}

const stats = { loadmodule: [0, 0], modparam: [0, 0], param: [0, 0], func: [0, 0], pvar: [0, 0], tran: [0, 0] };
const misses = { loadmodule: new Set(), modparam: new Set(), func: new Set(), pvar: new Set(), tran: new Set() };

function hit(kind, ok, name) {
	stats[kind][ok ? 0 : 1]++;
	if (!ok && misses[kind]) { misses[kind].add(name); }
}

function scan(file) {
	const text = fs.readFileSync(file, 'utf8');
	let inBlockComment = false;
	for (const raw of text.split('\n')) {
		let line = raw.replace(/#.*$/, '').replace(/\/\*.*?\*\//g, ' ');
		// /* ... */ spanning lines -- prose in there is not script
		if (inBlockComment) {
			if (!/\*\//.test(line)) { continue; }
			line = line.replace(/^.*?\*\//, ' ');
			inBlockComment = false;
		}
		if (/\/\*/.test(line)) {
			line = line.replace(/\/\*.*$/, ' ');
			inBlockComment = true;
		}

		let m = /loadmodule\s+"([\w.]+?)(?:\.so)?"/.exec(line);
		if (m) { hit('loadmodule', !!modules[m[1]]?.overview, m[1]); }

		m = /modparam\(\s*"([^"]+)"\s*,\s*"([\w.]+)"/.exec(line);
		if (m) {
			const mods = m[1].split('|').map(s => s.trim());
			hit('modparam', mods.some(mod => modules[mod]?.parameters?.[m[2]]), `${m[1]}/${m[2]}`);
		}

		// core parameter assignment at the start of a line: children=8, listen=udp:...
		m = /^\s*([a-z_][a-z0-9_]*)\s*=/.exec(line);
		if (m && !/^\s*\$/.test(line)) { hit('param', !!core.parameters[m[1]], m[1]); }

		for (const t of line.matchAll(/\$\(?([a-zA-Z_][a-zA-Z0-9_.]*)/g)) {
			hit('pvar', !!core.pseudovariables[t[1]], '$' + t[1]);
		}

		for (const t of line.matchAll(/\{([a-zA-Z]+\.[a-zA-Z0-9_.]+)/g)) {
			const n = t[1];
			hit('tran', !!(core.transformations[n] || core.transformations[n.split(',')[0]]), '{' + n);
		}

		// function call: name( ... but not a keyword/control statement
		const kw = new Set(['if', 'while', 'switch', 'for', 'foreach', 'case', 'return',
			'modparam', 'loadmodule', 'route', 'exit', 'drop', 'break']);
		// blank out variables first, else $var( / $(hdr( look like function calls
		const noVars = line.replace(/\$\(?[a-zA-Z_][a-zA-Z0-9_.]*/g, ' ');
		for (const t of noVars.matchAll(/\b([a-z_][a-z0-9_]*)\s*\(/g)) {
			const n = t[1];
			if (kw.has(n)) { continue; }
			hit('func', !!(funcOwners.has(n) || core.functions[n]), n);
		}
	}
}

const targets = process.argv.slice(2);
if (!targets.length) { console.error('usage: node tools/coverage.js <cfg|dir> [...]'); process.exit(2); }
const files = [];
for (const t of targets) {
	const st = fs.statSync(t);
	if (st.isDirectory()) {
		for (const f of fs.readdirSync(t)) {
			if (/\.(cfg|inc|m4|j2)$/.test(f)) { files.push(path.join(t, f)); }
		}
	} else { files.push(t); }
}
files.forEach(scan);

console.log(`scanned ${files.length} file(s)\n`);
for (const [kind, [ok, no]] of Object.entries(stats)) {
	const total = ok + no;
	const pct = total ? ((ok / total) * 100).toFixed(1) : '--';
	console.log(`${kind.padEnd(11)} ${String(ok).padStart(4)}/${String(total).padEnd(4)} resolved (${pct}%)`);
}
console.log('');
for (const [kind, set] of Object.entries(misses)) {
	if (set.size) { console.log(`no tooltip for ${kind}: ${[...set].slice(0, 25).join(', ')}${set.size > 25 ? ` ... (+${set.size - 25})` : ''}`); }
}
