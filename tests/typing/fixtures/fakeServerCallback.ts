import { fakeServer } from '../../../src/testing';

fakeServer()
    .on('POST', '/api/users', (request) => ({ id: 43, ...request.json<object>() }), 201)
    // @ts-expect-error the callback parameter is a ReceivedRequest, which has no `nope`
    .on('GET', '/api/users/1', (request) => request.nope);
