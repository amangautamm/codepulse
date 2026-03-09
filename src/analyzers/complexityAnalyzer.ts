import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from '../utils/config';

export type ComplexityLevel = 'healthy' | 'warning' | 'critical';

export interface FunctionInfo {
    name: string;
    line: number;           // 1-based
    endLine: number;        // 1-based
    complexity: number;
    level: ComplexityLevel;
    params: number;
}

export interface FileComplexityResult {
    filePath: string;
    fileName: string;
    functions: FunctionInfo[];
    maxComplexity: number;
    avgComplexity: number;
    overallScore: number;   // 0-100, higher = better
    linesOfCode: number;
}

// Branch-point keywords that increase cyclomatic complexity
const BRANCH_RE = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bdo\s*\{/g,
    /\bcase\s+[^:]+:/g,
    /\bcatch\s*\(/g,
    /\?\?/g,
    /&&/g,
    /\|\|/g,
    /\?\s*[^:]+:/g,   // ternary
];

const FUNC_PATTERNS: RegExp[] = [
    // function foo(
    /^[\s]*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(/,
    // async function foo(
    /^[\s]*(?:export\s+)?(?:default\s+)?async\s+function\s+(\w+)\s*\(/,
    // const foo = async ( or function(
    /^[\s]*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\()[^)]*\)\s*(?::\s*\S+\s*)?(=>|{)/,
    // public/private/protected foo(  — class methods
    /^[\s]*(?:public|private|protected|static|abstract|override)(?:\s+(?:public|private|protected|static|abstract|async|override))*\s+(\w+)\s*\(/,
    // foo(  — plain class method / object method
    /^[\s]*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\S+\s*)?\{/,
];

const SKIP_KEYWORDS = new Set([
    'if','else','for','while','switch','catch','do','return',
    'class','interface','type','enum','import','export','new',
    'constructor','super','this','typeof','instanceof','await',
    'throw','try','finally','break','continue','delete','void',
    'in','of','from','as','extends','implements'
]);

export class ComplexityAnalyzer {
    private readonly results = new Map<string, FileComplexityResult>();

    analyze(document: vscode.TextDocument): FileComplexityResult {
        const cfg = getConfig();
        const text = document.getText();
        const lines = text.split('\n');
        const nonEmpty = lines.filter(l => l.trim().length > 0 && !l.trim().startsWith('//') && !l.trim().startsWith('*')).length;

        const functions = this.extractFunctions(lines);
        const analyzed: FunctionInfo[] = functions.map(fn => {
            const body = lines.slice(fn.startLine - 1, fn.endLine).join('\n');
            const complexity = this.calcComplexity(body);
            const params = fn.params;
            let level: ComplexityLevel = 'healthy';
            if (complexity >= cfg.complexityCriticalThreshold) { level = 'critical'; }
            else if (complexity >= cfg.complexityWarningThreshold) { level = 'warning'; }
            return { name: fn.name, line: fn.startLine, endLine: fn.endLine, complexity, level, params };
        });

        const maxComplexity  = analyzed.length ? Math.max(...analyzed.map(f => f.complexity)) : 0;
        const avgComplexity  = analyzed.length ? analyzed.reduce((s, f) => s + f.complexity, 0) / analyzed.length : 0;
        const critCount      = analyzed.filter(f => f.level === 'critical').length;
        const warnCount      = analyzed.filter(f => f.level === 'warning').length;
        const overallScore   = Math.max(0, Math.min(100, 100 - critCount * 15 - warnCount * 5));

        const result: FileComplexityResult = {
            filePath: document.fileName,
            fileName: path.basename(document.fileName),
            functions: analyzed,
            maxComplexity,
            avgComplexity: Math.round(avgComplexity * 10) / 10,
            overallScore,
            linesOfCode: nonEmpty,
        };
        this.results.set(document.fileName, result);
        return result;
    }

    private extractFunctions(lines: string[]): { name: string; startLine: number; endLine: number; params: number }[] {
        const out: { name: string; startLine: number; endLine: number; params: number }[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const pattern of FUNC_PATTERNS) {
                const m = line.match(pattern);
                if (!m || !m[1]) { continue; }
                const name = m[1];
                if (SKIP_KEYWORDS.has(name)) { continue; }
                const endLine = this.findFunctionEnd(lines, i);
                const params = this.countParams(line);
                out.push({ name, startLine: i + 1, endLine, params });
                break;
            }
        }
        return out;
    }

    /** Walk forward finding matching closing brace */
    private findFunctionEnd(lines: string[], startIdx: number): number {
        let depth = 0;
        let found = false;
        for (let i = startIdx; i < Math.min(startIdx + 200, lines.length); i++) {
            for (const ch of lines[i]) {
                if (ch === '{') { depth++; found = true; }
                else if (ch === '}') {
                    depth--;
                    if (found && depth <= 0) { return i + 1; }
                }
            }
        }
        return Math.min(startIdx + 50, lines.length);
    }

    private countParams(line: string): number {
        const m = line.match(/\(([^)]*)\)/);
        if (!m || !m[1].trim()) { return 0; }
        return m[1].split(',').filter(p => p.trim().length > 0).length;
    }

    private calcComplexity(body: string): number {
        let c = 1;
        for (const re of BRANCH_RE) {
            const matches = body.match(re);
            if (matches) { c += matches.length; }
        }
        return c;
    }

    getResult(fp: string): FileComplexityResult | undefined { return this.results.get(fp); }
    getAllResults(): FileComplexityResult[]                  { return [...this.results.values()]; }
    getWorkspaceScore(): number {
        const rs = this.getAllResults();
        if (!rs.length) { return 100; }
        return Math.round(rs.reduce((s, r) => s + r.overallScore, 0) / rs.length);
    }
    getCriticalFunctions(): Array<FunctionInfo & { file: string }> {
        const out: Array<FunctionInfo & { file: string }> = [];
        for (const r of this.getAllResults()) {
            for (const f of r.functions) {
                if (f.level === 'critical') {
                    out.push({ ...f, file: r.fileName });
                }
            }
        }
        return out.sort((a, b) => b.complexity - a.complexity);
    }
}
