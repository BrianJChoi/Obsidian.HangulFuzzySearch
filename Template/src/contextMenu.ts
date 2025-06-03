import { Menu, TAbstractFile, TFile, Notice, Editor, MarkdownView } from 'obsidian';
import MyPlugin from '../main';

export class ContextMenu {
    constructor(private plugin: MyPlugin) {
        this.addFileMenuItems();
        // 다른 컨텍스트 메뉴 이벤트를 여기에 추가할 수 있습니다.
    }

    private addFileMenuItems() {
        // 파일 메뉴 (파일 탐색기에서 파일 우클릭)
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
                if (file instanceof TFile && file.extension === 'md') {
                    menu.addItem((item) => {
                        item.setTitle('파일 정보 보기')
                            .setIcon('info')
                            .onClick(() => this.showFileInfo(file));
                    });
                }
            })
        );

        // 에디터 메뉴 (에디터 내에서 우클릭)
        // this.plugin.registerEvent(
        //     this.plugin.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
        //         menu.addItem((item) => {
        //             item.setTitle('선택된 텍스트 정보')
        //                 .setIcon('info')
        //                 .onClick(() => {
        //                     const selectedText = editor.getSelection();
        //                     new Notice(`선택된 텍스트 길이: ${selectedText.length}`);
        //                 });
        //         });
        //     })
        // );

        // 페이지 헤더 메뉴 (페이지 상단의 점 세 개 메뉴)
        // this.plugin.registerEvent(
        //     this.plugin.app.workspace.on('page-menu', (menu: Menu, view: MarkdownView) => {
        //         menu.addItem((item) => {
        //             item.setTitle('현재 페이지 단어 수')
        //                 .setIcon('info')
        //                 .onClick(() => {
        //                     const wordCount = view.data.split(/\s+/).length;
        //                     new Notice(`현재 페이지 단어 수: ${wordCount}`);
        //                 });
        //         });
        //     })
        // );

        // 노트 제목 메뉴 (파일 탐색기에서 노트 제목 우클릭)
        // this.plugin.registerEvent(
        //     this.plugin.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
        //         if (file instanceof TFile) {
        //             menu.addItem((item) => {
        //                 item.setTitle('파일 이름 길이')
        //                     .setIcon('info')
        //                     .onClick(() => {
        //                         new Notice(`파일 이름 길이: ${file.basename.length}`);
        //                     });
        //             });
        //         }
        //     })
        // );
    }

    private showFileInfo(file: TFile) {
        const fileInfo = `파일명: ${file.name}
경로: ${file.path}
크기: ${file.stat.size} bytes
생성일: ${new Date(file.stat.ctime).toLocaleString()}
수정일: ${new Date(file.stat.mtime).toLocaleString()}`;

        new Notice(fileInfo, 10000);  // 10초 동안 표시
    }
}