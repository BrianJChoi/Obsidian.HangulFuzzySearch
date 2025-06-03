import { App, PluginSettingTab, Setting } from 'obsidian';
import type HangulSearchPlugin from '../main';

export interface HangulSearchSettings {
    fuzzyThreshold: number;       // 0 (엄격) ↔ 1 (느슨)
    overrideQuickSwitcher: boolean;
}

export const DEFAULT_SETTINGS: HangulSearchSettings = {
    fuzzyThreshold: 0.4,
    overrideQuickSwitcher: true,
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

        containerEl.createEl('h2', { text: 'Hangul Fuzzy Search Settings' });

        new Setting(containerEl)
            .setName('Fuzzy search threshold')
            .setDesc('Search sensitivity (0: exact match, 1: very loose match)')
            .addSlider(slider => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.fuzzyThreshold)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.fuzzyThreshold = value;
                    await this.plugin.saveSettings();
                    // 검색 엔진 재구성
                    this.plugin.index.updateThreshold(value);
                }));

        new Setting(containerEl)
            .setName('Override Quick Switcher')
            .setDesc('Replace default Quick Switcher (Cmd/Ctrl+O) with Hangul search')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.overrideQuickSwitcher)
                .onChange(async (value) => {
                    this.plugin.settings.overrideQuickSwitcher = value;
                    await this.plugin.saveSettings();
                    // 플러그인 재시작 알림
                    this.containerEl.createEl('div', {
                        text: 'Please restart the plugin for this change to take effect.',
                        cls: 'setting-item-description'
                    });
                }));

        // 검색 예시 섹션
        const exampleSetting = new Setting(containerEl)
            .setName('Search examples')
            .setDesc('Try these search patterns:');
        
        const exampleDiv = exampleSetting.settingEl.createDiv({
            cls: 'hangul-search-examples'
        });
        
        const list = exampleDiv.createEl('ul');
        list.createEl('li').innerHTML = '<strong>초성:</strong> "ㅎㄱ" → "한글", "항공", "학교"';
        list.createEl('li').innerHTML = '<strong>부분 음절:</strong> "한ㄱ" → "한국", "한글"';
        list.createEl('li').innerHTML = '<strong>혼합:</strong> "ㅎㄱㄹ교" → "한글학교"';
    }
} 