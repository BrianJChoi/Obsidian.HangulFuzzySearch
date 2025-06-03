import { TFile } from 'obsidian';
import Fuse from 'fuse.js';
import Hangul from 'hangul-js';
import type HangulSearchPlugin from '../main';

export interface IndexEntry {
    display: string;   // File name for display
    jamo: string;      // Decomposed Korean characters  
    path: string;      // File path
    content: string;   // File content for searching
    contentJamo: string; // Decomposed content
    score: number;     // Search relevance score
    size: number;      // File size
    mtime: number;     // Modified time
}

export class HangulIndex {
    private entries: IndexEntry[] = [];
    private fuse!: Fuse<IndexEntry>;
    private indexMap: Map<string, IndexEntry> = new Map();
    private defaultThreshold = 0.4;

    constructor(private plugin: HangulSearchPlugin) {}

    /** Build initial index from all vault files */
    async build() {
        console.log('🔍 Building Korean search index...');
        const files = this.plugin.app.vault.getMarkdownFiles();
        
        this.entries = [];
        this.indexMap.clear();
        
        let indexed = 0;
        for (const file of files) {
            try {
                await this.addFile(file);
                indexed++;
            } catch (error) {
                console.warn(`Failed to index ${file.path}:`, error);
            }
        }
        
        this.rebuildFuse();
        console.log(`✅ Indexed ${indexed} files with Korean search support`);
    }

    /** Add a single file to the index */
    async addFile(file: TFile): Promise<void> {
        if (!file || file.extension !== 'md') return;
        
        try {
            const content = await this.plugin.app.vault.cachedRead(file);
            const entry = await this.createEntry(file, content);
            
            // Remove existing entry if it exists
            if (this.indexMap.has(file.path)) {
                this.removeFile(file);
            }
            
            this.entries.push(entry);
            this.indexMap.set(file.path, entry);
            this.rebuildFuse();
            
        } catch (error) {
            console.warn(`Failed to add file ${file.path}:`, error);
        }
    }

    /** Remove a file from the index */
    removeFile(file: TFile): void {
        const existingEntry = this.indexMap.get(file.path);
        if (!existingEntry) return;
        
        const index = this.entries.indexOf(existingEntry);
        if (index > -1) {
            this.entries.splice(index, 1);
            this.indexMap.delete(file.path);
            this.rebuildFuse();
        }
    }

    /** Update a file in the index */
    async updateFile(file: TFile): Promise<void> {
        if (!file || file.extension !== 'md') return;
        
        this.removeFile(file);
        await this.addFile(file);
    }

    /** Handle file rename */
    updateOnRename(file: TFile, oldPath: string): void {
        const existingEntry = this.indexMap.get(oldPath);
        if (existingEntry) {
            // Remove old entry
            this.removeFile({ path: oldPath } as TFile);
            // Add new entry
            this.addFile(file);
        }
    }

    /** Search with Korean support */
    search(query: string, limit: number = 50): IndexEntry[] {
        if (!query.trim()) return [];
        
        console.log(`🔍 Searching for: "${query}"`);
        
        // Decompose Korean characters for better matching
        const jamo = Hangul.disassemble(query).join('');
        console.log(`🔍 Decomposed query: "${jamo}"`);
        
        if (!this.fuse) {
            console.warn('⚠️ Search index not ready, rebuilding...');
            this.rebuildFuse();
        }
        
        // Search both original and decomposed text
        const results = this.fuse.search(jamo, { limit });
        console.log(`🔍 Found ${results.length} results for "${query}"`);
        
        return results
            .map(result => ({
                ...result.item,
                score: this.calculateRelevanceScore(result.item, query, result.score || 0)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /** Update search threshold */
    updateThreshold(threshold: number) {
        try {
            if (this.plugin.settings) {
                this.plugin.settings.fuzzyThreshold = threshold;
            }
            this.rebuildFuse();
        } catch (error) {
            console.warn('Could not update plugin settings, using default threshold');
            this.rebuildFuse();
        }
    }

    /** Get total number of indexed files */
    getIndexedCount(): number {
        return this.entries.length;
    }

    /** Clear entire index */
    clear(): void {
        this.entries = [];
        this.indexMap.clear();
        this.rebuildFuse();
    }

    /* ---------- Private methods ---------- */

    private async createEntry(file: TFile, content: string): Promise<IndexEntry> {
        const display = file.basename;
        const path = file.path;
        
        // Extract first few lines for preview
        const preview = content.split('\n').slice(0, 3).join(' ').substring(0, 200);
        
        // Decompose Korean text for better searching
        const jamo = Hangul.disassemble(display).join('');
        const contentJamo = Hangul.disassemble(content).join('');
        
        return {
            display,
            jamo,
            path,
            content: preview,
            contentJamo,
            score: 0,
            size: content.length,
            mtime: file.stat.mtime
        };
    }

    private calculateRelevanceScore(entry: IndexEntry, query: string, fuseScore: number): number {
        let score = 1 - fuseScore; // Higher is better
        
        const queryLower = query.toLowerCase();
        const displayLower = entry.display.toLowerCase();
        
        // Boost exact filename matches
        if (displayLower === queryLower) {
            score += 10;
        } else if (displayLower.includes(queryLower)) {
            score += 5;
        }
        
        // Boost files with query in content
        if (entry.content.toLowerCase().includes(queryLower)) {
            score += 2;
        }
        
        // Boost recently modified files
        const daysSinceModified = (Date.now() - entry.mtime) / (1000 * 60 * 60 * 24);
        if (daysSinceModified < 7) {
            score += 1;
        }
        
        // Boost smaller files (often more focused)
        if (entry.size < 1000) {
            score += 0.5;
        }
        
        return score;
    }

    private rebuildFuse() {
        try {
            const threshold = this.plugin.settings?.fuzzyThreshold || this.defaultThreshold;
            
            this.fuse = new Fuse(this.entries, {
                threshold: threshold,
                keys: [
                    { name: 'jamo', weight: 0.4 },
                    { name: 'display', weight: 0.3 },
                    { name: 'contentJamo', weight: 0.2 },
                    { name: 'content', weight: 0.1 }
                ],
                includeScore: true,
                minMatchCharLength: 1,
                ignoreLocation: true
            });
            
            console.log(`🔧 Fuse.js index rebuilt with threshold: ${threshold}`);
        } catch (error) {
            console.error('❌ Failed to rebuild Fuse index:', error);
        }
    }
} 