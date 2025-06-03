import {
    App,
    Editor,
    EditorPosition,
    FuzzySuggestModal,
    Plugin,
    PluginSettingTab,
    TFile,
    EditorSuggest,
    EditorSuggestContext,
    } from 'obsidian';
  
  import Fuse from 'fuse.js';
  import Hangul from 'hangul-js';
  
  /* ---------- 사용자 설정 ---------- */
  interface HangulSearchSettings {
    fuzzyThreshold: number;       // 0 (엄격) ↔ 1 (느슨)
    overrideQuickSwitcher: boolean;
  }
  
  const DEFAULT_SETTINGS: HangulSearchSettings = {
    fuzzyThreshold: 0.4,
    overrideQuickSwitcher: true,
  };
  
  /* ---------- 색인 ---------- */
  interface IndexEntry {
    display: string;   // 보여줄 이름
    jamo: string;      // 분해된 자모
    path: string;      // 파일 경로
  }
  
  class HangulIndex {
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
  
  /* ---------- Quick Switcher 모달 ---------- */
  class HangulSwitcher extends FuzzySuggestModal<IndexEntry> {
    constructor(app: App, private index: HangulIndex) {
      super(app);
    }
    getItems()            { return this.index.search(this.inputEl.value || ''); }
    getItemText(item: IndexEntry)     { return item.display; }
    onChooseItem(item: IndexEntry)    { this.app.workspace.openLinkText(item.path, '', false); }
  }
  
  /* ---------- [[ 링크 자동완성 ---------- */
  class HangulLinkSuggest extends EditorSuggest<IndexEntry> {
    constructor(app: App, private index: HangulIndex) {
      super(app);
    }
  
    onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestContext | null {
      const trigger = editor.getRange({ line: cursor.line, ch: cursor.ch - 2 }, cursor);
      if (trigger === '[[') {
        const file = this.app.workspace.getActiveFile();
        if (!file) return null;
        
        const context = { 
          start: cursor, 
          end: cursor, 
          query: '',
          editor: editor,
          file: file
        };
        return context;
      }
      return null;
    }
  
    getSuggestions(ctx: EditorSuggestContext) {
      return this.index.search(ctx.query);
    }
    renderSuggestion(item: IndexEntry, el: HTMLElement) {
      el.textContent = item.display;
    }
    selectSuggestion(item: IndexEntry, evt: MouseEvent | KeyboardEvent) {
      const activeLeaf = this.app.workspace.activeLeaf;
      if (activeLeaf?.view.getViewType() === 'markdown') {
        const editor = (activeLeaf.view as any).editor;
        if (editor) {
          const cursor = editor.getCursor();
          const lineText = editor.getLine(cursor.line);
          const beforeCursor = lineText.substring(0, cursor.ch);
          const linkStart = beforeCursor.lastIndexOf('[[');
          
          if (linkStart !== -1) {
            const start = { line: cursor.line, ch: linkStart + 2 };
            const end = cursor;
            editor.replaceRange(item.display + ']]', start, end);
          }
        }
      }
    }
  }
  
  /* ---------- 플러그인 본체 ---------- */
  export default class HangulSearchPlugin extends Plugin {
    settings!: HangulSearchSettings;
    index!: HangulIndex;
  
    async onload() {
      /* 1) 설정 로드 */
      await this.loadSettings();
  
      /* 2) 색인 빌드 */
      this.index = new HangulIndex(this);
      await this.index.build();
  
      /* 3) 볼트 이벤트 감시 */
      this.registerEvent(
        this.app.vault.on('rename', (file, oldPath) => {
          if (file instanceof TFile) this.index.updateOnRename(file, oldPath);
        }),
      );
  
      /* 4) Quick Switcher 대체 */
      if (this.settings.overrideQuickSwitcher) {
        this.addCommand({
          id: 'hangul-quick-switcher',
          name: 'Hangul Quick Switcher',
          hotkeys: [{ modifiers: ['Mod'], key: 'o' }], // ⌘O
          callback: () => new HangulSwitcher(this.app, this.index).open(),
        });
      }
  
      /* 5) 링크 자동완성 */
      this.registerEditorSuggest(new HangulLinkSuggest(this.app, this.index));
  
      /* 6) (선택) 설정 탭 */
      this.addSettingTab(
        new (class extends PluginSettingTab {
          constructor(app: App, private plugin: HangulSearchPlugin) {
            super(app, plugin);
          }
          display() {
            const { containerEl } = this;
            containerEl.empty();
            containerEl.createEl('h2', { text: 'Hangul Fuzzy Search Settings' });
            // TODO: threshold 슬라이더 등 추가
          }
        })(this.app, this),
      );
    }
  
    /* ---------- 설정 load/save ---------- */
    async loadSettings() {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() { await this.saveData(this.settings); }
  }