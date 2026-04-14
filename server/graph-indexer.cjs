// AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
// Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
// Read docs/no-reply-system.md for the no-reply protocol.
const fs = require("fs");
const path = require("path");

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".cache", ".next", ".nuxt", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache", "build", ".DS_Store"]);
const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte", ".astro"]);

const COMPONENT_PATTERNS = [
  /export\s+default\s+function\s+(\w+)/,
  /export\s+function\s+(\w+)/,
  /export\s+const\s+(\w+)\s*=\s*(?:React\.)?(?:memo|forwardRef|lazy|styled\.?\w*)\s*[(<]/,
  /export\s+const\s+(\w+)\s*:\s*(?:React\.)?(?:FC|FunctionComponent|ComponentType)/,
  /export\s+default\s+(?:memo|forwardRef)\s*\(\s*function\s+(\w+)/,
  /export\s+default\s+class\s+(\w+)/,
  /export\s+const\s+(\w+)\s*=\s*\([^)]*\)\s*(?::\s*\w+\s*)?=>/,
];

const EXPORT_PATTERN = /export\s+(?:default\s+)?(?:function|const|let|var|class|type|interface|enum)\s+(\w+)/g;

const IMPORT_RE = /(?:import\s+(?:[\w{},*\s]+\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

let _cachedGraph = null;
let _cachedMtimeKey = null;

function walkFiles(dir, base) {
  const results = [];
  let names;
  try { names = fs.readdirSync(dir); } catch { return results; }
  for (const name of names) {
    if (name.startsWith(".") || SKIP_DIRS.has(name)) continue;
    const fullPath = path.join(dir, name);
    const relPath = base ? base + "/" + name : name;
    try {
      const stat = fs.lstatSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...walkFiles(fullPath, relPath));
      } else if (stat.isFile() && CODE_EXTS.has(path.extname(name).toLowerCase())) {
        results.push({ rel: relPath, full: fullPath, mtime: stat.mtimeMs, size: stat.size });
      }
    } catch {}
  }
  return results;
}

function extractImports(content) {
  const imports = [];
  let m;
  const re = new RegExp(IMPORT_RE.source, "g");
  while ((m = re.exec(content)) !== null) {
    imports.push(m[1] || m[2]);
  }
  return imports;
}

function extractExports(content) {
  const exports = [];
  let m;
  const re = new RegExp(EXPORT_PATTERN.source, "g");
  while ((m = re.exec(content)) !== null) {
    exports.push(m[1]);
  }
  return exports;
}

function extractComponents(content) {
  const components = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const pat of COMPONENT_PATTERNS) {
      const m = lines[i].match(pat);
      if (m) {
        components.push({ name: m[1], line: i + 1 });
        break;
      }
    }
  }
  return components;
}

function resolveImport(fromFile, importPath, projectDir) {
  if (!importPath.startsWith(".")) return null;
  const baseDir = path.dirname(fromFile);
  const resolved = path.resolve(baseDir, importPath);
  const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte"];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate)) return path.relative(projectDir, candidate);
    const indexCandidate = path.join(resolved, "index" + ext);
    if (fs.existsSync(indexCandidate)) return path.relative(projectDir, indexCandidate);
  }
  return null;
}

