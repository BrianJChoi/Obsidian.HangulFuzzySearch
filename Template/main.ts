import { Plugin, TFile } from 'obsidian';
import { SampleSettingTab, MyPluginSettings, DEFAULT_SETTINGS } from './src/settings';
import { StatusBar } from './src/statusBar';
import { Ribbon } from './src/ribbon';
import { SelectionPopup } from './src/selectionPopup';
import { CustomRenderer } from './src/renderer';
import { ContextMenu } from './src/contextMenu';
import { AutoComplete } from './src/autoComplete';
import { addCommands } from './src/commands';

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	statusBar: StatusBar;
	ribbon: Ribbon;
	private selectionPopup: SelectionPopup;
	public renderer: CustomRenderer;
	private contextMenu: ContextMenu;
	private autoComplete: AutoComplete;

	async onload() {
		await this.loadSettings();

		// 상태바 초기화
		this.statusBar = new StatusBar(this);

		// 리본 아이콘 추가
		this.ribbon = new Ribbon(this);

		// 명령어 추가
		addCommands(this);

		// 설정 탭 추가
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// 클릭 이벤트 리스너 (필요 없다면 주석 처리)
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		//     console.log('클릭', evt);
		// });

		// 커스텀 렌더러 초기화
		this.renderer = new CustomRenderer();
		this.renderer.registerProcessors(this);

		// 주기적인 작업 (필요 없다면 주석 처리)
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		// 선택 팝업 초기화
		this.selectionPopup = new SelectionPopup(this);
		
		// 컨텍스트 메뉴 초기화
		this.contextMenu = new ContextMenu(this);

		// 자동완성 초기화
		this.autoComplete = new AutoComplete(this);
	}

	onunload() {
		this.renderer.unregisterProcessors(this);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
