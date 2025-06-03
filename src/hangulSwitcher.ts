import { App, SuggestModal, TFile } from 'obsidian';
import { IndexEntry, HangulIndex } from './hangulIndex';

export class HangulSwitcher extends SuggestModal<IndexEntry> {
    constructor(app: App, private index: HangulIndex) {
        super(app);
        this.setPlaceholder('🔍 Korean Search: Try ㅎㄱ, 한ㄱ, or ㅎㄱㄹ교...');
        this.setInstructions([
            { command: '↑↓', purpose: 'to navigate' },
            { command: '↵', purpose: 'to open' },
            { command: 'Ctrl ↵', purpose: 'to open in new tab' },
            { command: 'Shift ↵', purpose: 'to open in new pane' },
            { command: 'esc', purpose: 'to dismiss' }
        ]);
    }

    getSuggestions(query: string): IndexEntry[] {
        console.log(`🔍 HangulSwitcher.getSuggestions() called with query: "${query}"`);
        
        if (!query || query.trim().length === 0) {
            const recentFiles = this.getRecentFiles();
            console.log(`📂 Showing ${recentFiles.length} recent files for empty query`);
            return recentFiles;
        }

        // Perform Korean-aware search
        const results = this.index.search(query, 50);
        console.log(`✅ HangulSwitcher returning ${results.length} results for "${query}"`);
        
        // Log first few results for debugging
        if (results.length > 0) {
            console.log(`📝 First few results:`, results.slice(0, 3).map(r => r.display));
        }
        
        return results;
    }

    renderSuggestion(item: IndexEntry, el: HTMLElement): void {
        console.log(`🎨 Rendering suggestion: ${item.display}`);

        // Clear existing content
        el.empty();
        el.addClass('hangul-search-result');

        // Create main container
        const container = el.createDiv({ cls: 'hangul-search-result-container' });

        // File name with highlighting
        const titleEl = container.createDiv({ cls: 'hangul-search-title' });
        titleEl.setText(item.display);

        // File path
        if (item.path !== item.display) {
            const pathEl = container.createDiv({ cls: 'hangul-search-path' });
            pathEl.setText(item.path);
        }

        // Content preview
        if (item.content && item.content.trim()) {
            const contentEl = container.createDiv({ cls: 'hangul-search-content' });
            contentEl.setText(item.content.substring(0, 100) + '...');
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

    onChooseSuggestion(item: IndexEntry, evt: MouseEvent | KeyboardEvent): void {
        const file = this.app.vault.getAbstractFileByPath(item.path);
        if (!(file instanceof TFile)) {
            console.error(`❌ File not found: ${item.path}`);
            return;
        }

        // Handle different modifiers
        const newLeaf = (evt as KeyboardEvent)?.ctrlKey || (evt as MouseEvent)?.ctrlKey;
        const newPane = (evt as KeyboardEvent)?.shiftKey || (evt as MouseEvent)?.shiftKey;

        console.log(`📂 Opening file: ${item.path} (newLeaf: ${newLeaf}, newPane: ${newPane})`);

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

    private getRecentFiles(): IndexEntry[] {
        try {
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
        } catch (error) {
            console.error('❌ Error getting recent files:', error);
            return [];
        }
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