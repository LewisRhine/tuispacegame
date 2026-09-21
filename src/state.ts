type OnUpdate = () => void
export type StateSub = (onUpdate: OnUpdate) => void

const isObject = (value: unknown): value is object => {
    return value !== null && typeof value === "object"
}

const mainSubs = new Map<string, Set<(key: string) => void>>()
const notify = (id: string, key: string) => {
    mainSubs.get(id)?.forEach(onUpdate => {
        onUpdate(key)
    })
}
const addSub = (id: string, onUpdate: (key: string) => void) => {
    if (!mainSubs.has(id)) mainSubs.set(id, new Set())
    mainSubs.get(id)?.add(onUpdate)
}


let getterKeyTracker: { onUpdate: OnUpdate; keys: string[] } | null = null

export function traceReads(onUpdate: OnUpdate) {
    const context = {onUpdate, keys: [] as string[]}

    getterKeyTracker = context;

    onUpdate()

    getterKeyTracker = null;

    return context.keys;
}

export function newState<T extends object>(state: T) {
    const proxyCache = new WeakMap<object, any>()
    const id = crypto.randomUUID()

    const proxify = <K extends object>(target: K): K => {
        const cached = proxyCache.get(target)
        if (cached) return cached


        const proxy = new Proxy(target, {
            get(obj, prop, receiver) {
                if (prop === "id") return id

                if (prop === "sub") {
                    return (onUpdate: OnUpdate) => {
                        const keysUsed = traceReads(onUpdate);
                        addSub(id, (key) => {
                            if (keysUsed.includes(key)) onUpdate()
                        })
                    }
                }

                const value = Reflect.get(obj, prop, receiver)

                if (isObject(value)) return proxify(value)

                if (getterKeyTracker) getterKeyTracker.keys.push(prop as string);

                return value
            }
            ,

            set(obj, prop, value, receiver) {
                const result = Reflect.set(obj, prop, value, receiver)

                if (result) notify(id, prop as string)

                return result
            }
            ,

            deleteProperty(obj, prop) {
                const result = Reflect.deleteProperty(obj, prop)

                if (result) notify(id, prop as string)

                return result
            }
        })

        proxyCache.set(target, proxy)

        return proxy
    }


    return proxify(state) as T & { sub: StateSub }
}