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

            // 4) Register vault events for real-time updates
            this.registerVaultEvents();
            console.log('✅ Vault events registered');

            // 5) Register link autocompletion
            this.registerEditorSuggest(new HangulLinkSuggest(this.app, this.index));
            console.log('✅ Korean link suggestions enabled');

            // 6) Add settings tab
            this.addSettingTab(new HangulSearchSettingTab(this.app, this));
            console.log('✅ Settings tab added');

            // 7) Show immediate availability message
            new Notice('✅ Korean Search Plugin ready! Building index in background...', 3000);
            console.log('🎉 Korean Search Plugin ready! Starting background indexing...');

            // 8) Build index progressively in background (non-blocking)
            this.buildIndexProgressively();

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

    private async buildIndexProgressively() {
        try {
            console.log('🔍 Building Korean search index progressively...');
            
            const files = this.app.vault.getMarkdownFiles();
            const totalFiles = files.length;
            console.log(`📊 Found ${totalFiles} files to index`);
            
            // For very large vaults, show a progress notice
            let progressNotice: Notice | null = null;
            if (totalFiles > 1000) {
                progressNotice = new Notice(`🔄 Indexing ${totalFiles} files for Korean search...`, 0);
            }
            
            // Clear existing index
            this.index.clear();
            
            // Process files in batches to avoid blocking UI
            const batchSize = 100; // Increased batch size for better performance
            let totalIndexed = 0;
            
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                
                // Process entire batch at once
                const batchIndexed = await this.index.batchAddFiles(batch);
                totalIndexed += batchIndexed;
                
                // Update progress for large vaults
                if (progressNotice && totalFiles > 1000) {
                    const progress = Math.round((totalIndexed / totalFiles) * 100);
                    progressNotice.setMessage(`🔄 Korean search indexing: ${progress}% (${totalIndexed}/${totalFiles})`);
                }
                
                // Small delay to prevent UI blocking, but only if more batches remain
                if (i + batchSize < files.length) {
                    await new Promise(resolve => setTimeout(resolve, 5)); // Reduced delay
                }
            }
            
            // Hide progress notice and show completion
            if (progressNotice) {
                progressNotice.hide();
            }
            
            console.log(`✅ Korean search index completed: ${totalIndexed} files`);
            new Notice(`🎉 Korean search fully indexed! ${totalIndexed} files ready to search`, 4000);
            
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