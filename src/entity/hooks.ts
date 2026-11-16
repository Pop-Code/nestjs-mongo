import { ClassType, getClassChain } from '../mapping/metadata';

export const HOOKS_METADATA_NAME = 'nestjs-mongo:hooks';

/** The lifecycle events of an entity. */
export enum EntityHook {
    BEFORE_INSERT = 'beforeInsert',
    AFTER_INSERT = 'afterInsert',
    BEFORE_UPDATE = 'beforeUpdate',
    AFTER_UPDATE = 'afterUpdate',
    BEFORE_DELETE = 'beforeDelete',
    AFTER_DELETE = 'afterDelete',
    AFTER_LOAD = 'afterLoad'
}

function addHook(target: object, method: string, hooks: EntityHook[]) {
    const model = target.constructor;
    const current: Partial<Record<EntityHook, string[]>> = {
        ...(Reflect.getOwnMetadata(HOOKS_METADATA_NAME, model) ?? {})
    };
    for (const hook of hooks) {
        current[hook] = [...(current[hook] ?? []), method];
    }
    Reflect.defineMetadata(HOOKS_METADATA_NAME, current, model);
}

const hookDecorator =
    (...hooks: EntityHook[]) =>
    (): MethodDecorator =>
    (target, method) =>
        addHook(target, String(method), hooks);

/** Calls the method before the entity is inserted by `save()` (before the validation). */
export const BeforeInsert = hookDecorator(EntityHook.BEFORE_INSERT);
/** Calls the method after the entity is inserted by `save()`. */
export const AfterInsert = hookDecorator(EntityHook.AFTER_INSERT);
/** Calls the method before the entity is updated by `save()` (before the validation). */
export const BeforeUpdate = hookDecorator(EntityHook.BEFORE_UPDATE);
/** Calls the method after the entity is updated by `save()`. */
export const AfterUpdate = hookDecorator(EntityHook.AFTER_UPDATE);
/** Calls the method before each insert or update of the entity by `save()` (before the validation). */
export const BeforeSave = hookDecorator(EntityHook.BEFORE_INSERT, EntityHook.BEFORE_UPDATE);
/** Calls the method after each insert or update of the entity by `save()`. */
export const AfterSave = hookDecorator(EntityHook.AFTER_INSERT, EntityHook.AFTER_UPDATE);
/** Calls the method before the entity is deleted by `deleteOne()` / `deleteMany()`. */
export const BeforeDelete = hookDecorator(EntityHook.BEFORE_DELETE);
/** Calls the method after the entity is deleted by `deleteOne()` / `deleteMany()` / `findOneAndDelete()`. */
export const AfterDelete = hookDecorator(EntityHook.AFTER_DELETE);
/** Calls the method after the entity is loaded from the database. The method must be synchronous. */
export const AfterLoad = hookDecorator(EntityHook.AFTER_LOAD);

/** The methods registered for a lifecycle event of a model, including the methods of its parent classes. */
export function getHookMethods(model: ClassType, hook: EntityHook): string[] {
    const methods: string[] = [];
    for (const t of getClassChain(model)) {
        for (const method of Reflect.getOwnMetadata(HOOKS_METADATA_NAME, t)?.[hook] ?? []) {
            if (!methods.includes(method)) methods.push(method);
        }
    }
    return methods;
}

/** Runs the methods of a lifecycle event on an entity. */
export async function runHooks(entity: object, hook: EntityHook): Promise<void> {
    for (const method of getHookMethods(entity.constructor as ClassType, hook)) {
        await Reflect.apply(Reflect.get(entity, method), entity, []);
    }
}

/** Runs the methods of a synchronous lifecycle event (`AfterLoad`) on an entity. */
export function runSyncHooks(entity: object, hook: EntityHook): void {
    for (const method of getHookMethods(entity.constructor as ClassType, hook)) {
        Reflect.apply(Reflect.get(entity, method), entity, []);
    }
}
