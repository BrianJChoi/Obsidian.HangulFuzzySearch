import { Editor, Plugin } from 'obsidian';

export class SelectionPopup {
    private popupEl: HTMLElement;

    constructor(private plugin: Plugin) {
        this.popupEl = document.createElement('div');
        this.popupEl.addClass('selection-popup');
        this.popupEl.style.position = 'fixed';
        this.popupEl.style.zIndex = '1000';
        this.popupEl.style.display = 'none';
        this.popupEl.setText('hi');
        document.body.appendChild(this.popupEl);

        this.plugin.registerDomEvent(document, 'selectionchange', this.handleSelectionChange.bind(this));
    }

    private handleSelectionChange() {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            this.showPopup(rect);
        } else {
            this.hidePopup();
        }
    }

    private showPopup(rect: DOMRect) {
        this.popupEl.style.top = `${rect.top - this.popupEl.offsetHeight}px`;
        this.popupEl.style.left = `${rect.right}px`;
        this.popupEl.style.display = 'block';
    }

    private hidePopup() {
        this.popupEl.style.display = 'none';
    }
}