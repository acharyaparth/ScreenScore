import { ScreenplayAnalysis } from '../types';

interface CacheEntry {
  data: ScreenplayAnalysis;
  timestamp: number;
  hash: string;
}

class AnalysisCache {
  private static instance: AnalysisCache;
  private cache: Map<string, CacheEntry>;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 100; // Maximum number of cached analyses

  private constructor() {
    this.cache = new Map();
    this.loadFromLocalStorage();
  }

  public static getInstance(): AnalysisCache {
    if (!AnalysisCache.instance) {
      AnalysisCache.instance = new AnalysisCache();
    }
    return AnalysisCache.instance;
  }

  private async generateHash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private loadFromLocalStorage(): void {
    try {
      const cached = localStorage.getItem('analysisCache');
      if (cached) {
        const parsed = JSON.parse(cached);
        this.cache = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('Error loading cache from localStorage:', error);
      this.cache = new Map();
    }
  }

  private saveToLocalStorage(): void {
    try {
      const serialized = Object.fromEntries(this.cache);
      localStorage.setItem('analysisCache', JSON.stringify(serialized));
    } catch (error) {
      console.error('Error saving cache to localStorage:', error);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Remove expired entries
    entries.forEach(([key, entry]) => {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    });

    // If still over size limit, remove oldest entries
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const sortedEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const entriesToRemove = sortedEntries.slice(0, this.cache.size - this.MAX_CACHE_SIZE);
      entriesToRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  public async get(screenplay: string): Promise<ScreenplayAnalysis | null> {
    const hash = await this.generateHash(screenplay);
    const entry = this.cache.get(hash);

    if (entry && Date.now() - entry.timestamp <= this.CACHE_DURATION) {
      return entry.data;
    }

    return null;
  }

  public async set(screenplay: string, analysis: ScreenplayAnalysis): Promise<void> {
    const hash = await this.generateHash(screenplay);
    this.cache.set(hash, {
      data: analysis,
      timestamp: Date.now(),
      hash
    });

    this.cleanup();
    this.saveToLocalStorage();
  }

  public clear(): void {
    this.cache.clear();
    localStorage.removeItem('analysisCache');
  }
}

export const analysisCache = AnalysisCache.getInstance(); 