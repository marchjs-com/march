// The debugger's instrumenter (march-app-ui, debuggerPlugin): a classic script the TypeScript worker (ts-worker.js)
// loads beside the TypeScript compiler; it sets `self.marchInstrument(ts, path, text, fileIndex)`. The source's text is
// kept as it is and only grows: one-line calls are written in (never a new line, so every line keeps its number):
//   - before every statement  `__d.s(F, S, () => [() => a, () => b])`: a step, with getters of the names in scope;
//   - in every function        `const __f = __d.e(F, N); try { … } catch (__e) { throw __d.t(__e, __f) } finally { __d.x(__f) }`
//     (the call stack; an async function or a generator only gets the catch: its stack is not the caller's);
//   - `debugger;` becomes a step of its own kind ("debugger") and is taken out (the browser's devtools do not stop);
//   - a single statement under if / for / while gets braces ({ step; statement }), an arrow's expression body a block.
// It runs before the March compiler, so the March syntax ($x, on:click) is still there and is compiled with the calls.
// Returned: { code, meta } — meta: { file, module: names, fns: [[name, line]], steps: [[line, col, fn, kind, local, closure]] }.
/* global self */
(function () {
  "use strict";
  const HOOK = "__d";
  function instrument(ts, path, text, fi) {
    const K = ts.SyntaxKind;
    const kind = /\.tsx$/i.test(path) ? ts.ScriptKind.TSX : /\.jsx$/i.test(path) ? ts.ScriptKind.JSX : /\.m?ts$/i.test(path) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
    const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
    const edits = []; // { at, del, text, close, depth }
    const steps = [], fns = [];
    const pos = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf));
    const imported = new Set();
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st) || !st.importClause) continue;
      const c = st.importClause;
      if (c.name) imported.add(c.name.text);
      const nb = c.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) imported.add(nb.name.text);
      if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) imported.add(e.name.text);
    }
    const keep = (n) => !!n && !n.startsWith("__") && !imported.has(n);
    // the names a binding (a, { b, c: [d] }) declares
    const bound = (b, out) => {
      if (!b) return out;
      if (ts.isIdentifier(b)) out.push(b.text);
      else if (ts.isObjectBindingPattern(b) || ts.isArrayBindingPattern(b)) for (const e of b.elements) if (!ts.isOmittedExpression(e)) bound(e.name, out);
      return out;
    };
    const declList = (list, out) => { for (const d of list.declarations) bound(d.name, out); return out; };
    // the names a block (or the file, a case clause) declares directly
    const blockNames = (stmts) => {
      const out = [];
      for (const s of stmts) {
        if (ts.isVariableStatement(s)) declList(s.declarationList, out);
        else if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s) || ts.isEnumDeclaration(s)) && s.name) out.push(s.name.text);
      }
      return out;
    };
    const isFn = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)
      || ts.isConstructorDeclaration(n) || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n);
    const memo = new Map();
    // the names in scope at a node: [local (its function), closure (the functions around it), module]
    function scopes(node) {
      const groups = [[], [], []];
      let g = 0;
      const seen = new Set();
      const add = (names) => { for (const n of names) if (keep(n) && !seen.has(n)) { seen.add(n); groups[g].push(n); } };
      for (let p = node.parent, child = node; p; child = p, p = p.parent) {
        if (ts.isSourceFile(p)) { g = 2; add(blockNames(p.statements)); break; }
        if (ts.isBlock(p) || ts.isModuleBlock(p) || ts.isCaseClause(p) || ts.isDefaultClause(p)) add(blockNames(p.statements));
        else if ((ts.isForStatement(p) || ts.isForInStatement(p) || ts.isForOfStatement(p)) && p.initializer && ts.isVariableDeclarationList(p.initializer) && child !== p.initializer) add(declList(p.initializer, []));
        else if (ts.isCatchClause(p) && p.variableDeclaration) add(bound(p.variableDeclaration.name, []));
        else if (isFn(p)) {
          const own = [];
          for (const prm of p.parameters) bound(prm.name, own);
          if ((ts.isFunctionExpression(p)) && p.name) own.push(p.name.text);
          add(own);
          if (g === 0) g = 1;
        }
      }
      return groups;
    }
    // the function a node is in: its index in fns (-1: the module)
    const fnOf = (node) => { for (let p = node.parent; p; p = p.parent) if (memo.has(p)) return memo.get(p); return -1; };
    const nameOf = (fn) => {
      if (fn.name && (ts.isIdentifier(fn.name) || ts.isStringLiteral(fn.name) || ts.isPrivateIdentifier(fn.name))) {
        const cls = fn.parent && (ts.isClassDeclaration(fn.parent) || ts.isClassExpression(fn.parent)) && fn.parent.name ? `${fn.parent.name.text}.` : "";
        return cls + fn.name.text;
      }
      if (ts.isConstructorDeclaration(fn)) return `${fn.parent?.name?.text ?? "class"}.constructor`;
      const p = fn.parent;
      if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
      if (p && (ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p)) && p.name && ts.isIdentifier(p.name)) return p.name.text;
      if (p && ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent)) return `${p.parent.name.getText(sf)} handler`;
      if (p && ts.isCallExpression(p)) { const callee = p.expression.getText(sf); return `${callee.length > 24 ? callee.slice(0, 24) + "…" : callee} callback`; }
      return "(anonymous)";
    };
    const getters = (groups) => groups.flat().map((n) => `()=>${n}`).join(",");
    const step = (node, kindName) => {
      const { line, character } = pos(node);
      const groups = scopes(node);
      const s = steps.length;
      steps.push([line + 1, character + 1, fnOf(node), kindName, groups[0], groups[1]]);
      return `${HOOK}.s(${fi},${s},()=>[${getters(groups)}]);`;
    };
    // statements that get a step: everything that runs (not declarations of types, imports, functions, classes)
    const SKIP = new Set([K.FunctionDeclaration, K.ClassDeclaration, K.InterfaceDeclaration, K.TypeAliasDeclaration, K.ImportDeclaration,
      K.ImportEqualsDeclaration, K.ExportDeclaration, K.ModuleDeclaration, K.EmptyStatement, K.Block, K.EnumDeclaration]);
    const isStmt = (n) => n.kind >= K.FirstStatement && n.kind <= K.LastStatement || n.kind === K.Block || n.kind === K.ExpressionStatement
      || n.kind === K.VariableStatement || n.kind === K.ReturnStatement || n.kind === K.ExportAssignment || ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)
      || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isEnumDeclaration(n);
    const declared = (n) => (ts.getCombinedModifierFlags?.(n) ?? 0) & ts.ModifierFlags.Ambient;
    const depthOf = (n) => { let d = 0; for (let p = n.parent; p; p = p.parent) d++; return d; };
    const open = (at, t, n) => edits.push({ at, text: t, close: false, depth: depthOf(n) });
    const close = (at, t, n) => edits.push({ at, text: t, close: true, depth: depthOf(n) });
    function visit(n) {
      const p = n.parent;
      if (p && isStmt(n) && !SKIP.has(n.kind) && !declared(n)) {
        const inList = ts.isBlock(p) || ts.isSourceFile(p) || ts.isCaseClause(p) || ts.isDefaultClause(p) || ts.isModuleBlock(p);
        // a "use strict" prologue stays first
        const lead = (x) => ts.isExpressionStatement(x) && ts.isStringLiteral(x.expression);
        const directive = lead(n) && inList && (ts.isSourceFile(p) || isFn(p.parent)) && p.statements.slice(0, p.statements.indexOf(n)).every(lead);
        if (!directive) {
          const debug = n.kind === K.DebuggerStatement;
          const hook = step(n, debug ? "debugger" : "");
          if (inList) open(n.getStart(sf), hook, n);
          else if (!ts.isLabeledStatement(p)) { open(n.getStart(sf), `{${hook}`, n); close(n.end, "}", n); }
          else open(n.getStart(sf), "", n);
          // the browser does not stop on it: it is our step now
          if (debug) edits.push({ at: n.getStart(sf), del: "debugger".length, text: "void 0", close: false, depth: depthOf(n) + 1 });
        }
      }
      if (isFn(n) && n.body) {
        const idx = fns.length;
        memo.set(n, idx);
        fns.push([nameOf(n), pos(n).line + 1]);
        const flow = !!(n.asteriskToken || (ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Async));
        const enter = flow ? "try{" : `const __f=${HOOK}.e(${fi},${idx});try{`;
        const leave = flow ? `}catch(__e){throw ${HOOK}.t(__e,-1)}` : `}catch(__e){throw ${HOOK}.t(__e,__f)}finally{${HOOK}.x(__f)}`;
        if (ts.isBlock(n.body)) {
          open(n.body.getStart(sf) + 1, enter, n.body);
          close(n.body.end - 1, leave, n.body);
        } else {
          // an arrow's expression: a block that returns it
          open(n.body.getStart(sf), `{${enter}${step(n.body, "")}return (`, n.body);
          close(n.body.end, `)${leave}}`, n.body);
        }
      }
      ts.forEachChild(n, visit);
    }
    visit(sf);
    // the file's names, made first (every step reads them): the hook object at the start of the first line
    edits.push({ at: 0, text: `const ${HOOK}=globalThis.__marchDebug;`, close: false, depth: -1 });
    // at one place: closings before openings; the deeper closes first, the outer opens first
    edits.sort((a, b) => a.at - b.at || (a.close === b.close ? (a.close ? b.depth - a.depth : a.depth - b.depth) : a.close ? -1 : 1));
    let out = "", at = 0;
    for (const e of edits) {
      if (e.at < at) continue; // inside a deleted range
      out += text.slice(at, e.at) + e.text;
      at = e.at + (e.del ?? 0);
    }
    out += text.slice(at);
    return { code: out, meta: { file: path, module: scopes(sf.statements[0] ?? sf)[2], fns, steps } };
  }
  self.marchInstrument = instrument;
})();
