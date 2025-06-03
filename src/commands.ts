import { Notice } from 'obsidian';
import type HangulSearchPlugin from '../main';
import { HangulSwitcher } from './hangulSwitcher';

export function addCommands(plugin: HangulSearchPlugin) {
    // Main Korean search command (replaces Omnisearch)
    plugin.addCommand({
        id: 'korean-search',
        name: 'Korean Search (Omnisearch replacement)',
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'o' }],
        callback: () => {
            new HangulSwitcher(plugin.app, plugin.index).open();
        }
    });

    // Korean Quick Switcher (enhanced version)
    plugin.addCommand({
        id: 'hangul-quick-switcher',
        name: 'Open Korean Quick Switcher',
        callback: () => {
            new HangulSwitcher(plugin.app, plugin.index).open();
        }
    });

    // Override default Quick Switcher if enabled
    if (plugin.settings.overrideQuickSwitcher) {
        plugin.addCommand({
            id: 'hangul-override-quick-switcher',
            name: 'Korean Quick Switcher (Override Default)',
            hotkeys: [{ modifiers: ['Mod'], key: 'o' }],
            callback: () => {
                new HangulSwitcher(plugin.app, plugin.index).open();
            }
        });
    }

    // Index management commands
    plugin.addCommand({
        id: 'hangul-rebuild-index',
        name: 'Rebuild Korean Search Index',
        callback: async () => {
            const notice = new Notice('🔄 Rebuilding Korean search index...', 0);
            try {
                await plugin.index.build();
                notice.hide();
                new Notice(`✅ Korean search index rebuilt! (${plugin.index.getIndexedCount()} files)`, 3000);
            } catch (error) {
                notice.hide();
                new Notice('❌ Failed to rebuild index - check console', 5000);
                console.error('Failed to rebuild Korean search index:', error);
            }
        }
    });

    plugin.addCommand({
        id: 'hangul-clear-index',
        name: 'Clear Korean Search Index',
        callback: () => {
            plugin.index.clear();
            new Notice('🗑️ Korean search index cleared', 2000);
        }
    });

    // Statistics command
    plugin.addCommand({
        id: 'hangul-search-stats',
        name: 'Show Korean Search Statistics',
        callback: () => {
            const count = plugin.index.getIndexedCount();
            const message = `📊 Korean Search Statistics:
• Indexed files: ${count}
• Fuzzy threshold: ${plugin.settings.fuzzyThreshold}
• Override Quick Switcher: ${plugin.settings.overrideQuickSwitcher ? 'Yes' : 'No'}`;
            
            new Notice(message, 5000);
        }
    });

    // Quick actions for search
    plugin.addCommand({
        id: 'hangul-search-current-file',
        name: 'Search in Current File (Korean)',
        checkCallback: (checking: boolean) => {
            const activeFile = plugin.app.workspace.getActiveFile();
            if (activeFile) {
                if (!checking) {
                    // TODO: Implement in-file search
                    new Notice('🔍 In-file Korean search coming soon!', 3000);
                }
                return true;
            }
            return false;
        }
    });

    // Settings shortcut
    plugin.addCommand({
        id: 'hangul-open-settings',
        name: 'Open Korean Search Settings',
        callback: () => {
            // @ts-ignore - accessing private method
            plugin.app.setting.open();
            // @ts-ignore - accessing private method  
            plugin.app.setting.openTabById(plugin.manifest.id);
        }
    });

    // Help command
    plugin.addCommand({
        id: 'hangul-help',
        name: 'Korean Search Help',
        callback: () => {
            const helpMessage = `🔍 Korean Search Help:

Search Features:
• 초성 search: "ㅎㄱ" → finds "한글", "항공"
• 부분 음절: "한ㄱ" → finds "한국", "한글"  
• 혼합 search: "ㅎㄱㄹ교" → finds "한글학교"
• Content search: searches file content too

Hotkeys:
• Ctrl/Cmd + Shift + O: Open Korean Search
• Ctrl/Cmd + O: Quick Switcher (if override enabled)

Tips:
• Use Ctrl+Enter to open in new tab
• Use Shift+Enter to open in new pane
• Recent files shown when search is empty`;

            new Notice(helpMessage, 10000);
        }
    });
} 