import { NextRequest } from 'next/server';

import { epornerClient } from '@/lib/eporner.client';

import { GET } from '@/app/api/maccms/route';

// Mock dependencies
jest.mock('@/lib/eporner.client');
jest.mock('@/lib/config', () => ({
  getCacheTime: () => 300
}));

const mockEpornerClient = epornerClient as jest.Mocked<typeof epornerClient>;

describe('/api/maccms route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET handler', () => {
    it('should handle video list request', async () => {
      // Mock eporner response
      mockEpornerClient.search.mockResolvedValue({
        videos: [
          {
            id: '123',
            title: 'Test Video',
            keywords: 'test,video',
            views: 1000,
            rate: 4.5,
            url: 'https://example.com/video/123',
            embed: 'https://example.com/embed/123',
            added: '2024-01-01',
            length_sec: 600,
            default_thumb: {
              src: 'https://example.com/thumb/123.jpg',
              width: 320,
              height: 240
            },
            thumbs: []
          }
        ],
        total_count: 1,
        current_page: 1,
        total_pages: 1
      });

      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&pg=1');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('code');
      expect(data).toHaveProperty('list');
      expect(data.list).toBeInstanceOf(Array);
      expect(data.code).toBe(1);
    });

    it('should handle video search request', async () => {
      mockEpornerClient.search.mockResolvedValue({
        videos: [
          {
            id: '456',
            title: 'Search Result',
            keywords: 'search,result',
            views: 2000,
            rate: 4.8,
            url: 'https://example.com/video/456',
            embed: 'https://example.com/embed/456',
            added: '2024-01-02',
            length_sec: 720,
            default_thumb: {
              src: 'https://example.com/thumb/456.jpg',
              width: 320,
              height: 240
            },
            thumbs: []
          }
        ],
        total_count: 1,
        current_page: 1,
        total_pages: 1
      });

      const request = new NextRequest('http://localhost:3000/api/maccms?ac=search&wd=test');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      expect(mockEpornerClient.search).toHaveBeenCalledWith(
        'test',
        1,
        expect.any(Number),
        'latest'
      );
    });

    it('should handle video detail request', async () => {
      mockEpornerClient.getVideoDetails.mockResolvedValue({
        id: '789',
        title: 'Detail Video',
        keywords: 'detail,video',
        views: 3000,
        rate: 4.2,
        url: 'https://example.com/video/789',
        embed: 'https://example.com/embed/789',
        added: '2024-01-03',
        length_sec: 900,
        default_thumb: {
          src: 'https://example.com/thumb/789.jpg',
          width: 320,
          height: 240
        },
        thumbs: []
      });

      const request = new NextRequest('http://localhost:3000/api/maccms?ac=detail&ids=789');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      expect(mockEpornerClient.getVideoDetails).toHaveBeenCalledWith('789');
    });

    it('should handle category list request', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=category');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('class');
      expect(data.class).toBeInstanceOf(Array);
    });

    it('should return error for invalid action', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=invalid');
      const response = await GET(request);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should handle API errors gracefully', async () => {
      mockEpornerClient.search.mockRejectedValue(new Error('API Error'));

      const request = new NextRequest('http://localhost:3000/api/maccms?ac=search&wd=test');
      const response = await GET(request);
      
      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should include cache headers in response', async () => {
      mockEpornerClient.search.mockResolvedValue({
        videos: [],
        total_count: 0,
        current_page: 1,
        per_page: 20
      });

      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list');
      const response = await GET(request);
      
      expect(response.headers.get('Cache-Control')).toBeTruthy();
      expect(response.headers.get('CDN-Cache-Control')).toBeTruthy();
    });
  });
});