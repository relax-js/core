import { describe, test, expect, beforeEach } from 'vitest';
import { ServiceCollection, ServiceContainer } from '../src/DependencyInjection';

describe('ServiceCollection', () => {
    let collection: ServiceCollection;

    beforeEach(() => {
        collection = new ServiceCollection();
    });

    test('register stores service with options', () => {
        class TestService {}
        
        collection.register(TestService, {
            key: 'test',
            scope: 'closest',
            inject: ['dep1', 'dep2']
        });

        const reg = collection.tryGet('test');
        expect(reg).toEqual({
            classConstructor: TestService,
            key: 'test',
            scope: 'closest',
            inject: ['dep1', 'dep2'],
            properties: {},
            instance: undefined
        });
    });

    test('registerByType stores service by class name', () => {
        class TestService {}
        
        collection.registerByType(TestService, {inject: ['dep1']});

        const reg = collection.tryGet(TestService);
        expect(reg).toEqual({
            classConstructor: TestService,
            scope: undefined,
            properties: {},
            inject: ['dep1'],
            key: undefined,
            instance: undefined
        });
    });

    test('throws on name collision from different classes', () => {
        class MyService {}
        collection.registerByType(MyService);

        // Different class with same name
        const OtherClass = { name: 'MyService' } as any;
        expect(() => collection.registerByType(OtherClass))
            .toThrow(/name collision/);
    });

    test('allows re-registering the same class', () => {
        class MyService {}
        collection.registerByType(MyService);

        expect(() => collection.registerByType(MyService))
            .not.toThrow();
    });

    test('throws on key collision from different classes', () => {
        class ServiceA {}
        class ServiceB {}
        collection.register(ServiceA, { key: 'shared', inject: [] });

        expect(() => collection.register(ServiceB, { key: 'shared', inject: [] }))
            .toThrow(/key already registered/);
    });

    test('throws when instance and inject are both provided', () => {
        class MyService {}
        expect(() => collection.register(MyService, {
            inject: [class Dep {}],
            instance: new MyService(),
        })).toThrow(/both instance and inject/);
    });

    test('registerByType stores key in servicesByKey', () => {
        class MyService {}
        collection.registerByType(MyService, { key: 'myKey', inject: [] });

        expect(collection.tryGet('myKey')).toBeDefined();
        expect(collection.tryGet(MyService)).toBeDefined();
    });

    test('get throws with known services in error context', () => {
        class Service1 {}
        class Service2 {}

        collection.registerByType(Service1);
        collection.register(Service2, { key: 'service2', inject: [] });

        try {
            collection.get('unknown');
        } catch (e: any) {
            expect(e.message).toBe("Failed to resolve service 'unknown'");
            expect(e.context.service).toBe('unknown');
            expect(e.context.registeredTypes).toContain('Service1');
            expect(e.context.registeredKeys).toContain('service2');
            return;
        }
        expect.unreachable('should have thrown');
    });
});

describe('ServiceContainer', () => {
    let collection: ServiceCollection;
    let container: ServiceContainer;

    beforeEach(() => {
        collection = new ServiceCollection();
        container = new ServiceContainer(collection);
    });

    test('resolves service without dependencies', () => {
        class TestService {}
        collection.registerByType(TestService);

        const service = container.resolve(TestService);
        expect(service).toBeInstanceOf(TestService);
    });

    test('resolves service with dependencies', () => {
        class Dependency {}
        class TestService {
            constructor(public dep: Dependency) {}
        }

        collection.registerByType(Dependency);
        collection.registerByType(TestService, {inject: [Dependency]});

        const service = container.resolve(TestService);
        expect(service.dep).toBeInstanceOf(Dependency);
    });

    test('caches global scoped instances', () => {
        class TestService {}
        collection.registerByType(TestService);

        const service1 = container.resolve(TestService);
        const service2 = container.resolve(TestService);
        expect(service1).toStrictEqual(service2);
    });

    // test.only('creates new instances for closest scope', () => {
    //     class TestService {}
    //     collection.registerByType(TestService, [], 'closest');

    //     const service1 = container.resolve(TestService);
    //     const service2 = container.resolve(TestService);
    //     expect(service1).not.toBe(service2);
    // });

    test('uses pre-configured instance', () => {
        class TestService {}
        const instance = new TestService();
        
        collection.register(TestService, {
            inject: [],
            instance
        });

        expect(container.resolve(TestService)).toBe(instance);
    });

    test('resolves deep dependency chain', () => {
        class ServiceA {}
        class ServiceB {
            constructor(public a: ServiceA) {}
        }
        class ServiceC {
            constructor(public b: ServiceB) {}
        }

        collection.registerByType(ServiceA);
        collection.registerByType(ServiceB, {inject: [ServiceA]});
        collection.registerByType(ServiceC, {inject: [ServiceB]});

        const serviceC = container.resolve(ServiceC);
        expect(serviceC.b).toBeInstanceOf(ServiceB);
        expect(serviceC.b.a).toBeInstanceOf(ServiceA);
    });

    test('applies property injection to pre-created instance', () => {
        class Logger { log() {} }
        class MyService { logger?: Logger; }

        collection.registerByType(Logger);
        const instance = new MyService();
        collection.register(MyService, {
            inject: [],
            instance,
            properties: { logger: Logger },
        });

        const resolved = container.resolve(MyService);
        expect(resolved).toBe(instance);
        expect(resolved.logger).toBeInstanceOf(Logger);
    });

    test('property injection resolves by constructor type', () => {
        class Logger { log() {} }
        class MyService { logger?: Logger; }

        collection.registerByType(Logger);
        collection.registerByType(MyService, {
            inject: [],
            properties: { logger: Logger },
        });

        const resolved = container.resolve(MyService);
        expect(resolved.logger).toBeInstanceOf(Logger);
    });

    test('throws on missing dependency', () => {
        class Missing {}
        class TestService {
            constructor(dep: Missing) {}
        }

        collection.registerByType(TestService, {inject: [Missing]});

        expect(() => container.resolve(TestService))
            .toThrow(/Failed to resolve/);
    });

    test('throws on circular dependency', () => {
        class ServiceA {
            constructor(public b: ServiceB) {}
        }
        class ServiceB {
            constructor(public a: ServiceA) {}
        }

        collection.registerByType(ServiceA, {inject: [ServiceB]});
        collection.registerByType(ServiceB, {inject: [ServiceA]});

        expect(() => container.resolve(ServiceA))
            .toThrow();
    });
});