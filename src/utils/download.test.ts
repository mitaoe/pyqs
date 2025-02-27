import { downloadFile } from './download';
import { toast } from 'sonner';

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn()
  }
}));

describe('downloadFile utility', () => {
  const mockCreateObjectURL = jest.fn();
  const mockRevokeObjectURL = jest.fn();
  const mockAppendChild = jest.fn();
  const mockRemoveChild = jest.fn();
  const mockClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
    
    document.body.appendChild = mockAppendChild;
    document.body.removeChild = mockRemoveChild;

    const mockLink = {
      click: mockClick,
      download: '',
      href: ''
    };
    mockAppendChild.mockImplementation((link) => {
      Object.assign(mockLink, link);
      mockLink.click();
      return mockLink;
    });
  });

  it('should download file successfully', async () => {
    const mockBlob = new Blob(['test content'], { type: 'application/pdf' });
    mockCreateObjectURL.mockReturnValue('blob:test-url');

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: new Headers({
        'content-disposition': 'attachment; filename="server-test.pdf"'
      })
    });

    const result = await downloadFile('http://43.227.20.36:82/test.pdf', 'test.pdf');

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('/api/proxy?url=http%3A%2F%2F43.227.20.36%3A82%2Ftest.pdf');
    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });

  it('should handle download failures', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const result = await downloadFile('http://43.227.20.36:82/test.pdf', 'test.pdf');

    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Failed to download file. Please try again.');
  });

  it('should use fallback filename if content-disposition is missing', async () => {
    const mockBlob = new Blob(['test content'], { type: 'application/pdf' });
    mockCreateObjectURL.mockReturnValue('blob:test-url');

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: new Headers()
    });

    await downloadFile('http://43.227.20.36:82/test.pdf', 'fallback.pdf');

    expect(mockAppendChild).toHaveBeenCalled();
    const linkElement = mockAppendChild.mock.calls[0][0];
    expect(linkElement.download).toBe('fallback.pdf');
  });
}); 