function detectSlices(nodes, edges) {
  const slices = {};
  const dirGroups = {};

  for (const [filePath] of Object.entries(nodes)) {
    const parts = filePath.split("/");
    if (parts.length >= 3) {
      const featurePatterns = ["features", "modules", "domains", "pages", "views", "screens"];
      for (let i = 0; i < parts.length - 1; i++) {
        if (featurePatterns.includes(parts[i]) && parts[i + 1]) {
          const sliceName = parts[i + 1];
          if (!slices[sliceName]) slices[sliceName] = { name: sliceName, type: "feature", files: [], root: parts.slice(0, i + 2).join("/") };
          slices[sliceName].files.push(filePath);
          break;
        }
      }
    }

    if (parts.length >= 2) {
      const dirKey = parts.slice(0, -1).join("/");
      if (!dirGroups[dirKey]) dirGroups[dirKey] = [];
      dirGroups[dirKey].push(filePath);
    }
  }

  const importClusters = {};
  for (const edge of edges) {
    if (edge.type !== "imports") continue;
    const key = edge.to;
    if (!importClusters[key]) importClusters[key] = [];
    importClusters[key].push(edge.from);
  }

  for (const [sharedFile, importers] of Object.entries(importClusters)) {
    if (importers.length < 3) continue;
    const dirs = importers.map(f => f.split("/").slice(0, -1).join("/"));
    const commonDir = dirs[0];
    const allSameDir = dirs.every(d => d === commonDir);
    if (allSameDir && commonDir && !Object.values(slices).some(s => s.root === commonDir)) {
      const sliceName = commonDir.split("/").pop();
      if (!slices[sliceName]) {
        slices[sliceName] = { name: sliceName, type: "cluster", files: [...importers, sharedFile], root: commonDir };
      }
    }
  }

  for (const [dirKey, files] of Object.entries(dirGroups)) {
    if (files.length < 2) continue;
    const alreadyCovered = Object.values(slices).some(s => files.some(f => s.files.includes(f)));
    if (alreadyCovered) continue;
    const dirName = dirKey.split("/").pop();
    if (dirName === "src" || dirName === "lib" || dirName === "utils" || dirName === "components") continue;
    if (files.length >= 3) {
      slices[dirName] = { name: dirName, type: "directory", files, root: dirKey };
    }
  }

  return slices;
}

function buildGraph(projectDir) {
  const files = walkFiles(projectDir, "");

  const mtimeKey = files.map(f => `${f.rel}:${f.mtime}`).join("|");
  if (_cachedGraph && _cachedMtimeKey === mtimeKey) {
    return _cachedGraph;
  }

  const nodes = {};
  const edges = [];
  const importedByMap = {};

  for (const file of files) {
    let content;
    try { content = fs.readFileSync(file.full, "utf-8"); } catch { continue; }

    const imports = extractImports(content);
    const exports = extractExports(content);
    const components = extractComponents(content);
    const lineCount = content.split("\n").length;

    nodes[file.rel] = {
      path: file.rel,
      exports,
      components: components.map(c => c.name),
      lineCount,
      size: file.size,
      ext: path.extname(file.rel),
    };

    for (const imp of imports) {
      const resolved = resolveImport(file.full, imp, projectDir);
      if (resolved) {
        edges.push({ from: file.rel, to: resolved, type: "imports", module: imp });
        if (!importedByMap[resolved]) importedByMap[resolved] = [];
        importedByMap[resolved].push(file.rel);
      } else if (!imp.startsWith(".")) {
        edges.push({ from: file.rel, to: imp, type: "imports-external", module: imp });
      }
    }
  }

  for (const [filePath, node] of Object.entries(nodes)) {
    node.importedBy = importedByMap[filePath] || [];
  }

  const slices = detectSlices(nodes, edges);

  const entryPoints = [];
  const entryNames = ["src/index.tsx", "src/index.ts", "src/main.tsx", "src/main.ts", "src/App.tsx", "index.js", "index.ts", "src/app.tsx"];
  for (const ep of entryNames) {
    if (nodes[ep]) entryPoints.push(ep);
  }

  const graph = { slices, nodes, edges, entryPoints, totalFiles: Object.keys(nodes).length, totalEdges: edges.length };

  _cachedGraph = graph;
  _cachedMtimeKey = mtimeKey;
  return graph;
}

