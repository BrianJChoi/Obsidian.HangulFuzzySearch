import { App, PluginSettingTab, Setting, TFile } from 'obsidian';
import MyPlugin from '../main';

export interface MyPluginSettings {
    mySetting: string;
    userList: string[];
    selectedJsonFile: string; // 새로운 설정 항목
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
    mySetting: '',
    userList: ['John', 'Jane', 'Alice'],
    selectedJsonFile: '' // 기본값은 빈 문자열
}

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('설정 #1')
			.setDesc('비밀입니다')
			.addText(text => text
				.setPlaceholder('비밀을 입력하세요')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h2', {text: '사용자 목록 설정'});

		new Setting(containerEl)
			.setName('사용자 추가')
			.setDesc('새로운 사용자를 목록에 추가합니다.')
			.addButton(btn => btn
				.setButtonText('+')
				.setCta()
				.onClick(() => {
					this.plugin.settings.userList.push('');
					this.plugin.saveSettings();
					this.display(); // 설정 화면을 다시 그립니다.
				}));

		this.plugin.settings.userList.forEach((user, index) => {
			new Setting(containerEl)
				.setName(`사용자 ${index + 1}`)
				.addText(text => text
					.setValue(user)
					.onChange(async (value) => {
						this.plugin.settings.userList[index] = value;
						await this.plugin.saveSettings();
					}))
				.addButton(btn => btn
					.setIcon('trash')
					.onClick(async () => {
						this.plugin.settings.userList.splice(index, 1);
						await this.plugin.saveSettings();
						this.display(); // 설정 화면을 다시 그립니다.
					}));
		});

		// JSON 파일 선택 드롭다운 추가
		new Setting(containerEl)
			.setName('JSON 파일 선택')
			.setDesc('Vault 내의 JSON 파일을 선택하세요.')
			.addDropdown(dropdown => {
				// 모든 JSON 파일 목록을 가져옵니다.
				const jsonFiles = this.app.vault.getFiles().filter(file => file.extension === 'json');
				
				// 드롭다운에 옵션을 추가합니다.
				dropdown.addOption('', '선택하세요');
				jsonFiles.forEach(file => {
					dropdown.addOption(file.path, file.name);
				});

				// 현재 선택된 값을 설정합니다.
				dropdown.setValue(this.plugin.settings.selectedJsonFile);

				// 변경 이벤트를 처리합니다.
				dropdown.onChange(async (value) => {
					this.plugin.settings.selectedJsonFile = value;
					await this.plugin.saveSettings();
				});
			});
	}
}