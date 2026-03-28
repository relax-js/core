import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    configure,
    setFetch,
    request,
    get,
    post,
    put,
    del,
    HttpError,
    HttpResponse,
} from '../../src/http/http';

function createMockResponse(
    body: unknown,
    status = 200,
    statusText = 'OK',
    contentType = 'application/json'
): Response {
    const headers = new Headers();
    headers.set('content-type', contentType);

    return {
        ok: status >= 200 && status < 300,
        status,
        statusText,
        headers,
        json: async () => body,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    } as Response;
}

describe('http module', () => {
    let mockFetch: ReturnType<typeof vi.fn>;
    let mockLocalStorage: { [key: string]: string };

    beforeEach(() => {
        mockFetch = vi.fn();
        setFetch(mockFetch);

        mockLocalStorage = {};
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => mockLocalStorage[key] ?? null,
            setItem: (key: string, value: string) => {
                mockLocalStorage[key] = value;
            },
            removeItem: (key: string) => {
                delete mockLocalStorage[key];
            },
        });

        configure({ baseUrl: undefined, contentType: undefined, bearerTokenName: 'jwt' });
    });

    afterEach(() => {
        setFetch();
        vi.unstubAllGlobals();
    });

    describe('configure', () => {
        it('should set baseUrl for requests', async () => {
            configure({ baseUrl: '/api' });
            mockFetch.mockResolvedValue(createMockResponse({ id: 1 }));

            await get('/users');

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/users',
                expect.any(Object)
            );
        });

        it('should handle baseUrl without trailing slash and url without leading slash', async () => {
            configure({ baseUrl: '/api' });
            mockFetch.mockResolvedValue(createMockResponse({ id: 1 }));

            await get('users');

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/users',
                expect.any(Object)
            );
        });

        it('should set default content type', async () => {
            configure({ contentType: 'text/plain' });
            mockFetch.mockResolvedValue(createMockResponse('ok'));

            await get('/test');

            expect(mockFetch).toHaveBeenCalledWith(
                '/test',
                expect.objectContaining({
                    headers: { 'content-type': 'text/plain' },
                })
            );
        });

        it('should use jwt as default bearer token name', async () => {
            mockLocalStorage['jwt'] = 'test-token';
            mockFetch.mockResolvedValue(createMockResponse({ id: 1 }));

            await get('/users');

            const call = mockFetch.mock.calls[0];
            const headers = call[1].headers as Headers;
            expect(headers.get('Authorization')).toBe('Bearer test-token');
        });

        it('should use custom bearer token name', async () => {
            configure({ bearerTokenName: 'auth_token' });
            mockLocalStorage['auth_token'] = 'custom-token';
            mockFetch.mockResolvedValue(createMockResponse({ id: 1 }));

            await get('/users');

            const call = mockFetch.mock.calls[0];
            const headers = call[1].headers as Headers;
            expect(headers.get('Authorization')).toBe('Bearer custom-token');
        });

        it('should disable bearer token when set to null', async () => {
            configure({ bearerTokenName: null });
            mockLocalStorage['jwt'] = 'should-not-be-used';
            mockFetch.mockResolvedValue(createMockResponse({ id: 1 }));

            await get('/users');

            const call = mockFetch.mock.calls[0];
            const headers = call[1].headers;
            expect(headers).toEqual({ 'content-type': 'application/json' });
        });
    });

    describe('setFetch', () => {
        it('should use custom fetch implementation', async () => {
            const customFetch = vi.fn().mockResolvedValue(createMockResponse({ custom: true }));
            setFetch(customFetch);

            await get('/test');

            expect(customFetch).toHaveBeenCalled();
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('request', () => {
        it('should return successful response with body', async () => {
            const responseBody = { id: 1, name: 'Test' };
            mockFetch.mockResolvedValue(createMockResponse(responseBody));

            const response = await request('/test', { method: 'GET' });

            expect(response.success).toBe(true);
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual(responseBody);
        });

        it('should cast body using as<T>()', async () => {
            interface User {
                id: number;
                name: string;
            }
            const responseBody = { id: 1, name: 'Test' };
            mockFetch.mockResolvedValue(createMockResponse(responseBody));

            const response = await request('/test', { method: 'GET' });
            const user = response.as<User>();

            expect(user.id).toBe(1);
            expect(user.name).toBe('Test');
        });

        it('should handle 204 No Content response', async () => {
            const response204 = {
                ok: true,
                status: 204,
                statusText: 'No Content',
                headers: new Headers(),
                json: async () => null,
                text: async () => '',
            } as Response;
            mockFetch.mockResolvedValue(response204);

            const response = await request('/test', { method: 'DELETE' });

            expect(response.success).toBe(true);
            expect(response.statusCode).toBe(204);
            expect(response.body).toBe(null);
        });

        it('should handle error response', async () => {
            const errorResponse = createMockResponse(
                'Not Found',
                404,
                'Not Found'
            );
            mockFetch.mockResolvedValue(errorResponse);

            const response = await request('/test', { method: 'GET' });

            expect(response.success).toBe(false);
            expect(response.statusCode).toBe(404);
            expect(response.statusReason).toBe('Not Found');
        });

        it('should throw when calling as() on error response', async () => {
            const errorResponse = createMockResponse('Error', 500, 'Server Error');
            mockFetch.mockResolvedValue(errorResponse);

            const response = await request('/test', { method: 'GET' });

            expect(() => response.as()).toThrow('No response received');
        });

        it('should not add Authorization header if already present', async () => {
            mockLocalStorage['jwt'] = 'test-token';
            mockFetch.mockResolvedValue(createMockResponse({ id: 1 }));

            const existingHeaders = new Headers();
            existingHeaders.set('Authorization', 'Bearer existing-token');

            await request('/users', {
                method: 'GET',
                headers: existingHeaders,
            });

            const call = mockFetch.mock.calls[0];
            const headers = call[1].headers as Headers;
            expect(headers.get('Authorization')).toBe('Bearer existing-token');
        });
    });

    describe('get', () => {
        it('should make GET request', async () => {
            mockFetch.mockResolvedValue(createMockResponse({ id: 1 }));

            await get('/users');

            expect(mockFetch).toHaveBeenCalledWith(
                '/users',
                expect.objectContaining({ method: 'GET' })
            );
        });

        it('should append query string parameters', async () => {
            mockFetch.mockResolvedValue(createMockResponse([]));

            await get('/users', { page: '1', limit: '10' });

            expect(mockFetch).toHaveBeenCalledWith(
                '/users?page=1&limit=10',
                expect.any(Object)
            );
        });

        it('should append query string to existing query', async () => {
            mockFetch.mockResolvedValue(createMockResponse([]));

            await get('/users?sort=asc', { page: '1' });

            expect(mockFetch).toHaveBeenCalledWith(
                '/users?sort=asc&page=1',
                expect.any(Object)
            );
        });

        it('should use default content-type application/json', async () => {
            mockFetch.mockResolvedValue(createMockResponse({}));

            await get('/test');

            expect(mockFetch).toHaveBeenCalledWith(
                '/test',
                expect.objectContaining({
                    headers: { 'content-type': 'application/json' },
                })
            );
        });

        it('should use provided options', async () => {
            mockFetch.mockResolvedValue(createMockResponse({}));

            await get('/test', undefined, {
                headers: { 'X-Custom': 'value' },
            });

            expect(mockFetch).toHaveBeenCalledWith(
                '/test',
                expect.objectContaining({
                    method: 'GET',
                    headers: { 'X-Custom': 'value' },
                })
            );
        });
    });

    describe('post', () => {
        it('should make POST request with body', async () => {
            mockFetch.mockResolvedValue(createMockResponse({ id: 1 }));
            const data = JSON.stringify({ name: 'Test' });

            await post('/users', data);

            expect(mockFetch).toHaveBeenCalledWith(
                '/users',
                expect.objectContaining({
                    method: 'POST',
                    body: data,
                })
            );
        });

        it('should use default content-type application/json', async () => {
            mockFetch.mockResolvedValue(createMockResponse({}));

            await post('/test', '{}');

            expect(mockFetch).toHaveBeenCalledWith(
                '/test',
                expect.objectContaining({
                    headers: { 'content-type': 'application/json' },
                })
            );
        });

        it('should use provided options', async () => {
            mockFetch.mockResolvedValue(createMockResponse({}));

            await post('/test', '{}', {
                headers: { 'X-Custom': 'value' },
            });

            expect(mockFetch).toHaveBeenCalledWith(
                '/test',
                expect.objectContaining({
                    method: 'POST',
                    body: '{}',
                    headers: { 'X-Custom': 'value' },
                })
            );
        });
    });

    describe('put', () => {
        it('should make PUT request with body', async () => {
            mockFetch.mockResolvedValue(createMockResponse({ id: 1 }));
            const data = JSON.stringify({ name: 'Updated' });

            await put('/users/1', data);

            expect(mockFetch).toHaveBeenCalledWith(
                '/users/1',
                expect.objectContaining({
                    method: 'PUT',
                    body: data,
                })
            );
        });

        it('should use default content-type application/json', async () => {
            mockFetch.mockResolvedValue(createMockResponse({}));

            await put('/test', '{}');

            expect(mockFetch).toHaveBeenCalledWith(
                '/test',
                expect.objectContaining({
                    headers: { 'content-type': 'application/json' },
                })
            );
        });

        it('should use provided options', async () => {
            mockFetch.mockResolvedValue(createMockResponse({}));

            await put('/test', '{}', {
                headers: { 'X-Custom': 'value' },
            });

            expect(mockFetch).toHaveBeenCalledWith(
                '/test',
                expect.objectContaining({
                    method: 'PUT',
                    body: '{}',
                    headers: { 'X-Custom': 'value' },
                })
            );
        });
    });

    describe('del', () => {
        it('should make DELETE request', async () => {
            mockFetch.mockResolvedValue(createMockResponse(null, 204, 'No Content'));

            await del('/users/1');

            expect(mockFetch).toHaveBeenCalledWith(
                '/users/1',
                expect.objectContaining({
                    method: 'DELETE',
                })
            );
        });

        it('should use default content-type application/json', async () => {
            mockFetch.mockResolvedValue(createMockResponse({}));

            await del('/test');

            expect(mockFetch).toHaveBeenCalledWith(
                '/test',
                expect.objectContaining({
                    headers: { 'content-type': 'application/json' },
                })
            );
        });

        it('should use provided options', async () => {
            mockFetch.mockResolvedValue(createMockResponse({}));

            await del('/test', {
                headers: { 'X-Custom': 'value' },
            });

            expect(mockFetch).toHaveBeenCalledWith(
                '/test',
                expect.objectContaining({
                    method: 'DELETE',
                    headers: { 'X-Custom': 'value' },
                })
            );
        });
    });

    describe('HttpError', () => {
        it('should create error with response', () => {
            const response: HttpResponse = {
                statusCode: 404,
                statusReason: 'Not Found',
                success: false,
                contentType: 'application/json',
                body: 'Resource not found',
                charset: null,
                as: () => {
                    throw new Error('No response received');
                },
            };

            const error = new HttpError(response);

            expect(error.message).toBe('Not Found');
            expect(error.response).toBe(response);
            expect(error).toBeInstanceOf(Error);
        });
    });
});
