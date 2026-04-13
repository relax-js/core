import { reportError } from './errors';

/**
 * Generic constructor type used for dependency registration and injection.
 * Represents any class constructor that can be used with the DI container.
 *
 * @template T - The type of object the constructor creates
 *
 * @example
 * // Use with service registration
 * class UserService {}
 * const ctor: Constructor<UserService> = UserService;
 * serviceCollection.registerByType(ctor, { inject: [] });
 */
export type Constructor<T extends object = object> = new (...args: any[]) => T;

/**
 * Controls how service instances are shared across the container hierarchy.
 * Used when registering services to define their lifetime behavior.
 *
 * - `global`: Single instance shared everywhere (singleton pattern)
 * - `closest`: New instance per container scope (scoped lifetime)
 *
 * @example
 * // Singleton service - same instance everywhere
 * serviceCollection.register(LoggerService, { scope: 'global', inject: [] });
 *
 * // Scoped service - new instance per scope
 * serviceCollection.register(RequestContext, { scope: 'closest', inject: [] });
 */
export type ServiceScope = 'global' | 'closest';

/**
 * Configuration options for registering a service in the DI container.
 * Controls identification, lifetime, and dependency resolution.
 *
 * @example
 * // Register with constructor injection
 * const options: RegistrationOptions = {
 *     scope: 'global',
 *     inject: [DatabaseConnection, ConfigService]
 * };
 * serviceCollection.register(UserRepository, options);
 *
 * @example
 * // Register with property injection
 * const options: RegistrationOptions = {
 *     inject: [],
 *     properties: { logger: Logger, config: 'appConfig' }
 * };
 *
 * @example
 * // Register with a pre-created instance
 * const options: RegistrationOptions = {
 *     inject: [],
 *     instance: existingService
 * };
 */
export interface RegistrationOptions {
    /** Service lifetime - 'global' for singleton, 'closest' for scoped */
    scope?: ServiceScope;
    /** Optional string key for resolving by name instead of type */
    key?: string;
    /** Pre-existing instance to use instead of creating new one */
    instance?: unknown;
    /** Types or keys for constructor parameters, in order */
    inject: (string | Constructor)[];
    /** Map of property names to their injection types/keys */
    properties?: Record<string, string | Constructor>;
}

/**
 * Field decorator that injects a service from the global DI container.
 * The service is resolved when the class instance is created (not at class definition time),
 * so services must be registered before the first instance is created.
 *
 * Works with web components regardless of how they are created:
 * - By the browser (HTML parsing): services are resolved during construction
 * - By application code (`document.createElement` or `new`): same behavior
 * - Injected fields are available in `connectedCallback` and all lifecycle methods
 *
 * @example
 * // Using `@Inject` in a web component
 * class UserPanel extends HTMLElement {
 *     @Inject(UserService)
 *     private userService!: UserService;
 *
 *     connectedCallback() {
 *         // userService is already resolved and ready to use
 *         const user = this.userService.getCurrentUser();
 *         this.render(user);
 *     }
 * }
 *
 * @example
 * // Services must be registered before components are created.
 * // In your app entry point (e.g. main.ts):
 * serviceCollection.registerByType(UserService, { inject: [ApiClient] });
 * serviceCollection.registerByType(ApiClient, { inject: [] });
 *
 * // Now components can be created (by browser or code)
 * customElements.define('user-panel', UserPanel);
 */
export function Inject<T extends object>(typeOrKey: Constructor<T> | string) {
    return (_: undefined, context: ClassFieldDecoratorContext) => {
        return function(this: any) {
            return container.resolve(typeOrKey);
        };
    };
}

// Temporary collector of property injections - cleared after registration
//const propertyCollector = new WeakMap<object, Record<string, string>>();

/**
 * Class decorator that registers a service in the global DI container.
 * Registration happens at class definition time (when the module loads),
 * so import the module before creating instances that depend on this service.
 *
 * For web components: use `@ContainerService` on services, not on the
 * components themselves. Components use `@Inject` to consume services.
 *
 * @param options - Registration configuration including scope and dependencies
 *
 * @example
 * // Register a service that components can inject
 * @ContainerService({ inject: [ApiClient] })
 * class UserService {
 *     constructor(private api: ApiClient) {}
 *     getCurrentUser() { return this.api.get('/user'); }
 * }
 *
 * // Component consumes the service
 * class UserPanel extends HTMLElement {
 *     @Inject(UserService)
 *     private userService!: UserService;
 * }
 *
 * @example
 * // Service with custom key for named resolution
 * @ContainerService({ key: 'primaryCache', scope: 'global', inject: [] })
 * class CacheService {}
 *
 * // Later resolve by key
 * const cache = container.resolve('primaryCache');
 */
