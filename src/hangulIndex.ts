import { TFile } from 'obsidian';
import Fuse from 'fuse.js';
import Hangul from 'hangul-js';
import type HangulSearchPlugin from '../main';

export interface IndexEntry {
    display: string;   // File name for display
    jamo: string;      // Decomposed Korean characters  
    path: string;      // File path
    content?: string;   // File content for searching (loaded on-demand)
    contentJamo?: string; // Decomposed content (loaded on-demand)
    score: number;     // Search relevance score
    size: number;      // File size
    mtime: number;     // Modified time
    contentLoaded: boolean; // Track if content is loaded
}

export class HangulIndex {
    private entries: IndexEntry[] = [];
    private fuse!: Fuse<IndexEntry>;
    private indexMap: Map<string, IndexEntry> = new Map();
    private defaultThreshold = 0.6; // More lenient for Korean search
    private contentCache: Map<string, {content: string, contentJamo: string}> = new Map();

    constructor(private plugin: HangulSearchPlugin) {}

    /** Fast initial build - only file names and metadata */
    async build() {
        console.log('🔍 Building Korean Omnisearch index (fast mode)...');
        const files = this.plugin.app.vault.getMarkdownFiles();
        
        this.entries = [];
        this.indexMap.clear();
        this.contentCache.clear();
        
        let indexed = 0;
        for (const file of files) {
            try {
                await this.addFileMetadata(file);
                indexed++;
            } catch (error) {
                console.warn(`Failed to index metadata for ${file.path}:`, error);
            }
        }
        
        this.rebuildFuse();
        console.log(`✅ Korean Omnisearch index completed: ${indexed} files (fast mode)`);
    }

    /** Add only file metadata - no content reading */
    async addFileMetadata(file: TFile): Promise<void> {
        if (!file || file.extension !== 'md') return;
        
        try {
            const entry = this.createMetadataEntry(file);
            
            // Remove existing entry if it exists
            if (this.indexMap.has(file.path)) {
                this.removeFile(file, true);
            }
            
            this.entries.push(entry);
            this.indexMap.set(file.path, entry);
            
        } catch (error) {
            console.warn(`Failed to add metadata for ${file.path}:`, error);
        }
    }

    /** Create entry with only metadata - no content reading */
    private createMetadataEntry(file: TFile): IndexEntry {
        const display = file.basename;
        const path = file.path;
        
        // Decompose Korean text for filename only
        const jamo = this.decomposeKoreanText(display);
        
        // Debug logging to see what's being indexed
        if (display.includes('한') || display.includes('ㅎ')) {
            console.log(`📝 Indexing Korean file: "${display}" → jamo: "${jamo}"`);
        }
        
        return {
            display,
            jamo,
            path,
            content: '', // Empty initially
            contentJamo: '', // Empty initially
            score: 0,
            size: file.stat.size,
            mtime: file.stat.mtime,
            contentLoaded: false
        };
    }

    /** Load content on-demand for better search results */
    private async loadFileContent(entry: IndexEntry): Promise<void> {
        if (entry.contentLoaded) return;
        
        try {
            // Check cache first
            const cached = this.contentCache.get(entry.path);
            if (cached) {
                entry.content = cached.content;
                entry.contentJamo = cached.contentJamo;
                entry.contentLoaded = true;
                return;
            }
            
            // Load content from vault
            const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
            if (file instanceof TFile) {
                const content = await this.plugin.app.vault.cachedRead(file);
                // Only take first 500 characters for performance
                const preview = content.substring(0, 500);
                const contentJamo = this.decomposeKoreanText(preview);
                
                // Cache it
                this.contentCache.set(entry.path, { content: preview, contentJamo });
                
                entry.content = preview;
                entry.contentJamo = contentJamo;
                entry.contentLoaded = true;
            }
        } catch (error) {
            console.warn(`Failed to load content for ${entry.path}:`, error);
            entry.contentLoaded = true; // Mark as loaded to avoid retry
        }
    }

    /** Add a single file to the index */
    async addFile(file: TFile, skipFuseRebuild: boolean = false): Promise<void> {
        // Use fast metadata-only approach
        await this.addFileMetadata(file);
        
        // Only rebuild Fuse if not in batch mode
        if (!skipFuseRebuild) {
            this.rebuildFuse();
        }
    }

