import { MarkdownPostProcessorContext } from 'obsidian';
import { Plugin } from 'obsidian';

export class CustomRenderer {
    private processors: Map<string, (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void>;
    private registeredProcessors: string[];

    constructor() {
        this.processors = new Map();
        this.registeredProcessors = [];
        this.initializeProcessors();
    }

    private initializeProcessors() {
        this.processors.set("abcto123", this.abcto123Processor.bind(this));
        this.processors.set("calculator", this.calculatorProcessor.bind(this));
        // 여기에 더 많은 프로세서를 추가할 수 있습니다.
    }

    public getProcessor(lang: string) {
        return this.processors.get(lang);
    }

    private abcto123Processor(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
        const transformedContent = this.transformContent(source);
        el.createEl("pre").createEl("code", { text: transformedContent });
    }

    private calculatorProcessor(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
        try {
            const result = Function('"use strict";return (' + source + ')')();
            const container = el.createDiv();
            container.createEl("div", { text: `계산식: ${source}` });
            container.createEl("div", { text: `결과: ${result}` });
        } catch (error) {
            const container = el.createDiv();
            container.createEl("div", { text: `계산식: ${source}` });
            container.createEl("div", { text: `오류: 유효하지 않은 수식입니다.`, cls: 'error' });
        }
    }

    private transformContent(source: string): string {
        return source.replace(/a/g, '1')
                     .replace(/b/g, '2')
                     .replace(/c/g, '3');
    }

    getSupportedLanguages(): string[] {
        return Array.from(this.processors.keys());
    }

    public registerProcessors(plugin: Plugin) {
        for (const lang of this.getSupportedLanguages()) {
            plugin.registerMarkdownCodeBlockProcessor(lang, (source, el, ctx) => {
                const processor = this.getProcessor(lang);
                if (processor) {
                    processor(source, el, ctx);
                }
            });
            this.registeredProcessors.push(lang);
        }
    }

    public unregisterProcessors(plugin: Plugin) {
        // Obsidian handles cleanup automatically
        this.registeredProcessors = [];
    }
}