import { Plugin, Notice, View, Editor, MarkdownView, TFile } from 'obsidian';
import { SampleModal } from './sampleModal';
import MyPlugin from '../main';
import { CustomRenderer } from './renderer'; // 이 줄을 추가합니다

export function addCommands(plugin: MyPlugin) {
    // 현재 뷰 타입 보기 명령어
    plugin.addCommand({
        id: 'show-current-view-type',
        name: '현재 뷰 타입 보기',
        callback: () => {
            const activeView = plugin.app.workspace.getActiveViewOfType(View);
            if (activeView) {
                const viewType = activeView.getViewType();
                new Notice(`현재 뷰 타입: ${viewType}`);
            } else {
                new Notice('활성화된 뷰가 없습니다.');
            }
        }
    });

    // 샘플 편집기 명령어
    plugin.addCommand({
        id: 'sample-editor-command',
        name: '샘플 편집기 명령',
        editorCallback: (editor: Editor, view: MarkdownView) => {
            console.log(editor.getSelection());
            editor.replaceSelection('샘플 편집기 명령');
        }
    });

    // 샘플 모달 열기 명령어
    plugin.addCommand({
        id: 'open-sample-modal-complex',
        name: '샘플 모달 열기 (복잡)',
        checkCallback: (checking: boolean) => {
            const markdownView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
            if (markdownView) {
                if (!checking) {
                    new SampleModal(plugin.app).open();
                }
                return true;
            }
        }
    });

    // 사용자 리스트 보기 명령어
    plugin.addCommand({
        id: 'show-user-list',
        name: '사용자 리스트 보기',
        callback: () => showUserList(plugin)
    });

    // 선택된 JSON 파일 정보 보기 명령어
    plugin.addCommand({
        id: 'show-selected-json-info',
        name: '선택된 JSON 파일 정보 보기',
        callback: () => showSelectedJsonInfo(plugin)
    });

    // 렌더링 새로고침 명령어 추가
    plugin.addCommand({
        id: 'refresh-custom-renderers',
        name: '커스텀 렌더러 새로고침',
        callback: () => refreshCustomRenderers(plugin)
    });
}

function showUserList(plugin: MyPlugin) {
    const userList = plugin.settings.userList;
    if (userList.length === 0) {
        new Notice('사용자 리스트가 비어있습니다.');
    } else {
        const userListString = userList.join(', ');
        new Notice(`사용자 리스트: ${userListString}`, 5000);
    }
}

function showSelectedJsonInfo(plugin: MyPlugin) {
    const filePath = plugin.settings.selectedJsonFile;
    if (!filePath) {
        new Notice('선택된 JSON 파일이 없습니다.');
        return;
    }

    const file = plugin.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
        const fileName = file.name;
        new Notice(`선택된 JSON 파일:\n파일명: ${fileName}\n경로: ${filePath}`, 5000);
    } else {
        new Notice('선택된 파일을 찾을 수 없습니다.');
    }
}

function refreshCustomRenderers(plugin: MyPlugin) {
    const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
        // 기존 프로세서 제거
        plugin.renderer.unregisterProcessors(plugin);

        // 새로운 렌더러 인스턴스 생성 및 프로세서 등록
        plugin.renderer = new CustomRenderer();
        plugin.renderer.registerProcessors(plugin);

        // 현재 뷰 새로고침
        activeView.previewMode.rerender(true);
        new Notice('커스텀 렌더러가 새로고침되었습니다.');
    } else {
        new Notice('활성화된 마크다운 뷰가 없습니다.');
    }
}