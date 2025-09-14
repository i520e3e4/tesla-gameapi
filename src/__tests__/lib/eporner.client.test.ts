import { epornerClient } from '@/lib/eporner.client';
import { EpornerSearchResponse,EpornerVideo } from '@/lib/types/eporner';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('EpornerClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('search', () => {
    it('should search videos successfully', async () => {
      const mockResponse: EpornerSearchResponse = {
        videos: [
          {
            id: '123',
            title: 'Test Video',
            url: 'https://example.com/video/123',
            thumb: 'https://example.com/thumb/123.jpg',
            duration: 600,
            views: 1000,
            rating: 4.5,
            added: '2024-01-01',
            keywords: ['test', 'video']
          }
        ],
        total_count: 1,
        current_page: 1,
        per_page: 20
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200,
        statusText: 'OK'
      } as Response);

      const result = await epornerClient.search('test', 1, 20, 'latest');
      
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'User-Agent': expect.any(String)
          })
        })
      );
    });

    it('should handle search with different parameters', async () => {
      const mockResponse: EpornerSearchResponse = {
        videos: [],
        total_count: 0,
        current_page: 2,
        per_page: 50
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await epornerClient.search('keyword', 2, 50, 'popular');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=50'),
        expect.any(Object)
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      await expect(epornerClient.search('test')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(epornerClient.search('test')).rejects.toThrow('Network error');
    });

    it('should use default parameters when not provided', async () => {
      const mockResponse: EpornerSearchResponse = {
        videos: [],
        total_count: 0,
        current_page: 1,
        per_page: 20
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await epornerClient.search('test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=60'),
        expect.any(Object)
      );
    });
  });

  describe('getVideoDetails', () => {
    it('should get video details successfully', async () => {
      const mockVideo: EpornerVideo = {
        id: '123',
        title: 'Test Video Details',
        url: 'https://example.com/video/123',
        thumb: 'https://example.com/thumb/123.jpg',
        duration: 900,
        views: 5000,
        rating: 4.8,
        added: '2024-01-01',
        keywords: ['test', 'details'],
        description: 'Test video description',
        embed_url: 'https://example.com/embed/123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideo
      } as Response);

      const result = await epornerClient.getVideoById('123');
      
      expect(result).toEqual(mockVideo);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('123'),
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should handle video not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      await expect(epornerClient.getVideoById('nonexistent')).rejects.toThrow();
    });

    it('should validate video ID format', async () => {
      await expect(epornerClient.getVideoById('')).rejects.toThrow('Eporner API请求失败');
      await expect(epornerClient.getVideoById('   ')).rejects.toThrow('Eporner API请求失败');
    });
  });

  describe('getRemovedVideos', () => {
    it('should fetch removed videos successfully', async () => {
      const mockRemovedVideos = {
        videos: [
          { id: '1', deleted: '2024-01-01' },
          { id: '2', deleted: '2024-01-02' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRemovedVideos,
      } as Response);

      const result = await epornerClient.getRemovedVideos();
      
      expect(result).toEqual(mockRemovedVideos);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/removed'),
        expect.objectContaining({
          headers: expect.any(Object)
        })
      );
    });

    it('should handle removed videos API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      await expect(epornerClient.getRemovedVideos()).rejects.toThrow();
    });
  });

  describe('error handling and retries', () => {
    it('should retry on temporary failures', async () => {
      // First call fails, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable'
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ videos: [], total_count: 0, current_page: 1, per_page: 20 })
        } as Response);

      const result = await epornerClient.search('test');
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it('should respect rate limits', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '60' })
      } as Response);

      await expect(epornerClient.search('test')).rejects.toThrow();
    });

    it('should include proper headers', async () => {
      const jsonError = new Error('Invalid JSON');
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => { throw jsonError; }
      } as Response));

      await expect(epornerClient.search('test')).rejects.toThrow('Invalid JSON');
    });
  });

  describe('request configuration', () => {
    it('should include proper headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ videos: [], total_count: 0, current_page: 1, per_page: 20 })
      } as Response);

      await epornerClient.search('test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            'Accept': 'application/json'
          })
        })
      );
    });

    it('should handle timeout properly', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      
      // Ensure mock is properly set up
      mockFetch.mockImplementation(() => {
        return Promise.reject(abortError);
      });

      await expect(epornerClient.search('test')).rejects.toThrow('Eporner API请求超时');
    }, 10000);
  });
});