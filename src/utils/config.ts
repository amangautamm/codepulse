import * as vscode from 'vscode';

export interface CodePulseConfig {
    complexityWarningThreshold: number;
    complexityCriticalThreshold: number;
    enableDeadCodeDetection: boolean;
    enableDuplicateDetection: boolean;
    duplicateMinLines: number;
    enableActivityTracking: boolean;
    activityIdleTimeoutMinutes: number;
    excludePatterns: string[];
    autoAnalyzeOnSave: boolean;
}

export function getConfig(): CodePulseConfig {
    const cfg = vscode.workspace.getConfiguration('codepulse');
    return {
        complexityWarningThreshold:  cfg.get<number>('complexityWarningThreshold', 6),
        complexityCriticalThreshold: cfg.get<number>('complexityCriticalThreshold', 10),
        enableDeadCodeDetection:     cfg.get<boolean>('enableDeadCodeDetection', true),
        enableDuplicateDetection:    cfg.get<boolean>('enableDuplicateDetection', true),
        duplicateMinLines:           cfg.get<number>('duplicateMinLines', 5),
        enableActivityTracking:      cfg.get<boolean>('enableActivityTracking', true),
        activityIdleTimeoutMinutes:  cfg.get<number>('activityIdleTimeoutMinutes', 5),
        excludePatterns:             cfg.get<string[]>('excludePatterns', ['**/node_modules/**']),
        autoAnalyzeOnSave:           cfg.get<boolean>('autoAnalyzeOnSave', true),
    };
}

export function buildExcludeGlob(patterns: string[]): string {
    return patterns.length > 0 ? `{${patterns.join(',')}}` : '';
}
