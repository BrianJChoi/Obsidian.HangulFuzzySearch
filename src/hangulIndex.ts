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
    private defaultThreshold = 0.6; // More lenient for Korean search

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
        
        // Handle different types of Korean search patterns
        const searchResults = this.performKoreanSearch(query);
        console.log(`🔍 Found ${searchResults.length} results for "${query}"`);
        
        return searchResults
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /** Perform Korean-aware search with multiple strategies */
    private performKoreanSearch(query: string): IndexEntry[] {
        const results = new Map<string, IndexEntry>();
        
        // Strategy 1: Direct text search (for regular text)
        this.searchByStrategy(query, results, 'direct');
        
        // Strategy 2: Decomposed search (for Korean characters)
        const decomposed = this.decomposeKoreanText(query);
        if (decomposed !== query) {
            console.log(`🔍 Decomposed query: "${query}" → "${decomposed}"`);
            this.searchByStrategy(decomposed, results, 'decomposed');
        }
        
        // Strategy 3: Initial consonant search (초성 검색)
        if (this.isInitialConsonantQuery(query)) {
            console.log(`🔍 Initial consonant search for: "${query}"`);
            this.searchByInitialConsonants(query, results);
        }
        
        // Strategy 4: Partial syllable search (부분 음절)
        if (this.isPartialSyllableQuery(query)) {
            console.log(`🔍 Partial syllable search for: "${query}"`);
            this.searchByPartialSyllables(query, results);
        }
        
        return Array.from(results.values());
    }

    private searchByStrategy(searchTerm: string, results: Map<string, IndexEntry>, strategy: string): void {
        if (!this.fuse) {
            console.warn('⚠️ Search index not ready, rebuilding...');
            this.rebuildFuse();
        }
        
        const fuseResults = this.fuse.search(searchTerm, { limit: 50 });
        console.log(`📊 Strategy "${strategy}" found ${fuseResults.length} results for "${searchTerm}"`);
        
        fuseResults.forEach(result => {
            const item = result.item;
            const score = this.calculateRelevanceScore(item, searchTerm, result.score || 0, strategy);
            
            if (!results.has(item.path) || results.get(item.path)!.score < score) {
                results.set(item.path, { ...item, score });
            }
        });
    }

    private searchByInitialConsonants(query: string, results: Map<string, IndexEntry>): void {
        // For each entry, check if its initial consonants match the query
        this.entries.forEach(entry => {
            const entryInitials = this.extractInitialConsonants(entry.display);
            if (entryInitials.includes(query)) {
                const score = this.calculateRelevanceScore(entry, query, 0.3, 'initial-consonant');
                if (!results.has(entry.path) || results.get(entry.path)!.score < score) {
                    results.set(entry.path, { ...entry, score });
                }
            }
        });
    }

    private searchByPartialSyllables(query: string, results: Map<string, IndexEntry>): void {
        // For partial syllable search like "한ㄱ"
        this.entries.forEach(entry => {
            if (this.matchesPartialSyllable(entry.display, query)) {
                const score = this.calculateRelevanceScore(entry, query, 0.2, 'partial-syllable');
                if (!results.has(entry.path) || results.get(entry.path)!.score < score) {
                    results.set(entry.path, { ...entry, score });
                }
            }
        });
    }

    /** Check if query is initial consonants only (like ㅎㄱ) */
    private isInitialConsonantQuery(query: string): boolean {
        const koreanConsonants = /^[ㄱ-ㅎ]+$/;
        return koreanConsonants.test(query);
    }

    /** Check if query contains partial syllables (like 한ㄱ) */
    private isPartialSyllableQuery(query: string): boolean {
        // Contains mix of complete syllables and consonants
        const hasComplete = /[가-힣]/.test(query);
        const hasConsonants = /[ㄱ-ㅎ]/.test(query);
        return hasComplete && hasConsonants;
    }

    /** Extract initial consonants from Korean text */
    private extractInitialConsonants(text: string): string {
        return text.split('').map(char => {
            if (/[가-힣]/.test(char)) {
                const decomposed = Hangul.disassemble(char);
                return decomposed[0] || char; // Return first consonant
            }
            return char;
        }).join('');
    }

    /** Check if text matches partial syllable pattern */
    private matchesPartialSyllable(text: string, pattern: string): boolean {
        // Simple implementation: check if decomposed text contains pattern
        const decomposedText = this.decomposeKoreanText(text);
        const decomposedPattern = this.decomposeKoreanText(pattern);
        return decomposedText.includes(decomposedPattern);
    }

    /** Decompose Korean text for better searching */
    private decomposeKoreanText(text: string): string {
        try {
            return Hangul.disassemble(text).join('');
        } catch (error) {
            console.warn('Failed to decompose Korean text:', text, error);
            return text;
        }
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
        const jamo = this.decomposeKoreanText(display);
        const contentJamo = this.decomposeKoreanText(content);
        
        console.log(`📝 Indexing: "${display}" → decomposed: "${jamo}"`);
        
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

    private calculateRelevanceScore(entry: IndexEntry, query: string, fuseScore: number, strategy: string): number {
        let score = 1 - fuseScore; // Higher is better
        
        // Boost based on strategy
        switch (strategy) {
            case 'direct':
                score += 5; // Prefer direct matches
                break;
            case 'initial-consonant':
                score += 3; // Good for 초성 search
                break;
            case 'partial-syllable':
                score += 2; // Good for partial matches
                break;
            case 'decomposed':
                score += 1; // Fallback
                break;
        }
        
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
                ignoreLocation: true,
                includeMatches: false
            });
            
            console.log(`🔧 Fuse.js index rebuilt with threshold: ${threshold}, entries: ${this.entries.length}`);
        } catch (error) {
            console.error('❌ Failed to rebuild Fuse index:', error);
        }
    }
} 