export function ContainerService<T extends object>(
    options?: RegistrationOptions
) {
    return (target: Constructor<T>) => {
        const opts = options ?? {inject: []};

        if (opts.key) {
            serviceCollection.register(target, opts);
        } else {
            serviceCollection.registerByType(target, opts);
        }
    };
}

/**
 * Internal class representing a registered service's metadata.
 * Holds all information needed to create and configure service instances.
 *
 * @internal This is an implementation detail and should not be used directly.
 */
class Registration {
    /**
     * Creates a new registration record.
     *
     * @param classConstructor - The class constructor function
     * @param scope - Instance sharing behavior
     * @param inject - Constructor parameter dependencies
     * @param properties - Property injection mappings
     * @param key - Optional string identifier
     * @param instance - Optional pre-created instance
     */
    constructor(
        public classConstructor: Constructor,
        public scope: ServiceScope,
        public inject: (string | Constructor)[],
        public properties: Record<string, string | Constructor> = {},
        public key?: string,
        public instance?: unknown
    ) {}
}

/**
 * Registry that stores service registration metadata.
 * Use this to register services before they can be resolved by a ServiceContainer.
 *
 * Typically you'll use the global `serviceCollection` instance rather than creating your own.
 *
 * @example
 * // Register a service by type
 * serviceCollection.registerByType(LoggerService, { inject: [] });
 *
 * // Register with a string key
 * serviceCollection.register(CacheService, { key: 'cache', inject: [] });
 *
 * // Check if service is registered
 * const reg = serviceCollection.tryGet(LoggerService);
 * if (reg) {
 *     console.log('Logger is registered');
 * }
 */
export class ServiceCollection {
    private servicesByKey = new Map<string, Registration>();
    private servicesByClassName = new Map<string, Registration>();

    /**
     * Registers a service with full configuration options.
     * The service will be resolvable by both its class name and optional key.
     *
     * @param constructor - The service class constructor
     * @param options - Registration configuration
     */
    register<T extends object>(constructor: Constructor<T>, options: RegistrationOptions): void {
        this.validateRegistration(constructor, options);

        const reg = new Registration(
            constructor,
            options.scope ?? 'global',
            options.inject,
            options.properties ?? {},
            options.key,
            options.instance
        );

        if (options.key) {
            this.servicesByKey.set(options.key, reg);
        }
        this.servicesByClassName.set(constructor.name, reg);
    }

    /**
     * Registers a service by its class type.
     * The service will be resolvable by its class constructor.
     *
     * @param constructor - The service class constructor
     * @param options - Optional registration configuration
     */
    registerByType<T extends object>(
        constructor: Constructor<T>,
        options?: RegistrationOptions
    ): void {
        this.checkNameCollision(constructor);
        if (options) this.validateRegistration(constructor, options);

        const reg = new Registration(constructor, options?.scope ?? 'global', options?.inject ?? [], options?.properties, options?.key, options?.instance);
        if (options?.key) {
            this.servicesByKey.set(options.key, reg);
        }
        this.servicesByClassName.set(constructor.name, reg);
    }

    private checkNameCollision<T extends object>(constructor: Constructor<T>): void {
        const existing = this.servicesByClassName.get(constructor.name);
        if (existing && existing.classConstructor !== constructor) {
            const error = reportError('Service name collision: different class registered with same name', {
                service: constructor.name,
            });
            if (error) throw error;
        }
    }

    private validateRegistration<T extends object>(constructor: Constructor<T>, options: RegistrationOptions): void {
        this.checkNameCollision(constructor);

        if (options.key) {
            const existingByKey = this.servicesByKey.get(options.key);
            if (existingByKey && existingByKey.classConstructor !== constructor) {
                const error = reportError('Service key already registered to a different class', {
                    key: options.key,
                    existingClass: existingByKey.classConstructor.name,
                    newClass: constructor.name,
                });
                if (error) throw error;
            }
        }

        if (options.instance && options.inject.length > 0) {
            const error = reportError('Service has both instance and inject (inject will be ignored)', {
                service: constructor.name,
            });
            if (error) throw error;
        }
    }

