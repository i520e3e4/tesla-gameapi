import '@testing-library/jest-dom/extend-expect';
import { TextEncoder, TextDecoder } from 'util';

// Allow router mocks.
// eslint-disable-next-line no-undef
jest.mock('next/router', () => require('next-router-mock'));

// Polyfill for Next.js API routes
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock fetch for testing
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}

// Mock Headers if not available
if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {
    constructor(init = {}) {
      this.map = new Map();
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this.map.set(key.toLowerCase(), value);
        });
      }
    }
    
    get(name) {
      return this.map.get(name.toLowerCase());
    }
    
    set(name, value) {
      this.map.set(name.toLowerCase(), value);
    }
    
    has(name) {
      return this.map.has(name.toLowerCase());
    }
  };
}

// Mock Web APIs for Node.js environment
if (!global.Request) {
  global.Request = class Request {
    constructor(input, init = {}) {
      Object.defineProperty(this, 'url', {
        value: typeof input === 'string' ? input : input.url,
        writable: false,
        enumerable: true,
        configurable: true
      });
      this.method = init.method || 'GET';
      this.headers = new Headers(init.headers);
      this.body = init.body;
    }
    
    async json() {
      return JSON.parse(this.body || '{}');
    }
    
    async text() {
      return this.body || '';
    }
  };
}

if (!global.Response) {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = new Headers(init.headers);
      this.ok = this.status >= 200 && this.status < 300;
    }
    
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }
    
    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
    }
    
    static json(data, init = {}) {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers
        }
      });
    }
  };
}

if (!global.Headers) {
  global.Headers = class Headers {
    constructor(init = {}) {
      this._headers = {};
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this._headers[key.toLowerCase()] = value;
        });
      }
    }
    
    get(name) {
      return this._headers[name.toLowerCase()];
    }
    
    set(name, value) {
      this._headers[name.toLowerCase()] = value;
    }
    
    has(name) {
      return name.toLowerCase() in this._headers;
    }
    
    delete(name) {
      delete this._headers[name.toLowerCase()];
    }
  };
}

// Mock AbortController for older Node.js versions
if (!global.AbortController) {
  global.AbortController = class AbortController {
    constructor() {
      this.signal = {
        aborted: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };
    }
    
    abort() {
      this.signal.aborted = true;
    }
  };
}
