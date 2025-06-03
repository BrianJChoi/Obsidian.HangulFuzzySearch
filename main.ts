import { Plugin, TFile, Notice } from 'obsidian';
import { HangulSearchSettings, DEFAULT_SETTINGS, HangulSearchSettingTab } from './src/settings';
import { HangulIndex } from './src/hangulIndex';
import { HangulSwitcher } from './src/hangulSwitcher';
import { HangulLinkSuggest } from './src/hangulLinkSuggest';

export default class HangulSearchPlugin extends Plugin {
    settings!: HangulSearchSettings;
    index!: HangulIndex;

    async onload() {
        console.log('🔥 Korean Search Plugin: Starting...');

        try {
            // 1) Load settings first
            await this.loadSettings();
            console.log('✅ Settings loaded');

            // 2) Initialize search index
            this.index = new HangulIndex(this);
            console.log('✅ Search index initialized');

            // 3) Add core commands immediately
            this.addCoreCommands();
            console.log('✅ Commands registered');

            // 4) Build index in background
            this.buildIndexAsync();

            // 5) Register vault events for real-time updates
            this.registerVaultEvents();
            console.log('✅ Vault events registered');

            // 6) Register link autocompletion
            this.registerEditorSuggest(new HangulLinkSuggest(this.app, this.index));
            console.log('✅ Korean link suggestions enabled');

            // 7) Add settings tab
            this.addSettingTab(new HangulSearchSettingTab(this.app, this));
            console.log('✅ Settings tab added');

            // 8) Show success message
            new Notice('🎉 Korean Search Plugin activated! Use Cmd/Ctrl+Shift+O to search', 4000);
            console.log('🎉 Korean Search Plugin ready!');

        } catch (error) {
            console.error('❌ Korean Search Plugin failed to load:', error);
            new Notice('❌ Korean Search Plugin failed to load - check console for details', 5000);
        }
    }

    private addCoreCommands() {
        // Main Korean search command
        this.addCommand({
            id: 'korean-search',
            name: 'Open Korean Search',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'o' }],
            callback: () => {
                try {
                    console.log('🔍 Opening Korean Search...');
                    new HangulSwitcher(this.app, this.index).open();
                } catch (error) {
                    console.error('❌ Error opening Korean Search:', error);
                    new Notice('❌ Error opening Korean Search - check console for details');
                }
            }
        });

        // Quick search command with examples
        this.addCommand({
            id: 'korean-search-quick',
            name: 'Korean Search with Examples',
            callback: () => {
                new Notice('🔍 Korean Search Patterns: ㅎㄱ (초성), 한ㄱ (부분), ㅎㄱㄹ교 (혼합)', 5000);
                new HangulSwitcher(this.app, this.index).open();
            }
        });

        // Index rebuild command
        this.addCommand({
            id: 'hangul-rebuild-index',
            name: 'Rebuild Korean Search Index',
            callback: async () => {
                const notice = new Notice('🔄 Rebuilding Korean search index...', 0);
                try {
                    await this.index.build();
                    notice.hide();
                    new Notice(`✅ Korean search index rebuilt! ${this.index.getIndexedCount()} files indexed`, 3000);
                } catch (error) {
                    notice.hide();
                    console.error('❌ Failed to rebuild index:', error);
                    new Notice('❌ Failed to rebuild search index - check console for details', 5000);
                }
            }
        });

        // Help command
        this.addCommand({
            id: 'korean-search-help',
            name: 'Korean Search Guide',
            callback: () => {
                const help = `🔍 Korean Search Guide:

📝 Search Patterns:
• ㅎㄱ → finds 한글, 항공, 학교
• 한ㄱ → finds 한국, 한글  
• ㅎㄱㄹ교 → finds 한글학교

⌨️ Keyboard Shortcuts:
• Cmd/Ctrl+Shift+O: Open search
• ↑↓: Navigate results
• Enter: Open file
• Ctrl+Enter: Open in new tab
• Shift+Enter: Open in new pane

📊 Currently indexed: ${this.index.getIndexedCount()} files`;
                
                new Notice(help, 8000);
            }
        });
    }

    private async buildIndexAsync() {
        try {
            console.log('🔍 Building Korean search index...');
            await this.index.build();
            console.log(`✅ Korean search index completed: ${this.index.getIndexedCount()} files`);
            new Notice(`✅ Korean search is ready! ${this.index.getIndexedCount()} files indexed`, 3000);
        } catch (error) {
            console.error('❌ Failed to build search index:', error);
            new Notice('❌ Failed to build search index - check console for details', 5000);
        }
    }

    private registerVaultEvents() {
        if (!this.settings.enableAutoIndex) return;

        this.registerEvent(
            this.app.vault.on('create', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.index.addFile(file);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (file instanceof TFile) {
                    this.index.removeFile(file);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                if (file instanceof TFile) {
                    this.index.updateOnRename(file, oldPath);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.index.updateFile(file);
                }
            })
        );
    }

    onunload() {
        console.log('👋 Korean Search Plugin: Unloaded');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // Public API for other plugins
    public getSearchIndex() {
        return this.index;
    }

    public search(query: string) {
        return this.index.search(query);
    }
} 