import { Plugin, TFile } from 'obsidian';
import { HangulSearchSettings, DEFAULT_SETTINGS, HangulSearchSettingTab } from './src/settings';
import { HangulIndex } from './src/hangulIndex';
import { HangulSwitcher } from './src/hangulSwitcher';
import { HangulLinkSuggest } from './src/hangulLinkSuggest';
import { addCommands } from './src/commands';

export default class HangulSearchPlugin extends Plugin {
    settings!: HangulSearchSettings;
    index!: HangulIndex;

    async onload() {
        console.log('Loading Hangul Search Plugin...');

        try {
            // 1) 설정 로드
            await this.loadSettings();
            console.log('Settings loaded:', this.settings);

            // 2) 색인 빌드
            this.index = new HangulIndex(this);
            await this.index.build();
            console.log('Index built successfully');

            // 3) 볼트 이벤트 감시
            this.registerEvent(
                this.app.vault.on('rename', (file, oldPath) => {
                    if (file instanceof TFile) {
                        this.index.updateOnRename(file, oldPath);
                    }
                })
            );

            // 4) 명령어 추가
            addCommands(this);
            console.log('Commands added');

            // 5) 링크 자동완성 등록
            this.registerEditorSuggest(new HangulLinkSuggest(this.app, this.index));
            console.log('Link suggest registered');

            // 6) 설정 탭 추가
            this.addSettingTab(new HangulSearchSettingTab(this.app, this));
            console.log('Settings tab added');

            console.log('Hangul Search Plugin loaded successfully.');
        } catch (error) {
            console.error('Error loading Hangul Search Plugin:', error);
        }
    }

    onunload() {
        console.log('Unloading Hangul Search Plugin...');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
} 