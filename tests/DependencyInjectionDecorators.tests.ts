import { describe, test, expect } from 'vitest';
import { container, ContainerService, Inject, serviceCollection } from '../src/DependencyInjection';

class Logger {
    log(msg: string) {}
}

class Database {
    query(sql: string) {}
}

describe('ContainerService Decorator', () => {
    test('no constructor params requires empty inject array', () => {
        @ContainerService({
            inject: []
        })
        class SimpleService {
            constructor() {}
        }

        const registration = serviceCollection.tryGet(SimpleService);
        expect(registration?.inject).toEqual([]);
    });

    test('requires constructor injection types', () => {
        @ContainerService({
            inject: [Database, Logger]
        })
        class TypedInjectionService {
            constructor(db: Database, logger: Logger) {}
        }

        const registration = serviceCollection.tryGet(TypedInjectionService);
        expect(registration?.classConstructor).toBe(TypedInjectionService);
        expect(registration?.inject).toEqual([Database, Logger]);
    });

    test('registers with key and injection', () => {
        @ContainerService({
            key: 'users',
            inject: [Database]
        })
        class KeyedUserService {
            constructor(db: Database) {}
        }

        const registration = serviceCollection.tryGet('users');
        expect(registration?.classConstructor).toBe(KeyedUserService);
        expect(registration?.key).toBe('users');
        expect(registration?.inject).toEqual([Database]);
    });

    test('supports string keys for injection', () => {
        @ContainerService({
            inject: ['customDb', 'fileLogger']
        })
        class StringKeyService {
            constructor(db: Database, logger: Logger) {}
        }

        const registration = serviceCollection.tryGet(StringKeyService);
        expect(registration?.inject).toEqual(['customDb', 'fileLogger']);
    });

    test('handles all registration options', () => {
        @ContainerService({
            key: 'admin',
            scope: 'closest',
            inject: [Database, Logger],
        })
        class AdminService {
            constructor(db: Database, logger: Logger) {}
        }

        const registration = serviceCollection.tryGet('admin');
        expect(registration?.key).toBe('admin');
        expect(registration?.scope).toBe('closest');
        expect(registration?.inject).toEqual([Database, Logger]);
    });
});

describe('Inject Property Decorator', () => {
    test('requires explicit type for property injection', () => {
        serviceCollection.registerByType(Logger);
        @ContainerService({
            inject: []
        })
        class TypedPropertyService {
            @Inject(Logger)
            private logger!: Logger;
        }

        const injectedLogger = container.resolve(TypedPropertyService)['logger'];
        expect(injectedLogger).toBeInstanceOf(Logger);
    });

    test('supports string key for property injection', () => {
        serviceCollection.register(Logger, {key: 'customLogger', inject: []});
        @ContainerService({
            inject: []
        })
        class StringKeyPropertyService {
            @Inject('customLogger')
            private logger!: Logger;

            Do(){
                this.logger?.log('hello');
            }
        }

        var service=container.resolve(StringKeyPropertyService);
        service.Do();
        console.log(service);
        const injectedLogger = container.resolve(StringKeyPropertyService)['logger'];
        expect(injectedLogger).toBeInstanceOf(Logger);
    });

    test('resolves_per_instance_not_at_class_definition_time', () => {
        // Register service AFTER class is defined to prove lazy resolution
        class LateService {
            value = 'resolved';
        }

        // Define class with @Inject before registering LateService
        class Consumer {
            @Inject(LateService)
            private service!: LateService;

            getValue() { return this.service.value; }
        }

        // Register after class definition
        serviceCollection.registerByType(LateService);

        // Creating an instance should resolve the service
        const instance = new Consumer();
        expect(instance.getValue()).toBe('resolved');
    });

    test('each_instance_gets_service_resolved_independently', () => {
        class CountingService {
            static instanceCount = 0;
            id: number;
            constructor() { this.id = ++CountingService.instanceCount; }
        }

        serviceCollection.registerByType(CountingService, {
            scope: 'closest',
            inject: [],
        });

        class MyComponent {
            @Inject(CountingService)
            private service!: CountingService;

            getServiceId() { return this.service.id; }
        }

        const a = new MyComponent();
        const b = new MyComponent();

        // With 'closest' scope, each resolution creates a new instance
        expect(a.getServiceId()).not.toBe(b.getServiceId());
    });
});