function queryNode(graph, target) {
  const node = graph.nodes[target];
  if (!node) {
    const matchingSlice = graph.slices[target];
    if (matchingSlice) {
      const sliceNodes = {};
      const sliceEdges = [];
      for (const fp of matchingSlice.files) {
        if (graph.nodes[fp]) sliceNodes[fp] = graph.nodes[fp];
      }
      for (const edge of graph.edges) {
        if (matchingSlice.files.includes(edge.from) || matchingSlice.files.includes(edge.to)) {
          sliceEdges.push(edge);
        }
      }
      return { type: "slice", slice: matchingSlice, nodes: sliceNodes, edges: sliceEdges };
    }
    return null;
  }

  const connectedEdges = graph.edges.filter(e => e.from === target || e.to === target);
  const connectedFiles = new Set();
  for (const e of connectedEdges) {
    connectedFiles.add(e.from);
    connectedFiles.add(e.to);
  }
  const connectedNodes = {};
  for (const fp of connectedFiles) {
    if (graph.nodes[fp]) connectedNodes[fp] = graph.nodes[fp];
  }

  return { type: "node", node, connectedNodes, edges: connectedEdges };
}

function impactAnalysis(graph, changedFiles) {
  const direct = new Set();
  const transitive = new Set();
  const visited = new Set();

  function walkDependents(filePath, depth) {
    if (visited.has(filePath)) return;
    visited.add(filePath);
    const node = graph.nodes[filePath];
    if (!node) return;
    const dependents = node.importedBy || [];
    for (const dep of dependents) {
      if (changedFiles.includes(dep)) continue;
      if (depth === 0) {
        direct.add(dep);
      } else {
        transitive.add(dep);
      }
      walkDependents(dep, depth + 1);
    }
  }

  for (const cf of changedFiles) {
    walkDependents(cf, 0);
  }

  const directArr = [...direct].filter(f => !changedFiles.includes(f));
  const transitiveArr = [...transitive].filter(f => !changedFiles.includes(f) && !direct.has(f));

  const riskScore = Math.min(10, Math.round(
    (changedFiles.length * 1.5) +
    (directArr.length * 1.0) +
    (transitiveArr.length * 0.3)
  ));

  return {
    changedFiles,
    directDependents: directArr,
    transitiveDependents: transitiveArr,
    totalAffected: changedFiles.length + directArr.length + transitiveArr.length,
    riskScore,
    riskLevel: riskScore <= 3 ? "low" : riskScore <= 6 ? "medium" : "high",
  };
}

function patternSearch(graph, pattern) {
  const results = [];
  const lowerPattern = (pattern || "").toLowerCase();

  if (/react\s*component/i.test(pattern) || /all\s*components/i.test(pattern)) {
    for (const [fp, node] of Object.entries(graph.nodes)) {
      if (node.components && node.components.length > 0) {
        results.push({ path: fp, components: node.components, lineCount: node.lineCount });
      }
    }
    return { pattern, matchType: "components", results, count: results.length };
  }

  if (/importing?\s+(?:from\s+)?['"]?([^'"]+)['"]?/i.test(pattern)) {
    const importMatch = pattern.match(/importing?\s+(?:from\s+)?['"]?([^'"]+)['"]?/i);
    const target = importMatch[1];
    for (const edge of graph.edges) {
      if (edge.module && (edge.module === target || edge.module.includes(target))) {
        results.push({ file: edge.from, imports: edge.module, type: edge.type });
      }
    }
    return { pattern, matchType: "import-search", results, count: results.length };
  }

  if (/\.\w+$/.test(pattern)) {
    const ext = pattern.startsWith(".") ? pattern : "." + pattern;
    for (const [fp, node] of Object.entries(graph.nodes)) {
      if (node.ext === ext) {
        results.push({ path: fp, lineCount: node.lineCount, exports: node.exports });
      }
    }
    return { pattern, matchType: "extension", results, count: results.length };
  }

  for (const [fp, node] of Object.entries(graph.nodes)) {
    if (fp.toLowerCase().includes(lowerPattern) ||
        (node.exports && node.exports.some(e => e.toLowerCase().includes(lowerPattern))) ||
        (node.components && node.components.some(c => c.toLowerCase().includes(lowerPattern)))) {
      results.push({ path: fp, exports: node.exports, components: node.components });
    }
  }
  return { pattern, matchType: "general", results, count: results.length };
}

function invalidateCache() {
  _cachedGraph = null;
  _cachedMtimeKey = null;
}

module.exports = {
  buildGraph,
  queryNode,
  impactAnalysis,
  patternSearch,
  invalidateCache,
};
