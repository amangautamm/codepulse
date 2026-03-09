import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from '../utils/config';

export interface DuplicateOccurrence {
    filePath: string;
    fileName: string;
    startLine: number;
    endLine: number;
}

export interface DuplicateBlock {
    hash: string;
    blockLines: number;
    occurrences: DuplicateOccurrence[];
    snippet: string;   // First 80 chars preview
}

// Normalize a line: strip whitespace, comments, blank lines
function normalizeLine(line: string): string {
    return line
        .replace(/\/\/.*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Simple but fast polynomial rolling hash
function polyHash(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (Math.imul(h, 0x01000193)) >>> 0;
    }
    return h;
}

export class DuplicateAnalyzer {
    private readonly fileChunks = new Map<string, Map<number, { lines: number[]; text: string }>>();
    private duplicates: DuplicateBlock[] = [];

    analyze(document: vscode.TextDocument): DuplicateBlock[] {
        const cfg = getConfig();
        if (!cfg.enableDuplicateDetection) { return []; }

        const minLines = cfg.duplicateMinLines;
        const rawLines = document.getText().split('\n');
        const normalized = rawLines.map(normalizeLine);

        const chunks = new Map<number, { lines: number[]; text: string }>();
        for (let i = 0; i <= normalized.length - minLines; i++) {
            const block = normalized.slice(i, i + minLines);
            const joined = block.join('\n');
            if (joined.trim().length < 30) { continue; }  // too short to matter
            const h = polyHash(joined);
            if (!chunks.has(h)) {
                const snippet = rawLines.slice(i, i + minLines).join('\n').substring(0, 80);
                chunks.set(h, { lines: [], text: snippet });
            }
            chunks.get(h)!.lines.push(i + 1);
        }
        this.fileChunks.set(document.fileName, chunks);
        this.rebuild(minLines);
        return this.forFile(document.fileName);
    }

    private rebuild(minLines: number): void {
        const global = new Map<number, { occs: DuplicateOccurrence[]; text: string }>();
        for (const [fp, chunks] of this.fileChunks) {
            for (const [h, { lines, text }] of chunks) {
                if (!global.has(h)) { global.set(h, { occs: [], text }); }
                for (const ln of lines) {
                    global.get(h)!.occs.push({
                        filePath: fp,
                        fileName: path.basename(fp),
                        startLine: ln,
                        endLine: ln + minLines - 1,
                    });
                }
            }
        }
        this.duplicates = [];
        for (const [h, { occs, text }] of global) {
            if (occs.length >= 2) {
                this.duplicates.push({
                    hash: h.toString(16),
                    blockLines: minLines,
                    occurrences: occs,
                    snippet: text,
                });
            }
        }
        // Sort: most occurrences first
        this.duplicates.sort((a, b) => b.occurrences.length - a.occurrences.length);
    }

    forFile(fp: string): DuplicateBlock[] {
        return this.duplicates.filter(d => d.occurrences.some(o => o.filePath === fp));
    }
    getAllDuplicates(): DuplicateBlock[] { return this.duplicates; }
    getTotalDuplicates(): number        { return this.duplicates.length; }
    getAffectedFiles(): number {
        const files = new Set<string>();
        for (const d of this.duplicates) { for (const o of d.occurrences) { files.add(o.filePath); } }
        return files.size;
    }
}
