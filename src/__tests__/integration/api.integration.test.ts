import { NextRequest } from 'next/server';

import { GET } from '@/app/api/maccms/route';

// Integration tests for the complete API flow
describe('MacCMS API Integration Tests', () => {
  // Mock environment variables
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    delete process.env.NODE_ENV;
  });

  describe('Complete API Flow', () => {
    it('should handle complete video list flow', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&pg=1&t=1');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      
      // Verify response structure
      expect(data).toHaveProperty('code', 1);
      expect(data).toHaveProperty('msg', 'success');
      expect(data).toHaveProperty('page', 1);
      expect(data).toHaveProperty('pagecount');
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('list');
      expect(Array.isArray(data.list)).toBe(true);
      
      // Verify cache headers
      expect(response.headers.get('Cache-Control')).toBeTruthy();
      expect(response.headers.get('CDN-Cache-Control')).toBeTruthy();
    });

    it('should handle complete search flow', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=search&wd=test&pg=1');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      
      // Verify search response structure
      expect(data).toHaveProperty('code', 1);
      expect(data).toHaveProperty('msg', 'success');
      expect(data).toHaveProperty('list');
      expect(Array.isArray(data.list)).toBe(true);
    });

    it('should handle complete detail flow', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=detail&ids=123');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      
      // Verify detail response structure
      expect(data).toHaveProperty('code', 1);
      expect(data).toHaveProperty('msg', 'success');
      expect(data).toHaveProperty('list');
      expect(Array.isArray(data.list)).toBe(true);
    });

    it('should handle complete category flow', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=category');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      
      // Verify category response structure
      expect(data).toHaveProperty('code', 1);
      expect(data).toHaveProperty('msg', 'success');
      expect(data).toHaveProperty('class');
      expect(Array.isArray(data.class)).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid action gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=invalid');
      const response = await GET(request);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data).toHaveProperty('code', 0);
      expect(data).toHaveProperty('msg');
      expect(data).toHaveProperty('error');
    });

    it('should handle missing required parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=search');
      const response = await GET(request);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data).toHaveProperty('code', 0);
      expect(data.error).toContain('关键词');
    });

    it('should handle invalid video IDs', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=detail');
      const response = await GET(request);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data).toHaveProperty('code', 0);
      expect(data.error).toContain('视频ID');
    });
  });

  describe('Parameter Validation Integration', () => {
    it('should validate page parameters correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&pg=0');
      const response = await GET(request);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('页码');
    });

    it('should validate limit parameters correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&limit=0');
      const response = await GET(request);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('每页数量');
    });

    it('should enforce maximum limit', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&limit=200');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.limit).toBeLessThanOrEqual(100);
    });
  });

  describe('Filter Integration', () => {
    it('should handle order filters', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&order=latest');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('list');
    });

    it('should handle area and year filters', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&area=US&year=2024');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('list');
    });

    it('should handle time range filters', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&h=24');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('list');
    });
  });

  describe('Performance and Caching Integration', () => {
    it('should include proper cache headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      // Check cache headers
      const cacheControl = response.headers.get('Cache-Control');
      const cdnCacheControl = response.headers.get('CDN-Cache-Control');
      
      expect(cacheControl).toBeTruthy();
      expect(cdnCacheControl).toBeTruthy();
      expect(cacheControl).toContain('max-age');
    });

    it('should handle concurrent requests properly', async () => {
      const requests = Array.from({ length: 5 }, () => 
        new NextRequest('http://localhost:3000/api/maccms?ac=list&pg=1')
      );
      
      const responses = await Promise.all(
        requests.map(request => GET(request))
      );
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // All responses should have the same structure
      const dataPromises = responses.map(response => response.json());
      const dataResults = await Promise.all(dataPromises);
      
      dataResults.forEach(data => {
        expect(data).toHaveProperty('code', 1);
        expect(data).toHaveProperty('list');
      });
    });
  });

  describe('Edge Cases Integration', () => {
    it('should handle empty search results', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=search&wd=nonexistentquery12345');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('code', 1);
      expect(data).toHaveProperty('list');
      expect(Array.isArray(data.list)).toBe(true);
    });

    it('should handle large page numbers', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&pg=9999');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('code', 1);
      expect(data).toHaveProperty('list');
    });

    it('should handle special characters in search', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=search&wd=%E6%B5%8B%E8%AF%95');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('code', 1);
      expect(data).toHaveProperty('list');
    });

    it('should handle multiple video IDs in detail request', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=detail&ids=123,456,789');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('code', 1);
      expect(data).toHaveProperty('list');
    });
  });
});