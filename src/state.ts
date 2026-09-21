type OnUpdate = () => void
export type StateSub = (onUpdate: OnUpdate) => void

const isObject = (value: unknown): value is object => {
    return value !== null && typeof value === "object"
}

const mainSubs = new Set<(id: string, key: string) => void>()
const notify = (id: string, key: string) => {
    mainSubs.forEach(onUpdate => {
        onUpdate(id, key)
    })
}
const addSub = (onUpdate: (id: string, key: string) => void) => {
    mainSubs.add(onUpdate)
}


let getterKeyTracker: {
    onUpdate: OnUpdate
    map: Map<string, Set<string>>
} | null = null

export function traceReads(onUpdate: OnUpdate) {
    const context = {onUpdate, map: new Map()}

    getterKeyTracker = context

    onUpdate()

    getterKeyTracker = null

    return context.map
}

export function newState<T extends object>(state: T) {
    const proxyCache = new WeakMap<object, any>()
    const mainId = crypto.randomUUID()

    const proxify = <K extends object>(target: K, id: string): K => {
        const cached = proxyCache.get(target)
        if (cached) return cached

        const proxy = new Proxy(target, {
            get(obj, prop, receiver) {
                if (prop === "sub") {
                    return (onUpdate: OnUpdate) => {
                        const map = traceReads(onUpdate)
                        addSub((objId, key) => {

                            if (!map.has(objId)) {
                                const keys = map.get(id)
                                if (keys.has(key)) onUpdate()

                            } else {
                                const keys = map.get(objId)
                                if (keys.has(key)) onUpdate()
                            }
                        })
                    }
                }

                const value = Reflect.get(obj, prop, receiver)


                if (isObject(value)) {
                    if (getterKeyTracker) {
                        if (!getterKeyTracker.map.has(prop as string)) {
                            getterKeyTracker.map.set(prop as string, new Set())
                        }
                    }
                    return proxify(value, prop as string)
                }

                if (getterKeyTracker) {
                    if (!getterKeyTracker.map.has(id)) getterKeyTracker.map.set(id, new Set())
                    getterKeyTracker.map.get(id)!.add(prop as string)
                }

                return value
            },

            set(obj, prop, value, receiver) {
                const result = Reflect.set(obj, prop, value, receiver)

                if (result) notify(id, prop as string)

                return result
            },

            deleteProperty(obj, prop) {
                const result = Reflect.deleteProperty(obj, prop)

                if (result) notify(id, prop as string)

                return result
            }
        })

        proxyCache.set(target, proxy)

        return proxy
    }


    return proxify(state, mainId) as T & { sub: StateSub }
}