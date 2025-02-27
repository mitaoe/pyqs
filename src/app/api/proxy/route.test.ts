import { NextRequest, NextResponse } from 'next/server';
import { GET } from './route';

const originalNextResponse = { ...NextResponse };
NextResponse.json = function <T>(body: T, init?: ResponseInit) {
  const response = new Response(JSON.stringify(body), init);
  Object.setPrototypeOf(response, NextResponse.prototype);
  return response as NextResponse<T>;
};

class MockRequestCookies {
  get() { return null; }
  getAll() { return []; }
  has() { return false; }
}

class TestNextRequest {
  protected _url: URL;
  public cookies: MockRequestCookies;

  constructor(input: string | URL) {
    this._url = input instanceof URL ? input : new URL(input);
    this.cookies = new MockRequestCookies();
  }

  get url(): string {
    return this._url.toString();
  }

  get nextUrl(): URL {
    return this._url;
  }
}

describe('Proxy API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original NextResponse
    Object.assign(NextResponse, originalNextResponse);
  });

  it('should return 400 if url parameter is missing', async () => {
    const request = new TestNextRequest('http://localhost/api/proxy') as unknown as NextRequest;
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('URL parameter is required');
  });

  it('should proxy PDF file successfully', async () => {
    const mockBlob = new Blob(['test pdf content'], { type: 'application/pdf' });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: new Headers({
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="test.pdf"'
      })
    });

    const request = new TestNextRequest(
      'http://localhost/api/proxy?url=http://43.227.20.36:82/DigitalLibrary/Old%20Question%20Papers/test.pdf'
    ) as unknown as NextRequest;
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="test.pdf"');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const request = new TestNextRequest(
      'http://localhost/api/proxy?url=http://43.227.20.36:82/DigitalLibrary/Old%20Question%20Papers/test.pdf'
    ) as unknown as NextRequest;
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to proxy request');
    expect(data.details).toBe('Network error');
  });
}); 