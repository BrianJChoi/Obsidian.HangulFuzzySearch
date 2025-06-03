import { Plugin, TFile, Notice } from 'obsidian';
import { HangulSearchSettings, DEFAULT_SETTINGS, HangulSearchSettingTab } from './src/settings';
import { HangulIndex } from './src/hangulIndex';
import { HangulSwitcher } from './src/hangulSwitcher';
import { HangulLinkSuggest } from './src/hangulLinkSuggest';

export default class HangulSearchPlugin extends Plugin {
    settings!: HangulSearchSettings;
    index!: HangulIndex;

    async onload() {
        console.log('🔥 Korean Search Plugin: Starting to load...');

        try {
            // 1) Load settings first
            await this.loadSettings();
            console.log('✅ Settings loaded successfully');

            // 2) Initialize search index
            this.index = new HangulIndex(this);
            console.log('✅ Search index initialized');

            // 3) Add core commands immediately
            this.addCoreCommands();
            console.log('✅ Core commands added');

            // 4) Build index in background
            this.buildIndexAsync();

            // 5) Register vault events for real-time updates
            this.registerVaultEvents();
            console.log('✅ Vault events registered');

            // 6) Register link autocompletion
            this.registerEditorSuggest(new HangulLinkSuggest(this.app, this.index));
            console.log('✅ Korean link suggestions registered');

            // 7) Add settings tab
            this.addSettingTab(new HangulSearchSettingTab(this.app, this));
            console.log('✅ Settings tab added');

            // 8) Show success message
            new Notice('🎉 Korean Search loaded! Try Cmd/Ctrl+Shift+O to search', 4000);
            console.log('🎉 Korean Search Plugin loaded successfully!');

        } catch (error) {
            console.error('❌ Error loading Korean Search Plugin:', error);
            new Notice('❌ Failed to load Korean Search Plugin - check console', 5000);
        }
    }

    private addCoreCommands() {
        // Main Korean search command
        this.addCommand({
            id: 'korean-search',
            name: 'Korean Search (Test Korean patterns here!)',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'o' }],
            callback: () => {
                try {
                    console.log('🔍 Opening Korean Search...');
                    new HangulSwitcher(this.app, this.index).open();
                } catch (error) {
                    console.error('❌ Error opening Korean Search:', error);
                    new Notice('❌ Error opening Korean Search - check console');
                }
            }
        });

        // Quick test command
        this.addCommand({
            id: 'korean-search-test',
            name: 'Test Korean Search Now!',
            callback: () => {
                new Notice('🔍 Try these patterns: ㅎㄱ (초성), 한ㄱ (부분), ㅎㄱㄹ교 (혼합)', 5000);
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
                    new Notice(`✅ Korean index rebuilt! Found ${this.index.getIndexedCount()} files`, 3000);
                } catch (error) {
                    notice.hide();
                    console.error('❌ Failed to rebuild index:', error);
                    new Notice('❌ Failed to rebuild index - check console', 5000);
                }
            }
        });

        // Help command
        this.addCommand({
            id: 'korean-search-help',
            name: 'Korean Search Help & Examples',
            callback: () => {
                const help = `🔍 Korean Search Help:

📝 Try these patterns:
• ㅎㄱ → finds 한글, 항공, 학교
• 한ㄱ → finds 한국, 한글  
• ㅎㄱㄹ교 → finds 한글학교

⌨️ Shortcuts:
• Cmd/Ctrl+Shift+O: Open search
• ↑↓: Navigate results
• Enter: Open file
• Ctrl+Enter: New tab
• Shift+Enter: New pane

Currently indexed: ${this.index.getIndexedCount()} files`;
                
                new Notice(help, 8000);
            }
        });
    }

    private async buildIndexAsync() {
        try {
            console.log('🔍 Building Korean search index...');
            await this.index.build();
            console.log(`✅ Korean search index built: ${this.index.getIndexedCount()} files indexed`);
            new Notice(`✅ Korean search ready! ${this.index.getIndexedCount()} files indexed`, 3000);
        } catch (error) {
            console.error('❌ Failed to build search index:', error);
            new Notice('❌ Failed to build search index - check console', 5000);
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
        console.log('👋 Korean Search Plugin: Unloading...');
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