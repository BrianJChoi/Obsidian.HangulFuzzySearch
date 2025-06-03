import { App, FuzzySuggestModal, FuzzyMatch } from 'obsidian';
import { IndexEntry, HangulIndex } from './hangulIndex';

export class HangulSwitcher extends FuzzySuggestModal<IndexEntry> {
    constructor(app: App, private index: HangulIndex) {
        super(app);
        this.setPlaceholder('Search files by Hangul (초성/중성/종성)...');
    }

    getItems(): IndexEntry[] {
        const query = this.inputEl.value;
        if (!query) {
            // 빈 쿼리일 때는 최근 파일들을 표시
            return [];
        }
        return this.index.search(query);
    }

    getItemText(item: IndexEntry): string {
        return item.display;
    }

    onChooseItem(item: IndexEntry): void {
        this.app.workspace.openLinkText(item.path, '', false);
    }

    renderSuggestion(value: FuzzyMatch<IndexEntry>, el: HTMLElement): void {
        const item = value.item;
        el.createEl('div', { text: item.display, cls: 'hangul-switcher-title' });
        if (item.path !== item.display) {
            el.createEl('small', { text: item.path, cls: 'hangul-switcher-path' });
        }
    }
} 