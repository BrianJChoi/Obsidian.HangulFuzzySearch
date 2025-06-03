import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import MyPlugin from '../main';

export class UserSuggest extends EditorSuggest<string> {
    plugin: MyPlugin;

    constructor(plugin: MyPlugin) {
        super(plugin.app);
        this.plugin = plugin;
    }

    // 트리거 조건을 정의합니다.
    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
        const line = editor.getLine(cursor.line);
        const subString = line.substring(0, cursor.ch);
        const match = subString.match(/@(\w*)$/);

        if (match) {
            return {
                start: { line: cursor.line, ch: match.index! },
                end: cursor,
                query: match[1]
            };
        }
        return null;
    }

    // 제안 목록을 생성합니다.
    getSuggestions(context: EditorSuggestContext): string[] {
        const query = context.query.toLowerCase();
        // 실제 사용 시에는 이 목록을 동적으로 생성하거나 설정에서 가져올 수 있습니다.
        const users = ['John', 'Jane', 'Alice', 'Bob', 'Charlie'];
        return users.filter(user => user.toLowerCase().startsWith(query));
    }

    // 선택된 제안을 렌더링합니다.
    renderSuggestion(value: string, el: HTMLElement): void {
        el.setText(value);
    }

    // 제안이 선택되었을 때의 동작을 정의합니다.
    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        const { editor, start, end } = this.context!;
        editor.replaceRange(`@${value} `, start, end);
    }
}