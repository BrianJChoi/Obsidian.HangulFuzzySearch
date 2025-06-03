import { 
    App, 
    Editor, 
    EditorPosition, 
    EditorSuggest, 
    EditorSuggestContext, 
    EditorSuggestTriggerInfo,
    TFile 
} from 'obsidian';
import { IndexEntry, HangulIndex } from './hangulIndex';

export class HangulLinkSuggest extends EditorSuggest<IndexEntry> {
    constructor(app: App, private index: HangulIndex) {
        super(app);
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
        const line = editor.getLine(cursor.line);
        const textBeforeCursor = line.slice(0, cursor.ch);
        
        // [[ 트리거 감지
        const match = textBeforeCursor.match(/\[\[([^\]]*?)$/);
        if (match) {
            const start = cursor.ch - match[1].length;
            return {
                start: { line: cursor.line, ch: start },
                end: cursor,
                query: match[1]
            };
        }
        
        return null;
    }

    getSuggestions(context: EditorSuggestContext): IndexEntry[] {
        const query = context.query;
        if (!query) {
            // 빈 쿼리일 때는 최근 파일들 표시
            return this.getRecentFiles();
        }
        return this.index.search(query);
    }

    renderSuggestion(item: IndexEntry, el: HTMLElement): void {
        el.createEl('div', { text: item.display, cls: 'hangul-link-title' });
        if (item.path !== item.display) {
            el.createEl('small', { text: item.path, cls: 'hangul-link-path' });
        }
    }

    selectSuggestion(item: IndexEntry, evt: MouseEvent | KeyboardEvent): void {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf?.view.getViewType() === 'markdown') {
            const editor = (activeLeaf.view as any).editor;
            if (editor) {
                const cursor = editor.getCursor();
                const line = editor.getLine(cursor.line);
                const textBeforeCursor = line.slice(0, cursor.ch);
                
                // [[ 위치 찾기
                const match = textBeforeCursor.match(/\[\[([^\]]*?)$/);
                if (match) {
                    const start = cursor.ch - match[1].length;
                    const startPos = { line: cursor.line, ch: start };
                    const endPos = cursor;
                    
                    // 링크 완성
                    editor.replaceRange(item.display + ']]', startPos, endPos);
                }
            }
        }
    }

    private getRecentFiles(): IndexEntry[] {
        // 최근 파일들을 반환 (간단한 구현)
        const files = this.app.vault.getMarkdownFiles()
            .slice(0, 10)
            .map(file => ({
                display: file.basename,
                jamo: file.basename,
                path: file.path
            }));
        return files;
    }
} 