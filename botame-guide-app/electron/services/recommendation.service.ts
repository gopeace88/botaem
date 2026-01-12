/**
 * Recommendation Service
 * Provides playbook recommendations based on user queries
 */

import {
  RecommendationRequest,
  RecommendationResponse,
  PlaybookRecommendation,
} from "./api.types";
import { Playbook } from "../playbook/types";

const DEFAULT_LIMIT = 5;

// Scoring weights
const WEIGHTS = {
  titleExact: 1.0,
  titlePartial: 0.7,
  descriptionMatch: 0.5,
  keywordMatch: 0.6,
  categoryMatch: 0.3,
};

export class RecommendationService {
  private playbooks: Playbook[];

  constructor(playbooks: Playbook[]) {
    this.playbooks = playbooks;
  }

  /**
   * Update the playbook list
   */
  updatePlaybooks(playbooks: Playbook[]): void {
    this.playbooks = playbooks;
  }

  /**
   * Get recommendations based on query
   */
  recommend(request: RecommendationRequest): RecommendationResponse {
    const { query, category, limit = DEFAULT_LIMIT } = request;
    const normalizedQuery = query.toLowerCase().trim();
    const queryTerms = normalizedQuery.split(/\s+/);

    // Filter and score playbooks
    let candidates = this.playbooks
      .map((playbook) => ({
        playbook,
        score: this.calculateScore(playbook, normalizedQuery, queryTerms),
      }))
      .filter((item) => item.score > 0);

    // Filter by category if specified
    if (category) {
      candidates = candidates.filter(
        (item) => item.playbook.metadata.category === category,
      );
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Limit results
    const limited = candidates.slice(0, limit);

    // Convert to recommendations
    const recommendations: PlaybookRecommendation[] = limited.map((item) => ({
      playbookId: item.playbook.metadata.id,
      title: item.playbook.metadata.name,
      description: item.playbook.metadata.description || "",
      category: item.playbook.metadata.category,
      confidence: Math.min(item.score, 1),
      matchReason: this.getMatchReason(item.playbook, queryTerms),
    }));

    return {
      recommendations,
      query,
      totalMatches: candidates.length,
    };
  }

  /**
   * Search playbook by ID
   */
  searchById(playbookId: string): PlaybookRecommendation | null {
    const playbook = this.playbooks.find((p) => p.metadata.id === playbookId);

    if (!playbook) {
      return null;
    }

    return {
      playbookId: playbook.metadata.id,
      title: playbook.metadata.name,
      description: playbook.metadata.description || "",
      category: playbook.metadata.category,
      confidence: 1,
    };
  }

  /**
   * Search playbooks by category
   */
  searchByCategory(category: string): PlaybookRecommendation[] {
    return this.playbooks
      .filter((p) => p.metadata.category === category)
      .map((playbook) => ({
        playbookId: playbook.metadata.id,
        title: playbook.metadata.name,
        description: playbook.metadata.description || "",
        category: playbook.metadata.category,
        confidence: 1,
      }));
  }

  /**
   * Get all unique categories
   */
  getAllCategories(): string[] {
    const categories = new Set(
      this.playbooks
        .map((p) => p.metadata.category)
        .filter((c): c is string => c !== undefined),
    );
    return Array.from(categories);
  }

  /**
   * Calculate relevance score for a playbook
   */
  private calculateScore(
    playbook: Playbook,
    normalizedQuery: string,
    queryTerms: string[],
  ): number {
    const metadata = playbook.metadata;
    let score = 0;

    const titleLower = metadata.name.toLowerCase();
    const descLower = (metadata.description || "").toLowerCase();
    const keywordsLower = (metadata.keywords || []).map((k) => k.toLowerCase());

    // Exact title match
    if (titleLower === normalizedQuery) {
      score += WEIGHTS.titleExact;
    }
    // Partial title match
    else if (
      titleLower.includes(normalizedQuery) ||
      normalizedQuery.includes(titleLower)
    ) {
      score += WEIGHTS.titlePartial;
    }
    // Title contains query terms
    else {
      const titleTermMatches = queryTerms.filter((term) =>
        titleLower.includes(term),
      ).length;
      if (titleTermMatches > 0) {
        score += WEIGHTS.titlePartial * (titleTermMatches / queryTerms.length);
      }
    }

    // Description match
    const descTermMatches = queryTerms.filter((term) =>
      descLower.includes(term),
    ).length;
    if (descTermMatches > 0) {
      score += WEIGHTS.descriptionMatch * (descTermMatches / queryTerms.length);
    }

    // Keyword match
    const keywordMatches = queryTerms.filter((term) =>
      keywordsLower.some((k) => k.includes(term) || term.includes(k)),
    ).length;
    if (keywordMatches > 0) {
      score += WEIGHTS.keywordMatch * (keywordMatches / queryTerms.length);
    }

    return score;
  }

  /**
   * Get human-readable match reason
   */
  private getMatchReason(playbook: Playbook, queryTerms: string[]): string {
    const metadata = playbook.metadata;
    const titleLower = metadata.name.toLowerCase();
    const keywordsLower = (metadata.keywords || []).map((k) => k.toLowerCase());

    const matchedTerms: string[] = [];

    // Check title matches
    const titleMatches = queryTerms.filter((term) => titleLower.includes(term));
    if (titleMatches.length > 0) {
      matchedTerms.push(`제목: "${titleMatches.join(", ")}"`);
    }

    // Check keyword matches
    const keywordMatches = queryTerms.filter((term) =>
      keywordsLower.some((k) => k.includes(term)),
    );
    if (keywordMatches.length > 0 && matchedTerms.length === 0) {
      matchedTerms.push(`키워드: "${keywordMatches.join(", ")}"`);
    }

    return matchedTerms.length > 0
      ? `${matchedTerms.join(", ")} 매칭`
      : "관련 콘텐츠";
  }
}
