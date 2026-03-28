import "reflect-metadata";

interface MetadataHandler {
    defineMetadata(metadataKey: string | symbol, value: any, target: object, propertyKey?: string | symbol): void;
    getMetadata(metadataKey: string | symbol, target: object, propertyKey?: string | symbol): any;
    hasMetadata(metadataKey: string | symbol, target: object, propertyKey?: string | symbol): boolean;
}

class ReflectionMetadataHandler implements MetadataHandler {
    defineMetadata(metadataKey: string | symbol, value: any, target: object, propertyKey?: string | symbol): void {
        Reflect.defineMetadata(metadataKey, value, target, propertyKey);
    }

    getMetadata(metadataKey: string | symbol, target: object, propertyKey?: string | symbol): any {
        return Reflect.getMetadata(metadataKey, target, propertyKey);
    }

    hasMetadata(metadataKey: string | symbol, target: object, propertyKey?: string | symbol): boolean {
        return Reflect.hasMetadata(metadataKey, target, propertyKey);
    }
}

class ShimMetadataHandler implements MetadataHandler {
    private metadataStore = new WeakMap<object, Map<string | symbol, Map<string | symbol | undefined, any>>>();

    defineMetadata(key: string | symbol, value: any, target: object, propertyKey?: string | symbol): void {
        if (!this.metadataStore.has(target)) {
            this.metadataStore.set(target, new Map());
        }
        const targetMetadata = this.metadataStore.get(target)!;
        if (!targetMetadata.has(key)) {
            targetMetadata.set(key, new Map());
        }
        targetMetadata.get(key)!.set(propertyKey, value);
    }

    getMetadata(key: string | symbol, target: object, propertyKey?: string | symbol): any {
        const targetMetadata = this.metadataStore.get(target);
        return targetMetadata?.get(key)?.get(propertyKey);
    }

    hasMetadata(key: string | symbol, target: object, propertyKey?: string | symbol): boolean {
        const targetMetadata = this.metadataStore.get(target);
        return targetMetadata?.get(key)?.has(propertyKey) ?? false;
    }
}

const metadataSupported =
    typeof Reflect !== "undefined" &&
    typeof Reflect.defineMetadata === "function" &&
    typeof Reflect.getMetadata === "function" &&
    typeof Reflect.hasMetadata === "function";

export const reflect: MetadataHandler = metadataSupported
    ? new ReflectionMetadataHandler()
    : new ShimMetadataHandler();
