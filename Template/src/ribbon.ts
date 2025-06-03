import { Plugin, Notice } from 'obsidian';

export class Ribbon {
    constructor(private plugin: Plugin) {
        this.addRibbonIcon();
    }

    private addRibbonIcon() {
        const ribbonIconEl = this.plugin.addRibbonIcon('dice', '샘플 플러그인', (evt: MouseEvent) => {
            new Notice('이것은 알림입니다!');
        });
        ribbonIconEl.addClass('my-plugin-ribbon-class');
    }
}