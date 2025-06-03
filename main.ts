import { Plugin, TFile, Notice, WorkspaceLeaf } from 'obsidian';
import { HangulSearchSettings, DEFAULT_SETTINGS, HangulSearchSettingTab } from './src/settings';
import { HangulIndex } from './src/hangulIndex';
import { HangulSwitcher } from './src/hangulSwitcher';
import { HangulLinkSuggest } from './src/hangulLinkSuggest';
import { addCommands } from './src/commands';

export default class HangulSearchPlugin extends Plugin {
    settings!: HangulSearchSettings;
    index!: HangulIndex;

    async onload() {
        console.log('🔥 Hangul Search Plugin (Omnisearch Replacement): Starting to load...');

        try {
            // 1) Load settings
            await this.loadSettings();
            console.log('✅ Settings loaded:', this.settings);

            // 2) Build search index
            this.index = new HangulIndex(this);
            await this.index.build();
            console.log('✅ Korean search index built successfully');

            // 3) Watch vault events for real-time updates
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

            // 4) Add commands
            addCommands(this);
            console.log('✅ Korean search commands added');

            // 5) Register link autocompletion
            this.registerEditorSuggest(new HangulLinkSuggest(this.app, this.index));
            console.log('✅ Korean link suggestions registered');

            // 6) Add settings tab
            this.addSettingTab(new HangulSearchSettingTab(this.app, this));
            console.log('✅ Settings tab added');

            // 7) Override default Quick Switcher if enabled
            if (this.settings.overrideQuickSwitcher) {
                this.overrideQuickSwitcher();
                console.log('✅ Quick Switcher overridden with Korean search');
            }

            // 8) Show success message
            new Notice('🎉 Korean Search (Omnisearch replacement) loaded successfully!', 3000);
            console.log('🎉 Hangul Search Plugin loaded successfully as Omnisearch replacement!');

        } catch (error) {
            console.error('❌ Error loading Hangul Search Plugin:', error);
            new Notice('❌ Failed to load Korean Search Plugin - check console', 5000);
        }
    }

    onunload() {
        console.log('👋 Hangul Search Plugin: Unloading...');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private overrideQuickSwitcher() {
        // Override the default Quick Switcher hotkey
        this.addCommand({
            id: 'korean-quick-switcher-override',
            name: 'Korean Quick Switcher (Override)',
            hotkeys: [{ modifiers: ['Mod'], key: 'o' }],
            callback: () => {
                new HangulSwitcher(this.app, this.index).open();
            }
        });
    }

    // Public API for other plugins
    public getSearchIndex() {
        return this.index;
    }

    public search(query: string) {
        return this.index.search(query);
    }
} 