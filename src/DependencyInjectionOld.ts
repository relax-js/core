import { reflect } from './Metadata';

export type Constructor<T = object> = new (...args: any[]) => T;

export function Inject<T>(
    keyOrType?: string | Constructor<T>
): PropertyDecorator & ParameterDecorator {
    return (
        target: Object,
        propertyKey?: string | symbol,
        parameterIndex?: number
    ) => {
      logger('DI Requesting injection for ', propertyKey, target);
        const key = resolveInjectionKey(
            target,
            propertyKey,
            parameterIndex,
            keyOrType
        );

        logger('DI Resolved key: ' + key);
        // if (propertyKey) {
        //     Object.defineProperty(target, propertyKey, {
        //         get() {
        //             var service = container.resolve(key);
        //             logger('DI: Resolving service ' + service);
        //             if (!service) {
        //                 throw new Error("'Failed to lookup " + key);
        //             }
        //             return service;
        //         }
        //     });
        // }
        var service = container.resolve(key);
        (target as any)[propertyKey] = service;
        console.log('set ' + key + " on " + target);

    };
}

export interface RegistrationOptions {
    scope?: ServiceScope;
    key?: string;
    instance?: unknown;
}

let logger = (...msg: any[]) => {};

export function setDebugFunc(func: (...msg: any[]) => {}) {
    logger = func;
}

logger = console.log;

export class ServiceCollection {
    private servicesByKey = new Map<string, Registration>();
    private servicesByClassName = new Map<string, Registration>();

    register<T>(
        constructor: Constructor<T>,
        options: RegistrationOptions
    ): void {
        var reg = new Registration(
            <Constructor>constructor,
            options.scope ?? 'global',
            options.key,
            options.instance
        );
        if (options.key) {
            logger('DI: registering by options key: ' + options.key, options);
            this.servicesByKey.set(options.key, reg);
        }

        logger(
            'DI: registering by constructor name: ' + constructor.name,
            options
        );
        this.servicesByClassName.set(constructor.name, reg);
    }

    registerByType<T>(constructor: Constructor<T>, scope?: ServiceScope): void {
        var reg = new Registration(<Constructor>constructor, scope ?? 'global');
        logger('DI: registerByType: ' + constructor.name);
        this.servicesByClassName.set(constructor.name, reg);
    }

    tryGet<T>(key: string | Constructor<T>): Registration | undefined {
        let reg: Registration | undefined = undefined;
        if (typeof key === 'string') {
            logger('DI: tryGet (by key): ' + key);
            reg = this.servicesByKey.get(key);
        } else {
            logger('DI: tryGet (by constructor): ' + key.name);
            reg = this.servicesByClassName.get(key.name);
        }

        if (!reg) {
            return undefined;
        }

        return reg;
    }

    get<T>(key: string | Constructor<T>): Registration {
        var reg = this.tryGet(key);
        if (!reg) {
            throw new Error(
                'Failed to resovle ' +
                    key +
                    ', known classKeys: ' +
                    Array.from(this.servicesByClassName.keys()).join(', ') +
                    ', known strKeys: ' +
                    Array.from(this.servicesByKey.keys()).join(', ')
            );
        }

        return reg;
    }
}

export type ServiceScope = 'global' | 'closest';

export function ContainerService<T>(
    key?: string,
    scope?: ServiceScope
): (target: Constructor<T>) => void {
    return (target: Constructor<T>) => {
      console.log('requesting egistration');
        if (!key) {
            serviceCollection.registerByType(target, scope);
        } else {
            serviceCollection.register(target, { key, scope });
        }
    };
}

export class ServiceContainer {
    private instances = new Map<string, any>();
    private serviceCollection: ServiceCollection;

    constructor(serviceCollection: ServiceCollection) {
        this.serviceCollection = serviceCollection;
    }

    resolve<T>(keyOrType: string | Constructor<T>): T {
        const key = typeof keyOrType === 'string' ? keyOrType : keyOrType.name;

        if (this.instances.has(key)) {
            return this.instances.get(key);
        }

        const registration = this.serviceCollection.get(keyOrType);
        if (!registration) {
            throw new Error(`Service '${key}' not found.`);
        }

        if (registration.instance) {
            return <T>registration.instance;
        }

        const constructor = <Constructor<T>>registration.classConstructor;

        const paramTypes: Constructor[] =
            (Reflect.getMetadata &&
                Reflect.getMetadata('design:paramtypes', constructor)) ||
            [];
        const dependencies = paramTypes.map((type, index) => {
            const injectKey =
                reflect.getMetadata(
                    `inject:constructorParam:${index}`,
                    constructor
                ) || (type ? type.name : undefined);
            if (!injectKey) {
                throw new Error(
                    `Cannot resolve dependency at index ${index} for '${constructor.name}'`
                );
            }
            return this.resolve(injectKey);
        });

        const instance = new constructor(...dependencies);
        this.enrich(instance);
        this.instances.set(key, instance);
        return <T>instance;
    }

    enrich<T>(instance: T): void {
        const prototype = Object.getPrototypeOf(instance);

        for (const key of Object.getOwnPropertyNames(prototype)) {
            const injectKey = reflect.getMetadata(
                'inject:key',
                prototype.constructor,
                key
            );
            if (injectKey) {
                (instance as any)[key] = this.resolve(injectKey);
            }
        }
    }
}

export let serviceCollection: ServiceCollection = new ServiceCollection();
export let container = new ServiceContainer(serviceCollection);

function resolveInjectionKey<T>(
    target: Object,
    propertyKey?: string | symbol,
    parameterIndex?: number,
    keyOrType?: string | Constructor<T>
): string | Constructor<T> {
    if (keyOrType) {
        return keyOrType;
    }

    if (typeof parameterIndex === 'number') {
        return inferConstructorParamType(target, parameterIndex);
    } else if (propertyKey) {
        return inferPropertyType(target, propertyKey);
    }

    throw new Error(
        `Unable to resolve injection key, propKey: ${propertyKey?.toString()}, keyOrType: ${keyOrType}, target: ${
            target.constructor.name
        }`
    );
}

function inferConstructorParamType(
    target: Object,
    parameterIndex: number
): string {
    const paramTypes = reflect.getMetadata('design:paramtypes', target);
    if (!paramTypes || !paramTypes[parameterIndex]) {
        throw new Error(
            `Unable to infer the type of constructor parameter at index ${parameterIndex}, target: ${target.constructor.name}.`
        );
    }
    return paramTypes[parameterIndex].name;
}

function inferPropertyType(target: Object, propertyKey: string | symbol): any {
    const propertyType = reflect.getMetadata(
        'design:type',
        target,
        propertyKey
    );
    if (!propertyType) {
        throw new Error(
            `Unable to infer the type of property '${String(
                propertyKey
            )}', target: ${target.constructor.name}.`
        );
    }
    return propertyType;
}

class Registration {
    constructor(
        public classConstructor: Constructor,
        public scope: ServiceScope,
        public key?: string,
        public instance?: unknown
    ) {}
}
