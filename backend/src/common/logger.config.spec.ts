import type { IncomingMessage, ServerResponse } from 'node:http';
import { requestId } from './logger.config.js';

function call(incoming?: string) {
  const headers: Record<string, string> = {};
  const res = { setHeader: (name: string, value: string) => (headers[name] = value) } as unknown as ServerResponse;
  const req = { headers: incoming === undefined ? {} : { 'x-request-id': incoming } } as IncomingMessage;
  return { id: requestId(req, res), header: headers['X-Request-Id'] };
}

describe('requestId', () => {
  it('reuses a safe incoming id and echoes it', () => {
    expect(call('gateway-42.abc_1')).toEqual({ id: 'gateway-42.abc_1', header: 'gateway-42.abc_1' });
  });

  it.each([undefined, '', 'x'.repeat(65), 'evil\nInjected: header', '<script>'])('generates a UUID instead of %j', (incoming) => {
    const { id, header } = call(incoming);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(header).toBe(id);
  });
});
