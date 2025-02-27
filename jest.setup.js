import '@testing-library/jest-dom';

global.Headers = class Headers {
  constructor(init = {}) {
    this._headers = new Map();
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this._headers.set(key.toLowerCase(), value);
      });
    }
  }

  get(key) {
    return this._headers.get(key.toLowerCase()) || null;
  }

  set(key, value) {
    this._headers.set(key.toLowerCase(), value);
  }
};

global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.headers = new Headers(init?.headers);
    this.status = init?.status || 200;
    this.ok = this.status >= 200 && this.status < 300;
  }
  
  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }
  
  async blob() {
    return this.body;
  }
};

global.Request = class Request {
  constructor(url, init = {}) {
    this._url = url;
    this.method = init?.method || 'GET';
    this.headers = new Headers(init?.headers);
  }

  get url() {
    return this._url;
  }
};

if (typeof window !== 'undefined') {
  window.URL.createObjectURL = jest.fn();
  window.URL.revokeObjectURL = jest.fn();
}

global.URL = class URL {
  constructor(url) {
    this._url = url;
    this.searchParams = new URLSearchParams(url.split('?')[1] || '');
  }

  get href() {
    return this._url;
  }

  toString() {
    return this._url;
  }
};

global.fetch = jest.fn();

if (typeof Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(content, options = {}) {
      this.content = content;
      this.type = options.type || '';
    }
  };
}

class MockIntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

global.IntersectionObserver = MockIntersectionObserver; 