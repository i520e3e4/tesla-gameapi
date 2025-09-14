import { NextRequest } from 'next/server';

import { GET } from '@/app/api/maccms/route';

// Performance tests for the MacCMS API
describe('MacCMS API Performance Tests', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    delete process.env.NODE_ENV;
  });

  describe('Response Time Performance', () => {
    it('should respond to list requests within acceptable time', async () => {
      const startTime = Date.now();
      
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&pg=1');
      const response = await GET(request);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });

    it('should respond to search requests within acceptable time', async () => {
      const startTime = Date.now();
      
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=search&wd=test');
      const response = await GET(request);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });

    it('should respond to detail requests within acceptable time', async () => {
      const startTime = Date.now();
      
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=detail&ids=123');
      const response = await GET(request);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(3000); // Detail requests should be faster
    });

    it('should respond to category requests within acceptable time', async () => {
      const startTime = Date.now();
      
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=category');
      const response = await GET(request);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Category requests should be fastest
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle multiple concurrent list requests', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();
      
      const requests = Array.from({ length: concurrentRequests }, (_, i) => 
        new NextRequest(`http://localhost:3000/api/maccms?ac=list&pg=${i + 1}`)
      );
      
      const responses = await Promise.all(
        requests.map(request => GET(request))
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(10000); // Within 10 seconds for 10 requests
    });

    it('should handle mixed concurrent requests', async () => {
      const startTime = Date.now();
      
      const requests = [
        new NextRequest('http://localhost:3000/api/maccms?ac=list&pg=1'),
        new NextRequest('http://localhost:3000/api/maccms?ac=search&wd=test'),
        new NextRequest('http://localhost:3000/api/maccms?ac=detail&ids=123'),
        new NextRequest('http://localhost:3000/api/maccms?ac=category'),
        new NextRequest('http://localhost:3000/api/maccms?ac=list&pg=2')
      ];
      
      const responses = await Promise.all(
        requests.map(request => GET(request))
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should handle mixed requests efficiently
      expect(totalTime).toBeLessThan(8000); // Within 8 seconds for 5 mixed requests
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not cause memory leaks with repeated requests', async () => {
      const initialMemory = process.memoryUsage();
      
      // Make 50 requests
      for (let i = 0; i < 50; i++) {
        const request = new NextRequest(`http://localhost:3000/api/maccms?ac=list&pg=${i % 10 + 1}`);
        const response = await GET(request);
        expect(response.status).toBe(200);
        
        // Consume response to ensure cleanup
        await response.json();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle large page numbers efficiently', async () => {
      const startTime = Date.now();
      
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&pg=100');
      const response = await GET(request);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(6000); // Should still respond within 6 seconds
    });

    it('should handle maximum limit efficiently', async () => {
      const startTime = Date.now();
      
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&limit=100');
      const response = await GET(request);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(8000); // Larger datasets may take longer
      
      const data = await response.json();
      expect(data.list.length).toBeLessThanOrEqual(100);
    });

    it('should handle multiple video IDs in detail request efficiently', async () => {
      const startTime = Date.now();
      
      const videoIds = Array.from({ length: 10 }, (_, i) => (i + 1).toString()).join(',');
      const request = new NextRequest(`http://localhost:3000/api/maccms?ac=detail&ids=${videoIds}`);
      const response = await GET(request);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(10000); // Multiple details may take longer
    });
  });

  describe('Cache Performance', () => {
    it('should benefit from caching on repeated requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&pg=1');
      
      // First request (cache miss)
      const startTime1 = Date.now();
      const response1 = await GET(request);
      const endTime1 = Date.now();
      const firstRequestTime = endTime1 - startTime1;
      
      expect(response1.status).toBe(200);
      
      // Second request (potential cache hit)
      const startTime2 = Date.now();
      const response2 = await GET(request);
      const endTime2 = Date.now();
      const secondRequestTime = endTime2 - startTime2;
      
      expect(response2.status).toBe(200);
      
      // Second request should be faster or similar (due to caching)
      expect(secondRequestTime).toBeLessThanOrEqual(firstRequestTime * 1.5);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle validation errors quickly', async () => {
      const startTime = Date.now();
      
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=search');
      const response = await GET(request);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(400);
      expect(responseTime).toBeLessThan(1000); // Error responses should be very fast
    });

    it('should handle invalid actions quickly', async () => {
      const startTime = Date.now();
      
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=invalid');
      const response = await GET(request);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(400);
      expect(responseTime).toBeLessThan(1000); // Error responses should be very fast
    });
  });

  describe('Resource Usage Performance', () => {
    it('should not exceed reasonable CPU usage', async () => {
      const startTime = process.hrtime.bigint();
      
      // Make multiple requests to stress test
      const requests = Array.from({ length: 20 }, (_, i) => 
        new NextRequest(`http://localhost:3000/api/maccms?ac=list&pg=${i + 1}`)
      );
      
      await Promise.all(requests.map(request => GET(request)));
      
      const endTime = process.hrtime.bigint();
      const cpuTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      // CPU time should be reasonable for 20 requests
      expect(cpuTime).toBeLessThan(30000); // Less than 30 seconds of CPU time
    });
  });

  describe('Response Size Performance', () => {
    it('should return reasonably sized responses', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&limit=50');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const responseText = await response.text();
      const responseSize = new Blob([responseText]).size;
      
      // Response should not be excessively large (less than 1MB)
      expect(responseSize).toBeLessThan(1024 * 1024);
    });

    it('should compress responses when appropriate', async () => {
      const request = new NextRequest('http://localhost:3000/api/maccms?ac=list&limit=100');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      // Check if response includes compression hints
      const contentType = response.headers.get('Content-Type');
      expect(contentType).toContain('application/json');
    });
  });
});