    /** Remove a file from the index */
    removeFile(file: TFile, skipFuseRebuild: boolean = false): void {
        const existingEntry = this.indexMap.get(file.path);
        if (!existingEntry) return;
        
        const index = this.entries.indexOf(existingEntry);
        if (index > -1) {
            this.entries.splice(index, 1);
            this.indexMap.delete(file.path);
            
            // Only rebuild Fuse if not in batch mode
            if (!skipFuseRebuild) {
                this.rebuildFuse();
            }
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
        
        console.log(`🔍 Searching: "${query}"`);
        console.log(`📊 Index has ${this.entries.length} entries`);
        
        // Debug: show some sample entries
        if (this.entries.length > 0) {
            const sampleEntry = this.entries[0];
            console.log(`📝 Sample entry: "${sampleEntry.display}" → jamo: "${sampleEntry.jamo}"`);
        }
        
        // Handle different types of Korean search patterns
        const searchResults = this.performKoreanSearch(query);
        console.log(`📊 Found ${searchResults.length} results`);
        
        // For top results, load content if needed for better scoring
        const topResults = searchResults
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.min(limit * 2, 100)); // Get more for refinement
            
        // Load content for top results asynchronously (don't wait)
        this.loadContentForTopResults(topResults.slice(0, 20));
        
        return topResults.slice(0, limit);
    }

    /** Load content for top results in background */
    private async loadContentForTopResults(results: IndexEntry[]): Promise<void> {
        // Load content in small batches to avoid blocking
        const batchSize = 5;
        for (let i = 0; i < results.length; i += batchSize) {
            const batch = results.slice(i, i + batchSize);
            await Promise.all(batch.map(entry => this.loadFileContent(entry)));
            
            // Small delay between batches
            if (i + batchSize < results.length) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }
    }

    /** Perform Korean-aware search with multiple strategies */
    private performKoreanSearch(query: string): IndexEntry[] {
        const results = new Map<string, IndexEntry>();
        
        // Strategy 1: Direct text search (for regular text)
        this.searchByStrategy(query, results, 'direct');
        
        // Strategy 2: Decomposed search (for Korean characters)
        const decomposed = this.decomposeKoreanText(query);
        if (decomposed !== query) {
            console.log(`🔍 Using decomposed search: "${decomposed}"`);
            this.searchByStrategy(decomposed, results, 'decomposed');
        }
        
        // Strategy 3: Initial consonant search (초성 검색)
        if (this.isInitialConsonantQuery(query)) {
            console.log(`🔍 Initial consonant search: "${query}"`);
            this.searchByInitialConsonants(query, results);
        }
        
        // Strategy 4: Partial syllable search (부분 음절)
        if (this.isPartialSyllableQuery(query)) {
            console.log(`🔍 Partial syllable search: "${query}"`);
            this.searchByPartialSyllables(query, results);
        }
        
        return Array.from(results.values());
    }

    private searchByStrategy(searchTerm: string, results: Map<string, IndexEntry>, strategy: string): void {
        if (!this.fuse) {
            console.warn('⚠️ Search index not ready, rebuilding...');
            this.rebuildFuse();
        }
        
        console.log(`🔍 Fuse search for "${searchTerm}" (strategy: ${strategy})`);
        const fuseResults = this.fuse.search(searchTerm, { limit: 50 });
        console.log(`📊 Fuse returned ${fuseResults.length} results for "${searchTerm}"`);
        
        if (fuseResults.length > 0) {
            console.log(`📝 First result: "${fuseResults[0].item.display}" (score: ${fuseResults[0].score})`);
        }
        
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
        this.contentCache.clear();
        this.rebuildFuse();
    }

    /* ---------- Private methods ---------- */

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
        if (entry.content?.toLowerCase().includes(queryLower)) {
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
            
            console.log(`🔧 Rebuilding Fuse index with ${this.entries.length} entries`);
            
            // Show sample entries for debugging
            if (this.entries.length > 0) {
                const koreanEntries = this.entries.filter(e => e.display.match(/[가-힣]/));
                console.log(`📊 Korean files found: ${koreanEntries.length}`);
                if (koreanEntries.length > 0) {
                    console.log(`📝 Sample Korean entry: "${koreanEntries[0].display}" → jamo: "${koreanEntries[0].jamo}"`);
                }
            }
            
            this.fuse = new Fuse(this.entries, {
                threshold: threshold,
                keys: [
                    { name: 'jamo', weight: 0.7 },        // Korean decomposed filename - highest weight
                    { name: 'display', weight: 0.3 },     // Original filename - moderate weight
                    // Content weights set to 0 since loaded lazily (will be updated later)
                ],
                includeScore: true,
                minMatchCharLength: 1,
                ignoreLocation: true,
                includeMatches: false,
                // Optimize for speed
                shouldSort: true,
                findAllMatches: false,
                useExtendedSearch: false
            });
            
            console.log(`🔧 Search index updated: ${this.entries.length} entries (fast mode)`);
        } catch (error) {
            console.error('❌ Failed to rebuild search index:', error);
        }
    }

    /** Batch add files with single Fuse rebuild at the end */
    async batchAddFiles(files: TFile[]): Promise<number> {
        let indexed = 0;
        
        for (const file of files) {
            try {
                await this.addFileMetadata(file);
                indexed++;
            } catch (error) {
                console.warn(`Failed to index metadata for ${file.path}:`, error);
            }
        }
        
        // Rebuild Fuse once at the end of batch
        this.rebuildFuse();
        return indexed;
    }
} 