    /**
     * Attempts to retrieve a service registration.
     * Returns undefined if the service is not registered.
     *
     * @param key - Either a string key or class constructor
     * @returns The registration or undefined
     */
    tryGet<T extends object>(key: string | Constructor<T>): Registration | undefined {
        if (typeof key === 'string') {
            return this.servicesByKey.get(key);
        }
        return this.servicesByClassName.get(key.name);
    }

    /**
     * Retrieves a service registration or throws if not found.
     *
     * @param key - Either a string key or class constructor
     * @returns The registration
     * @throws Error if the service is not registered
     */
    get<T extends object>(key: string | Constructor<T>): Registration {
        const reg = this.tryGet(key);
        if (!reg) {
            const service = typeof key === 'string' ? key : key.name;
            const error = reportError(`Failed to resolve service '${service}'`, {
                service,
                registeredTypes: Array.from(this.servicesByClassName.keys()),
                registeredKeys: Array.from(this.servicesByKey.keys()),
            });
            if (error) throw error;
        }
        return reg!;
    }
}

/**
 * Internal storage for tracking injected fields during service resolution.
 * @internal
 */
const injectedFields = new WeakMap<object, Map<string, string>>();

/**
 * IoC container that resolves and manages service instances.
 * Creates instances based on registrations in a ServiceCollection,
 * handling constructor injection, property injection, and lifetime management.
 *
 * Typically you'll use the global `container` instance rather than creating your own.
 *
 * @example
 * // Resolve a service by class
 * const logger = container.resolve(LoggerService);
 *
 * // Resolve by string key
 * const cache = container.resolve<CacheService>('primaryCache');
 *
 * @example
 * // Full setup workflow
 * serviceCollection.register(UserService, {
 *     inject: [DatabaseConnection],
 *     scope: 'global'
 * });
 *
 * const userService = container.resolve(UserService);
 */
export class ServiceContainer {
    private instances = new Map<string, any>();

    /**
     * Creates a new container backed by the given service collection.
     *
     * @param serviceCollection - The registry containing service registrations
     */
    constructor(private serviceCollection: ServiceCollection) {}

    /**
     * Resolves a service instance by class type or string key.
     * Creates the instance if not already cached (for global scope).
     * Handles constructor and property injection automatically.
     *
     * @param keyOrType - Either a string key or class constructor
     * @returns The resolved service instance
     * @throws Error if the service is not registered
     *
     * @example
     * const service = container.resolve(MyService);
     */
    resolve<T extends object>(keyOrType: string | Constructor<T>): T {
        const key = typeof keyOrType === 'string' ? keyOrType : keyOrType.name;

        if (this.instances.has(key)) {
            return this.instances.get(key);
        }

        const registration = this.serviceCollection.get(keyOrType);
        if (!registration) {
            const error = reportError(`Failed to resolve service '${key}'`, { service: key });
            if (error) throw error;
            return undefined as unknown as T;
        }

        if (registration.instance) {
            const inst = registration.instance as T;
            this.injectFields(inst, registration);
            this.instances.set(key, inst);
            return inst;
        }

        const instance = this.createInstance<T>(registration);
        if (registration.scope === 'global') {
            this.instances.set(key, instance);
        }
        this.injectFields(instance, registration);

        return instance;
    }

    /**
     * Creates a new instance of a service, resolving all constructor dependencies.
     */
    private createInstance<T extends object>(registration: Registration): T {
        const constructor = registration.classConstructor as Constructor<T>;

        const dependencies = registration.inject.map(dep => this.resolve(dep));
        return new constructor(...dependencies);
    }

    /**
     * Injects dependencies into instance properties based on registration config.
     */
    private injectFields<T extends object>(instance: T, registration: Registration): void {
        for (const [fieldName, keyOrType] of Object.entries(registration.properties)) {
            (instance as any)[fieldName] = this.resolve(keyOrType);
        }
    }
}

/**
 * Global service collection instance for registering services.
 * Use this to register services that can later be resolved by the container.
 *
 * @example
 * import { serviceCollection } from 'relaxjs';
 *
 * serviceCollection.register(MyService, { inject: [Dependency] });
 */
export const serviceCollection = new ServiceCollection();

/**
 * Global service container instance for resolving dependencies.
 * Use this to obtain service instances with all dependencies injected.
 *
 * @example
 * import { container } from 'relaxjs';
 *
 * const service = container.resolve(MyService);
 */
export const container = new ServiceContainer(serviceCollection);