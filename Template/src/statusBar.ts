import { Plugin, View } from 'obsidian';

export class StatusBar {
    private statusBarItem: HTMLElement;

    constructor(private plugin: Plugin) {
        this.statusBarItem = this.plugin.addStatusBarItem();
        this.registerEvent();
    }

    private registerEvent() {
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('active-leaf-change', () => {
                const activeView = this.plugin.app.workspace.getActiveViewOfType(View);
                if (activeView) {
                    this.statusBarItem.setText(`Current View: ${activeView.getViewType()}`);
                } else {
                    this.statusBarItem.setText('Current View: None');
                }
            })
        );
    }
}