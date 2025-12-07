import { RecommendationService } from '@electron/services/recommendation.service';
import {
  RecommendationRequest,
  PlaybookRecommendation,
} from '@electron/services/api.types';
import { Playbook } from '@electron/playbook/types';

describe('RecommendationService', () => {
  const mockPlaybooks: Playbook[] = [
    {
      metadata: {
        id: 'budget-register',
        name: '예산 등록',
        version: '1.0.0',
        description: '신규 예산을 등록하는 방법을 안내합니다',
        category: '교부관리',
        difficulty: '쉬움',
        keywords: ['예산', '등록', '신규'],
      },
      steps: [],
    },
    {
      metadata: {
        id: 'budget-modify',
        name: '예산 수정',
        version: '1.0.0',
        description: '기존 예산을 수정하는 방법',
        category: '교부관리',
        difficulty: '보통',
        keywords: ['예산', '수정', '변경'],
      },
      steps: [],
    },
    {
      metadata: {
        id: 'expense-register',
        name: '지출 결의',
        version: '1.0.0',
        description: '지출 결의서를 작성하고 제출합니다',
        category: '집행관리',
        difficulty: '보통',
        keywords: ['지출', '결의', '집행'],
      },
      steps: [],
    },
    {
      metadata: {
        id: 'member-register',
        name: '회원 등록',
        version: '1.0.0',
        description: '새로운 회원을 등록합니다',
        category: '회원관리',
        difficulty: '쉬움',
        keywords: ['회원', '등록', '신규'],
      },
      steps: [],
    },
  ];

  let service: RecommendationService;

  beforeEach(() => {
    service = new RecommendationService(mockPlaybooks);
  });

  describe('initialization', () => {
    test('should create instance with playbooks', () => {
      expect(service).toBeInstanceOf(RecommendationService);
    });

    test('should handle empty playbooks', () => {
      const emptyService = new RecommendationService([]);
      expect(emptyService).toBeInstanceOf(RecommendationService);
    });
  });

  describe('recommend', () => {
    test('should return recommendations for matching query', () => {
      const request: RecommendationRequest = {
        query: '예산 등록',
      };

      const result = service.recommend(request);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.query).toBe('예산 등록');
    });

    test('should return empty for non-matching query', () => {
      const request: RecommendationRequest = {
        query: 'xyz알수없는쿼리xyz',
      };

      const result = service.recommend(request);

      expect(result.recommendations).toHaveLength(0);
    });

    test('should limit results', () => {
      const request: RecommendationRequest = {
        query: '등록',
        limit: 2,
      };

      const result = service.recommend(request);

      expect(result.recommendations.length).toBeLessThanOrEqual(2);
    });

    test('should filter by category', () => {
      const request: RecommendationRequest = {
        query: '등록',
        category: '교부관리',
      };

      const result = service.recommend(request);

      result.recommendations.forEach((rec) => {
        expect(rec.category).toBe('교부관리');
      });
    });

    test('should sort by confidence', () => {
      const request: RecommendationRequest = {
        query: '예산',
      };

      const result = service.recommend(request);

      for (let i = 1; i < result.recommendations.length; i++) {
        expect(result.recommendations[i - 1].confidence).toBeGreaterThanOrEqual(
          result.recommendations[i].confidence
        );
      }
    });
  });

  describe('scoring', () => {
    test('should give higher score for title match', () => {
      const request: RecommendationRequest = {
        query: '예산 등록',
      };

      const result = service.recommend(request);
      const budgetRegister = result.recommendations.find(
        (r) => r.playbookId === 'budget-register'
      );
      const budgetModify = result.recommendations.find(
        (r) => r.playbookId === 'budget-modify'
      );

      expect(budgetRegister?.confidence).toBeGreaterThan(
        budgetModify?.confidence || 0
      );
    });

    test('should match keywords', () => {
      const request: RecommendationRequest = {
        query: '신규',
      };

      const result = service.recommend(request);

      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should match description', () => {
      const request: RecommendationRequest = {
        query: '안내',
      };

      const result = service.recommend(request);

      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('search', () => {
    test('should search by playbook ID', () => {
      const result = service.searchById('budget-register');

      expect(result).not.toBeNull();
      expect(result?.playbookId).toBe('budget-register');
    });

    test('should return null for unknown ID', () => {
      const result = service.searchById('unknown-id');

      expect(result).toBeNull();
    });

    test('should search by category', () => {
      const result = service.searchByCategory('교부관리');

      expect(result.length).toBe(2);
      result.forEach((rec) => {
        expect(rec.category).toBe('교부관리');
      });
    });

    test('should return empty for unknown category', () => {
      const result = service.searchByCategory('알수없는카테고리');

      expect(result).toHaveLength(0);
    });
  });

  describe('getAllCategories', () => {
    test('should return unique categories', () => {
      const categories = service.getAllCategories();

      expect(categories).toContain('교부관리');
      expect(categories).toContain('집행관리');
      expect(categories).toContain('회원관리');
      expect(new Set(categories).size).toBe(categories.length);
    });
  });

  describe('updatePlaybooks', () => {
    test('should update playbook list', () => {
      const newPlaybooks: Playbook[] = [
        {
          metadata: {
            id: 'new-playbook',
            name: '새 플레이북',
            version: '1.0.0',
            category: '기타',
            difficulty: '쉬움',
          },
          steps: [],
        },
      ];

      service.updatePlaybooks(newPlaybooks);

      const result = service.searchById('new-playbook');
      expect(result).not.toBeNull();
    });
  });
});
