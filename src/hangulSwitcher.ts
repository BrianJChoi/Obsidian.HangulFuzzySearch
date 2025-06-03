import { App, FuzzySuggestModal, FuzzyMatch, TFile, Instruction } from 'obsidian';
import { IndexEntry, HangulIndex } from './hangulIndex';

export class HangulSwitcher extends FuzzySuggestModal<IndexEntry> {
    private searchResults: IndexEntry[] = [];

    constructor(app: App, private index: HangulIndex) {
        super(app);
        this.setPlaceholder('🔍 Korean Search (Type to search files, content, and Korean text...)');
        this.setInstructions([
            { command: '↑↓', purpose: 'to navigate' },
            { command: '↵', purpose: 'to open' },
            { command: 'Ctrl ↵', purpose: 'to open in new tab' },
            { command: 'Shift ↵', purpose: 'to open in new pane' },
            { command: 'esc', purpose: 'to dismiss' }
        ]);
    }

    getItems(): IndexEntry[] {
        const query = this.inputEl.value;
        
        if (!query || query.trim().length === 0) {
            // Show recent files when no query
            return this.getRecentFiles();
        }

        // Perform Korean-aware search
        this.searchResults = this.index.search(query, 50);
        return this.searchResults;
    }

    getItemText(item: IndexEntry): string {
        return item.display;
    }

    onChooseItem(item: IndexEntry, evt: MouseEvent | KeyboardEvent): void {
        const file = this.app.vault.getAbstractFileByPath(item.path);
        if (!(file instanceof TFile)) {
            return;
        }

        // Handle different modifiers
        const newLeaf = (evt as KeyboardEvent)?.ctrlKey || (evt as MouseEvent)?.ctrlKey;
        const newPane = (evt as KeyboardEvent)?.shiftKey || (evt as MouseEvent)?.shiftKey;

        if (newPane) {
            // Open in new pane (split)
            this.app.workspace.getLeaf('split').openFile(file);
        } else if (newLeaf) {
            // Open in new tab
            this.app.workspace.getLeaf('tab').openFile(file);
        } else {
            // Open in current tab
            this.app.workspace.activeLeaf?.openFile(file);
        }
    }

    renderSuggestion(value: FuzzyMatch<IndexEntry>, el: HTMLElement): void {
        const item = value.item;
        const query = this.inputEl.value.toLowerCase();

        // Clear existing content
        el.empty();
        el.addClass('hangul-search-result');

        // Create main container
        const container = el.createDiv({ cls: 'hangul-search-result-container' });

        // File name with highlighting
        const titleEl = container.createDiv({ cls: 'hangul-search-title' });
        this.highlightText(titleEl, item.display, query);

        // File path
        if (item.path !== item.display) {
            const pathEl = container.createDiv({ cls: 'hangul-search-path' });
            pathEl.setText(item.path);
        }

        // Content preview with highlighting
        if (item.content && item.content.trim()) {
            const contentEl = container.createDiv({ cls: 'hangul-search-content' });
            this.highlightText(contentEl, item.content, query);
        }

        // Metadata
        const metaEl = container.createDiv({ cls: 'hangul-search-meta' });
        
        // File size
        const sizeText = this.formatFileSize(item.size);
        metaEl.createSpan({ cls: 'hangul-search-size', text: sizeText });

        // Modified time
        const timeText = this.formatRelativeTime(item.mtime);
        metaEl.createSpan({ cls: 'hangul-search-time', text: timeText });

        // Search score (for debugging)
        if (item.score > 0) {
            metaEl.createSpan({ 
                cls: 'hangul-search-score', 
                text: `Score: ${item.score.toFixed(2)}` 
            });
        }
    }

    private highlightText(el: HTMLElement, text: string, query: string): void {
        if (!query) {
            el.setText(text);
            return;
        }

        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        
        let lastIndex = 0;
        let matchIndex = lowerText.indexOf(lowerQuery);

        while (matchIndex !== -1) {
            // Add text before match
            if (matchIndex > lastIndex) {
                el.appendText(text.substring(lastIndex, matchIndex));
            }

            // Add highlighted match
            const matchEl = el.createSpan({ cls: 'hangul-search-highlight' });
            matchEl.setText(text.substring(matchIndex, matchIndex + query.length));

            lastIndex = matchIndex + query.length;
            matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
        }

        // Add remaining text
        if (lastIndex < text.length) {
            el.appendText(text.substring(lastIndex));
        }
    }

    private getRecentFiles(): IndexEntry[] {
        // Get recently opened files
        const recentFiles = this.app.workspace.getLastOpenFiles()
            .slice(0, 10)
            .map(path => {
                const file = this.app.vault.getAbstractFileByPath(path);
                if (file instanceof TFile) {
                    return {
                        display: file.basename,
                        jamo: file.basename,
                        path: file.path,
                        content: 'Recently opened file',
                        contentJamo: '',
                        score: 0,
                        size: file.stat.size,
                        mtime: file.stat.mtime
                    } as IndexEntry;
                }
                return null;
            })
            .filter(Boolean) as IndexEntry[];

        return recentFiles;
    }

    private formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }

    private formatRelativeTime(timestamp: number): string {
        const now = Date.now();
        const diff = now - timestamp;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor(diff / (1000 * 60));

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }
} 