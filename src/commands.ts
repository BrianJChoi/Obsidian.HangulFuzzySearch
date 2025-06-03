import { Notice } from 'obsidian';
import type HangulSearchPlugin from '../main';
import { HangulSwitcher } from './hangulSwitcher';

export function addCommands(plugin: HangulSearchPlugin) {
    // 한글 Quick Switcher 명령어
    plugin.addCommand({
        id: 'hangul-quick-switcher',
        name: 'Open Hangul Quick Switcher',
        callback: () => {
            new HangulSwitcher(plugin.app, plugin.index).open();
        }
    });

    // 기본 Quick Switcher 대체 (설정에 따라)
    if (plugin.settings.overrideQuickSwitcher) {
        plugin.addCommand({
            id: 'hangul-override-quick-switcher',
            name: 'Hangul Quick Switcher (Override)',
            hotkeys: [{ modifiers: ['Mod'], key: 'o' }], // ⌘O / Ctrl+O
            callback: () => {
                new HangulSwitcher(plugin.app, plugin.index).open();
            }
        });
    }

    // 인덱스 재구성 명령어
    plugin.addCommand({
        id: 'hangul-rebuild-index',
        name: 'Rebuild Hangul Search Index',
        callback: async () => {
            await plugin.index.build();
            // 알림 표시
            new Notice('Hangul search index rebuilt!', 3000);
        }
    });

    // 설정 열기 명령어 (간소화)
    plugin.addCommand({
        id: 'hangul-open-settings',
        name: 'Open Hangul Search Settings',
        callback: () => {
            new Notice('Go to Settings → Community plugins → Hangul Fuzzy Search', 5000);
        }
    });
} 