import { MacCMSParamsProcessor } from '@/lib/maccms.params';

describe('MacCMSParamsProcessor', () => {
  describe('processParams', () => {
    it('should process category action correctly', () => {
      const searchParams = new URLSearchParams('ac=list&t=1&pg=2');
      const result = MacCMSParamsProcessor.processParams(searchParams);
      
      expect(result.action).toBe('category');
      expect(result.page).toBe(2);
      expect(result.categoryId).toBe(1);
    });

    it('should process list action correctly', () => {
    const searchParams = new URLSearchParams('ac=videolist&pg=2');
    const result = MacCMSParamsProcessor.processParams(searchParams);
    
    expect(result.action).toBe('list');
    expect(result.page).toBe(2);
  });

    it('should process search action correctly', () => {
      const searchParams = new URLSearchParams('ac=list&wd=test&pg=1&limit=30');
      const result = MacCMSParamsProcessor.processParams(searchParams);
      
      expect(result.action).toBe('search');
      expect(result.keyword).toBe('test');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(30);
    });

    it('should process detail action correctly', () => {
      const searchParams = new URLSearchParams('ac=detail&ids=123,456,789');
      const result = MacCMSParamsProcessor.processParams(searchParams);
      
      expect(result.action).toBe('detail');
      expect(result.videoIds).toEqual(['123', '456', '789']);
    });

    it('should process category action correctly', () => {
      const searchParams = new URLSearchParams('ac=list&t=0');
      const result = MacCMSParamsProcessor.processParams(searchParams);
      
      expect(result.action).toBe('category');
    });

    it('should use default values when parameters are missing', () => {
      const searchParams = new URLSearchParams('ac=list');
      const result = MacCMSParamsProcessor.processParams(searchParams);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should handle invalid page numbers', () => {
      const searchParams = new URLSearchParams('ac=list&pg=invalid');
      const result = MacCMSParamsProcessor.processParams(searchParams);
      
      expect(result.page).toBe(1);
    });

    it('should limit maximum page size', () => {
      const searchParams = new URLSearchParams('ac=list&limit=200');
      const result = MacCMSParamsProcessor.processParams(searchParams);
      
      expect(result.limit).toBe(100); // MAX_LIMIT
    });

    it('should enforce minimum page size', () => {
      const searchParams = new URLSearchParams('ac=list&limit=0');
      const result = MacCMSParamsProcessor.processParams(searchParams);
      
      expect(result.limit).toBe(1); // MIN_LIMIT
    });
  });

  describe('parseFilters', () => {
    it('should parse order filters correctly', () => {
      const searchParams = new URLSearchParams('ac=list&order=latest&by=time');
      const result = MacCMSParamsProcessor.processParams(searchParams);
      
      expect(result.filters.order).toBe('latest');
    });

    it('should parse area and year filters', () => {
      const searchParams = new URLSearchParams('ac=list&area=US&year=2024');
      const result = MacCMSParamsProcessor.processParams(searchParams);
      
      expect(result.filters.area).toBe('US');
      expect(result.filters.year).toBe('2024');
    });

    it('should parse time range filters', () => {
      const searchParams = new URLSearchParams('ac=list&start=2024-01-01&end=2024-12-31');
      const result = MacCMSParamsProcessor.processParams(searchParams);
      
      expect(result.filters.timeRange?.start).toBeInstanceOf(Date);
      expect(result.filters.timeRange?.end).toBeInstanceOf(Date);
    });

    it('should handle hours parameter for time range', () => {
      const searchParams = new URLSearchParams('ac=list&h=24');
      const result = MacCMSParamsProcessor.processParams(searchParams);
      
      expect(result.filters.timeRange?.start).toBeInstanceOf(Date);
      expect(result.filters.timeRange?.end).toBeInstanceOf(Date);
    });
  });

  describe('validateParams', () => {
    it('should validate valid parameters', () => {
      const params = {
        action: 'search' as const,
        keyword: 'test',
        page: 1,
        limit: 20,
        filters: {}
      };
      
      const result = MacCMSParamsProcessor.validateParams(params);
      expect(result.valid).toBe(true);
    });

    it('should reject search without keyword', () => {
      const params = {
        action: 'search' as const,
        page: 1,
        limit: 20,
        filters: {}
      };
      
      const result = MacCMSParamsProcessor.validateParams(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('搜索关键词');
    });

    it('should reject detail without video IDs', () => {
      const params = {
        action: 'detail' as const,
        page: 1,
        limit: 20,
        filters: {}
      };
      
      const result = MacCMSParamsProcessor.validateParams(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('视频ID不能为空');
    });

    it('should validate video IDs correctly', () => {
      const params = {
        action: 'detail' as const,
        videoIds: ['1', '2', '3'],
        page: 1,
        limit: 20,
        filters: {}
      };
      
      const result = MacCMSParamsProcessor.validateParams(params);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid page numbers', () => {
      const params = {
        action: 'list' as const,
        page: 0,
        limit: 20,
        filters: {}
      };
      
      const result = MacCMSParamsProcessor.validateParams(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('页码必须大于0');
    });

    it('should reject invalid limit values', () => {
      const params = {
        action: 'list' as const,
        page: 1,
        limit: 0,
        filters: {}
      };
      
      const result = MacCMSParamsProcessor.validateParams(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('每页数量必须在1-100之间');
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent cache keys', () => {
      const params = {
        action: 'search' as const,
        keyword: 'test',
        page: 1,
        limit: 20,
        filters: {}
      };
      
      const key1 = MacCMSParamsProcessor.generateCacheKey(params);
      const key2 = MacCMSParamsProcessor.generateCacheKey(params);
      
      expect(key1).toBe(key2);
      expect(key1).toContain('search');
      expect(key1).toContain('test');
    });

    it('should generate different keys for different parameters', () => {
      const params1 = {
        action: 'search' as const,
        keyword: 'test1',
        page: 1,
        limit: 20,
        filters: {}
      };
      
      const params2 = {
        action: 'search' as const,
        keyword: 'test2',
        page: 1,
        limit: 20,
        filters: {}
      };
      
      const key1 = MacCMSParamsProcessor.generateCacheKey(params1);
      const key2 = MacCMSParamsProcessor.generateCacheKey(params2);
      
      expect(key1).not.toBe(key2);
    });

    it('should include filters in cache key', () => {
      const params = {
        action: 'list' as const,
        page: 1,
        limit: 20,
        filters: {
          area: 'US',
          year: '2024',
          order: 'latest' as const
        }
      };
      
      const key = MacCMSParamsProcessor.generateCacheKey(params);
      
      expect(key).toContain('US');
      expect(key).toContain('2024');
      expect(key).toContain('latest');
    });
  });
});