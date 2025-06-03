import { Plugin, TFile } from 'obsidian';
interface HangulSearchSettings {
    fuzzyThreshold: number;
    overrideQuickSwitcher: boolean;
}
interface IndexEntry {
    display: string;
    jamo: string;
    path: string;
}
declare class HangulIndex {
    private plugin;
    private entries;
    private fuse;
    constructor(plugin: HangulSearchPlugin);
    /** 볼트 전체 초기 색인 */
    build(): Promise<void>;
    /** 파일 이름이 바뀔 때마다 업데이트 */
    updateOnRename(file: TFile, oldPath: string): void;
    /** 검색 */
    search(q: string): IndexEntry[];
    private toEntry;
    private rebuildFuse;
}
export default class HangulSearchPlugin extends Plugin {
    settings: HangulSearchSettings;
    index: HangulIndex;
    onload(): Promise<void>;
    loadSettings(): Promise<void>;
    saveSettings(): Promise<void>;
}
export {};
//# sourceMappingURL=main.d.ts.map