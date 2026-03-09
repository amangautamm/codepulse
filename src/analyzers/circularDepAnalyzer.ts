import * as fs from 'fs';
import * as path from 'path';

export interface CircularCycle {
    cycle: string[];     // short file names
    fullPaths: string[]; // full file paths
}

export class CircularDepAnalyzer {
    private readonly graph = new Map<string, Set<string>>();
    private cycles: CircularCycle[] = [];

    analyzeFiles(filePaths: string[]): CircularCycle[] {
        this.graph.clear();
        this.cycles = [];

        for (const fp of filePaths) {
            try {
                const content = fs.readFileSync(fp, 'utf8');
                this.graph.set(fp, new Set(this.extractImports(content, fp)));
            } catch { /* skip unreadable */ }
        }

        this.detectAllCycles();
        return this.cycles;
    }

    private extractImports(content: string, fromFile: string): string[] {
        const dir = path.dirname(fromFile);
        const resolved: string[] = [];
        // Match static ES imports and require() calls with relative paths
        const patterns = [
            /import\s+[^'"]*\s+from\s+['"](\.\.?\/[^'"]+)['"]/g,
            /import\s*\(['"](\.\.?\/[^'"]+)['"]\)/g,
            /require\(['"](\.\.?\/[^'"]+)['"]\)/g,
        ];
        for (const pattern of patterns) {
            let m: RegExpExecArray | null;
            while ((m = pattern.exec(content)) !== null) {
                const r = this.resolveImport(dir, m[1]);
                if (r) { resolved.push(r); }
            }
        }
        return resolved;
    }

    private resolveImport(dir: string, imp: string): string | null {
        const base = path.resolve(dir, imp);
        const exts = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
        for (const ext of exts) {
            const p = base.endsWith(ext) ? base : base + ext;
            if (fs.existsSync(p)) { return p; }
        }
        return null;
    }

    private detectAllCycles(): void {
        const visited   = new Set<string>();
        const inStack   = new Set<string>();
        const stackPath: string[] = [];
        const seenCycles = new Set<string>();

        const dfs = (node: string): void => {
            if (inStack.has(node)) {
                const start = stackPath.indexOf(node);
                if (start === -1) { return; }
                const cycleNodes = [...stackPath.slice(start), node];
                const key = cycleNodes.slice().sort().join('|');
                if (!seenCycles.has(key)) {
                    seenCycles.add(key);
                    this.cycles.push({
                        cycle:     cycleNodes.map(p => path.basename(p)),
                        fullPaths: cycleNodes,
                    });
                }
                return;
            }
            if (visited.has(node)) { return; }
            visited.add(node);
            inStack.add(node);
            stackPath.push(node);

            const deps = this.graph.get(node) ?? new Set<string>();
            for (const dep of deps) { dfs(dep); }

            stackPath.pop();
            inStack.delete(node);
        };

        for (const node of this.graph.keys()) { dfs(node); }
    }

    getCycles(): CircularCycle[] { return this.cycles; }
    hasCycles(): boolean         { return this.cycles.length > 0; }
}
