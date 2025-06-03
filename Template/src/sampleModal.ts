import { App, Modal } from 'obsidian';

export class SampleModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.setText('와우!');
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}