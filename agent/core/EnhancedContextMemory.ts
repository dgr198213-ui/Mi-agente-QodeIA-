/**
 * Enhanced Context Memory Engine for Agent
 * Simplified version for the QodeIA Agent
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface ContextEntry {
  id: string;
  type: 'file' | 'import' | 'function' | 'component' | 'variable' | 'tool' | 'error' | 'solution';
  content: string;
  path?: string;
  line?: number;
  importance: number;
  lastAccessed: string;
  accessCount: number;
  metadata: Record<string, any>;
}

export interface SearchResult {
  entry: ContextEntry;
  relevance: number;
  context: string;
}

// ============================================================================
// CONTEXT MEMORY ENGINE
// ============================================================================

export class EnhancedContextMemoryEngine {
  private supabase: ReturnType<typeof createClient>;
  private projectId: string;
  private entries: Map<string, ContextEntry> = new Map();
  private semanticIndex: Map<string, Set<string>> = new Map();
  private maxEntries: number = 1000;

  constructor(supabaseUrl: string, supabaseKey: string, projectId: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.projectId = projectId;
  }

  async initializeProject(projectId: string): Promise<void> {
    this.projectId = projectId;

    // Load existing entries from database
    try {
      const { data, error } = await this.supabase
        .from('agent_memory')
        .select('*')
        .eq('project_id', projectId)
        .order('access_count', { ascending: false })
        .limit(this.maxEntries);

      if (data && !error) {
        for (const entry of data) {
          this.entries.set(entry.id, {
            id: entry.id,
            type: entry.type,
            content: entry.content,
            path: entry.path,
            importance: entry.importance,
            lastAccessed: entry.last_accessed,
            accessCount: entry.access_count,
            metadata: entry.metadata || {},
          });
          this.updateIndex(entry.id, entry.content);
        }
      }
    } catch (error) {
      console.error('[CME] Error loading entries:', error);
    }
  }

  async addEntry(projectId: string, entry: Omit<ContextEntry, 'id' | 'lastAccessed' | 'accessCount'>): Promise<ContextEntry> {
    const id = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newEntry: ContextEntry = {
      ...entry,
      id,
      lastAccessed: new Date().toISOString(),
      accessCount: 1,
    };

    this.entries.set(id, newEntry);
    this.updateIndex(id, entry.content);

    // Persist to database
    try {
      await this.supabase.from('agent_memory').insert({
        project_id: projectId,
        type: newEntry.type,
        content: newEntry.content,
        path: newEntry.path,
        importance: newEntry.importance,
        access_count: 1,
        last_accessed: newEntry.lastAccessed,
        metadata: newEntry.metadata,
      });
    } catch (error) {
      console.error('[CME] Error persisting entry:', error);
    }

    // Cleanup old entries if needed
    if (this.entries.size > this.maxEntries) {
      await this.cleanup();
    }

    return newEntry;
  }

  async search(projectId: string, query: string, limit: number = 10): Promise<SearchResult[]> {
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/);
    const results: SearchResult[] = [];

    // Search in semantic index first
    const candidateIds = new Set<string>();

    for (const token of queryTokens) {
      const ids = this.semanticIndex.get(token);
      if (ids) {
        for (const id of ids) {
          candidateIds.add(id);
        }
      }
    }

    // If no index hits, search all entries
    if (candidateIds.size === 0) {
      for (const [id] of this.entries) {
        candidateIds.add(id);
      }
    }

    // Calculate relevance for candidates
    for (const id of candidateIds) {
      const entry = this.entries.get(id);
      if (!entry) continue;

      const relevance = this.calculateRelevance(entry, queryTokens);
      if (relevance > 0.1) {
        results.push({
          entry,
          relevance,
          context: this.getContextSnippet(entry, query),
        });
      }
    }

    // Sort by relevance and limit
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  async accessEntry(projectId: string, entryId: string): Promise<ContextEntry | null> {
    const entry = this.entries.get(entryId);
    if (!entry) return null;

    entry.accessCount += 1;
    entry.lastAccessed = new Date().toISOString();
    entry.importance = Math.min(1, entry.importance + 0.05);

    // Update in database
    try {
      await this.supabase
        .from('agent_memory')
        .update({
          access_count: entry.accessCount,
          last_accessed: entry.lastAccessed,
          importance: entry.importance,
        })
        .eq('id', entryId);
    } catch (error) {
      console.error('[CME] Error updating entry:', error);
    }

    return entry;
  }

  async findSolution(errorPattern: string): Promise<ContextEntry | null> {
    const results = await this.search(this.projectId, errorPattern, 20);

    // Find solution entries
    for (const result of results) {
      if (result.entry.type === 'solution' && result.relevance > 0.5) {
        await this.accessEntry(this.projectId, result.entry.id);
        return result.entry;
      }
    }

    return null;
  }

  private updateIndex(id: string, content: string): void {
    const keywords = this.extractKeywords(content);

    for (const keyword of keywords) {
      const existing = this.semanticIndex.get(keyword) || new Set();
      existing.add(id);
      this.semanticIndex.set(keyword, existing);
    }
  }

  private extractKeywords(content: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'i',
    ]);

    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 3 && !stopWords.has(t));
  }

  private calculateRelevance(entry: ContextEntry, queryTokens: string[]): number {
    const contentLower = entry.content.toLowerCase();
    let matchCount = 0;

    for (const token of queryTokens) {
      if (contentLower.includes(token)) {
        matchCount += 1;
      }
    }

    const matchScore = matchCount / queryTokens.length;
    const importanceFactor = entry.importance;
    const accessFactor = Math.min(1, Math.log(entry.accessCount + 1) / 10);

    return (matchScore * 0.6) + (importanceFactor * 0.25) + (accessFactor * 0.15);
  }

  private getContextSnippet(entry: ContextEntry, query: string): string {
    const maxLength = 300;
    const content = entry.content;

    if (content.length <= maxLength) {
      return content;
    }

    const queryLower = query.toLowerCase();
    const index = content.toLowerCase().indexOf(queryLower);

    if (index === -1) {
      return content.substring(0, maxLength) + '...';
    }

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 200);

    return (start > 0 ? '...' : '') + content.substring(start, end) + (end < content.length ? '...' : '');
  }

  private async cleanup(): Promise<void> {
    // Sort by importance and access count
    const sorted = Array.from(this.entries.entries())
      .sort((a, b) => {
        const scoreA = a[1].importance * a[1].accessCount;
        const scoreB = b[1].importance * b[1].accessCount;
        return scoreA - scoreB;
      });

    // Remove least important entries
    const toRemove = sorted.slice(0, Math.floor(this.maxEntries * 0.2));

    for (const [id] of toRemove) {
      this.entries.delete(id);
      await this.supabase.from('agent_memory').delete().eq('id', id);
    }
  }

  destroyProject(projectId: string): void {
    this.entries.clear();
    this.semanticIndex.clear();
  }

  getStats(): {
    entryCount: number;
    indexSize: number;
  } {
    return {
      entryCount: this.entries.size,
      indexSize: this.semanticIndex.size,
    };
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default EnhancedContextMemoryEngine;
