import { TFile } from 'obsidian';
import Fuse from 'fuse.js';
import Hangul from 'hangul-js';
import HangulSearchPlugin from '../main';

export interface IndexEntry {
    display: string;   // 보여줄 이름
    jamo: string;      // 분해된 자모
    path: string;      // 파일 경로
}

export class HangulIndex {
    private entries: IndexEntry[] = [];
    private fuse!: Fuse<IndexEntry>;

    constructor(private plugin: HangulSearchPlugin) {}

    /** 볼트 전체 초기 색인 */
    async build() {
        const files = this.plugin.app.vault.getMarkdownFiles();
        this.entries = files.map((f) => this.toEntry(f));
        this.rebuildFuse();
    }

    /** 파일 이름이 바뀔 때마다 업데이트 */
    updateOnRename(file: TFile, oldPath: string) {
        const i = this.entries.findIndex((e) => e.path === oldPath);
        if (i > -1) this.entries.splice(i, 1, this.toEntry(file));
        else this.entries.push(this.toEntry(file));
        this.rebuildFuse();
    }

    /** 검색 */
    search(q: string): IndexEntry[] {
        const jamo = Hangul.disassemble(q).join('');
        return this.fuse.search(jamo).map((r) => r.item);
    }

    /** 임계값 업데이트 (설정에서 호출) */
    updateThreshold(threshold: number) {
        this.rebuildFuse();
    }

    /* ---------- 내부 ---------- */
    private toEntry(file: TFile): IndexEntry {
        const display = file.basename;
        return {
            display,
            jamo: Hangul.disassemble(display).join(''),
            path: file.path,
        };
    }

    private rebuildFuse() {
        this.fuse = new Fuse(this.entries, {
            threshold: this.plugin.settings.fuzzyThreshold,
            keys: ['jamo', 'display'],
        });
    }
} 