import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type HangulSearchPlugin from '../main';

export interface HangulSearchSettings {
    fuzzyThreshold: number;       // 0 (strict) ↔ 1 (loose)
    overrideQuickSwitcher: boolean;
    indexContent: boolean;        // Whether to index file content
    maxResults: number;           // Maximum search results to show
    showFileSize: boolean;        // Show file size in results
    showModifiedTime: boolean;    // Show modified time in results
    showScore: boolean;           // Show search score (debug)
    enableAutoIndex: boolean;     // Auto-rebuild index on file changes
}

export const DEFAULT_SETTINGS: HangulSearchSettings = {
    fuzzyThreshold: 0.4,
    overrideQuickSwitcher: true,
    indexContent: true,
    maxResults: 50,
    showFileSize: true,
    showModifiedTime: true,
    showScore: false,
    enableAutoIndex: true,
};

export class HangulSearchSettingTab extends PluginSettingTab {
    plugin: HangulSearchPlugin;

    constructor(app: App, plugin: HangulSearchPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        // Header
        containerEl.createEl('h1', { text: '🔍 Korean Search Settings' });
        containerEl.createEl('p', { 
            text: 'Omnisearch replacement with Korean language support',
            cls: 'setting-item-description'
        });

        // Search Settings Section
        containerEl.createEl('h2', { text: 'Search Configuration' });

        new Setting(containerEl)
            .setName('Fuzzy search threshold')
            .setDesc('Controls search sensitivity (0 = exact match, 1 = very loose match)')
            .addSlider(slider => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.fuzzyThreshold)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.fuzzyThreshold = value;
                    await this.plugin.saveSettings();
                    this.plugin.index.updateThreshold(value);
                }))
            .addText(text => text
                .setValue(this.plugin.settings.fuzzyThreshold.toString())
                .onChange(async (value) => {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue) && numValue >= 0 && numValue <= 1) {
                        this.plugin.settings.fuzzyThreshold = numValue;
                        await this.plugin.saveSettings();
                        this.plugin.index.updateThreshold(numValue);
                    }
                }));

        new Setting(containerEl)
            .setName('Maximum search results')
            .setDesc('Limit the number of results shown (higher = slower)')
            .addSlider(slider => slider
                .setLimits(10, 100, 10)
                .setValue(this.plugin.settings.maxResults)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxResults = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Index file content')
            .setDesc('Search inside file content (not just filenames). May slow down indexing.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.indexContent)
                .onChange(async (value) => {
                    this.plugin.settings.indexContent = value;
                    await this.plugin.saveSettings();
                    // Suggest rebuilding index
                    new Notice('💡 Consider rebuilding the index after changing this setting', 5000);
                }));

        // Interface Settings Section
        containerEl.createEl('h2', { text: 'Interface Settings' });

        new Setting(containerEl)
            .setName('Override Quick Switcher')
            .setDesc('Replace default Quick Switcher (Cmd/Ctrl+O) with Korean search')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.overrideQuickSwitcher)
                .onChange(async (value) => {
                    this.plugin.settings.overrideQuickSwitcher = value;
                    await this.plugin.saveSettings();
                    const restartMsg = containerEl.createDiv({
                        text: '⚠️ Please restart Obsidian for this change to take effect.',
                        cls: 'setting-item-description mod-warning'
                    });
                    setTimeout(() => restartMsg.remove(), 5000);
                }));

        new Setting(containerEl)
            .setName('Show file size')
            .setDesc('Display file size in search results')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showFileSize)
                .onChange(async (value) => {
                    this.plugin.settings.showFileSize = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show modified time')
            .setDesc('Display last modified time in search results')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showModifiedTime)
                .onChange(async (value) => {
                    this.plugin.settings.showModifiedTime = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show search score')
            .setDesc('Display relevance score in results (for debugging)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showScore)
                .onChange(async (value) => {
                    this.plugin.settings.showScore = value;
                    await this.plugin.saveSettings();
                }));

        // Performance Settings Section
        containerEl.createEl('h2', { text: 'Performance Settings' });

        new Setting(containerEl)
            .setName('Auto-rebuild index')
            .setDesc('Automatically update index when files are created, modified, or deleted')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoIndex)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoIndex = value;
                    await this.plugin.saveSettings();
                }));

        // Index Management Section
        containerEl.createEl('h2', { text: 'Index Management' });

        const indexStats = containerEl.createDiv({ cls: 'setting-item' });
        indexStats.createDiv({ 
            text: `📊 Currently indexed: ${this.plugin.index.getIndexedCount()} files`,
            cls: 'setting-item-name'
        });

        new Setting(containerEl)
            .setName('Rebuild search index')
            .setDesc('Manually rebuild the entire search index')
            .addButton(button => button
                .setButtonText('Rebuild Index')
                .setClass('mod-cta')
                .onClick(async () => {
                    button.setButtonText('Rebuilding...');
                    button.setDisabled(true);
                    try {
                        await this.plugin.index.build();
                        new Notice(`✅ Index rebuilt! (${this.plugin.index.getIndexedCount()} files)`, 3000);
                        // Update stats display
                        indexStats.querySelector('.setting-item-name')!.textContent = 
                            `📊 Currently indexed: ${this.plugin.index.getIndexedCount()} files`;
                    } catch (error) {
                        new Notice('❌ Failed to rebuild index - check console', 5000);
                        console.error('Failed to rebuild index:', error);
                    } finally {
                        button.setButtonText('Rebuild Index');
                        button.setDisabled(false);
                    }
                }));

        new Setting(containerEl)
            .setName('Clear search index')
            .setDesc('Remove all indexed data (will need to rebuild)')
            .addButton(button => button
                .setButtonText('Clear Index')
                .setClass('mod-warning')
                .onClick(() => {
                    this.plugin.index.clear();
                    new Notice('🗑️ Index cleared', 2000);
                    // Update stats display
                    indexStats.querySelector('.setting-item-name')!.textContent = 
                        `📊 Currently indexed: 0 files`;
                }));

        // Examples Section
        const examplesSetting = new Setting(containerEl)
            .setName('Korean Search Examples')
            .setDesc('Try these search patterns:');
        
        const examplesDiv = examplesSetting.settingEl.createDiv({
            cls: 'hangul-search-examples'
        });
        
        const list = examplesDiv.createEl('ul');
        list.createEl('li').innerHTML = '<strong>초성 검색:</strong> "ㅎㄱ" → finds "한글", "항공", "학교"';
        list.createEl('li').innerHTML = '<strong>부분 음절:</strong> "한ㄱ" → finds "한국", "한글"';
        list.createEl('li').innerHTML = '<strong>혼합 검색:</strong> "ㅎㄱㄹ교" → finds "한글학교"';
        list.createEl('li').innerHTML = '<strong>내용 검색:</strong> Searches file content too';
        list.createEl('li').innerHTML = '<strong>영어 검색:</strong> Regular English search also works';

        // Help Section
        containerEl.createEl('h2', { text: 'Keyboard Shortcuts' });
        const shortcutsDiv = containerEl.createDiv({ cls: 'hangul-search-examples' });
        const shortcutsList = shortcutsDiv.createEl('ul');
        shortcutsList.createEl('li').innerHTML = '<strong>Ctrl/Cmd + Shift + O:</strong> Open Korean Search';
        shortcutsList.createEl('li').innerHTML = '<strong>Ctrl/Cmd + O:</strong> Quick Switcher (if override enabled)';
        shortcutsList.createEl('li').innerHTML = '<strong>Ctrl + Enter:</strong> Open in new tab';
        shortcutsList.createEl('li').innerHTML = '<strong>Shift + Enter:</strong> Open in new pane';
    }
} 