import MyPlugin from '../main';
import { UserSuggest } from './userSuggest';

export class AutoComplete {
    private userSuggest: UserSuggest;

    constructor(private plugin: MyPlugin) {
        this.userSuggest = new UserSuggest(plugin);
        this.plugin.registerEditorSuggest(this.userSuggest);
    }

    // 여기에 다른 종류의 자동완성 기능을 추가할 수 있습니다.
    // 예: 
    // private tagSuggest: TagSuggest;
    // private linkSuggest: LinkSuggest;

    // initializeTagSuggest() {
    //     this.tagSuggest = new TagSuggest(this.plugin);
    //     this.plugin.registerEditorSuggest(this.tagSuggest);
    // }

    // initializeLinkSuggest() {
    //     this.linkSuggest = new LinkSuggest(this.plugin);
    //     this.plugin.registerEditorSuggest(this.linkSuggest);
    // }
}