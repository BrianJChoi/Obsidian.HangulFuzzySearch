import { EditorSuggest, EditorPosition, EditorSuggestContext, EditorSuggestTriggerInfo, TFile, Editor, App } from 'obsidian';
import { IndexEntry } from './hangulIndex';

export class HangulLinkSuggest extends EditorSuggest<IndexEntry> {
    constructor(app: App, private index: any) {
        super(app);
    }

    onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo | null {
        const line = editor.getLine(cursor.line);
        const beforeCursor = line.substring(0, cursor.ch);
        
        // Look for [[ pattern
        const match = beforeCursor.match(/\[\[([^\]]*?)$/);
        if (match) {
            return {
                start: { line: cursor.line, ch: cursor.ch - match[1].length },
                end: cursor,
                query: match[1]
            };
        }
        
        return null;
    }

    getSuggestions(context: EditorSuggestContext): IndexEntry[] {
        const query = context.query;
        if (!query) {
            // Return recent files or all files
            return this.getRecentFiles();
        }
        
        // Use the index to search
        return this.index.search(query, 20);
    }

    renderSuggestion(item: IndexEntry, el: HTMLElement): void {
        const container = el.createDiv();
        
        // File name
        const titleEl = container.createDiv({ cls: 'hangul-link-title' });
        titleEl.setText(item.display);
        
        // File path (if different from display)
        if (item.path !== item.display) {
            const pathEl = container.createDiv({ cls: 'hangul-link-path' });
            pathEl.setText(item.path);
        }
    }

    selectSuggestion(item: IndexEntry): void {
        const editor = this.context?.editor;
        if (!editor) return;
        
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const beforeCursor = line.substring(0, cursor.ch);
        
        // Find the start of the [[ pattern
        const match = beforeCursor.match(/\[\[([^\]]*?)$/);
        if (!match) return;
        
        const start = cursor.ch - match[1].length;
        const end = cursor.ch;
        
        // Replace with the selected file name
        editor.replaceRange(
            item.display + ']]',
            { line: cursor.line, ch: start },
            { line: cursor.line, ch: end }
        );
    }

    private getRecentFiles(): IndexEntry[] {
        // Get recently opened files and convert to IndexEntry format
        const recentFiles = this.app.workspace.getLastOpenFiles()
            .slice(0, 10)
            .map((path: string) => {
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
} 