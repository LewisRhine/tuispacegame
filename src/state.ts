type OnUpdate = () => void
export type StateSub = (onUpdate: OnUpdate) => () => void

type DependencyMap = Map<object, Set<PropertyKey>>

const isObject = (value: unknown): value is object => {
    return value !== null && typeof value === "object"
}

let getterKeyTracker: DependencyMap | null = null

export function traceReads(onUpdate: OnUpdate): DependencyMap {
    const dependencies: DependencyMap = new Map()

    getterKeyTracker = dependencies
    try {
        onUpdate()
    } finally {
        getterKeyTracker = null
    }

    return dependencies
}

export function newState<T extends object>(state: T) {
    const proxyCache = new WeakMap<object, any>()
    const subscribers = new Set<(target: object, key: PropertyKey) => void>()

    const track = (target: object, key: PropertyKey) => {
        if (!getterKeyTracker) return

        let keys = getterKeyTracker.get(target)
        if (!keys) {
            keys = new Set()
            getterKeyTracker.set(target, keys)
        }

        keys.add(key)
    }

    const notify = (target: object, key: PropertyKey) => {
        subscribers.forEach(subscriber => subscriber(target, key))
    }

    const proxify = <K extends object>(target: K): K => {
        const cached = proxyCache.get(target)
        if (cached) return cached

        const proxy = new Proxy(target, {
            get(obj, prop, receiver) {
                if (prop === "sub") {
                    return (onUpdate: OnUpdate): () => void => {
                        let updateDelay: ReturnType<typeof setTimeout> | null = null
                        let disposed = false

                        const callUpdate = () => {
                            if (disposed || updateDelay) return

                            updateDelay = setTimeout(() => {
                                updateDelay = null

                                if (!disposed) onUpdate()
                            }, 0)
                        }
                        const dependencies = traceReads(onUpdate)
                        console.log(dependencies)
                        const sub = (changedTarget: object, key: PropertyKey) => {
                            if (dependencies.get(changedTarget)?.has(key)) {
                                callUpdate()
                            }
                        }

                        subscribers.add(sub)

                        return () => {
                            disposed = true
                            subscribers.delete(sub)

                            if (updateDelay) {
                                clearTimeout(updateDelay)
                                updateDelay = null
                            }
                        }
                    }
                }

                const value = Reflect.get(obj, prop, receiver)

                if (Array.isArray(target) && prop === "forEach") {
                    target.forEach((item, index) => {
                        if (isObject(item)) {
                            Object.keys(item).forEach((key) => {
                                track(item, key)
                            })
                        }
                    })

                }
                Array.isArray(value)
                track(obj, prop)

                return isObject(value) ? proxify(value) : value
            },

            set(obj, prop, value, receiver) {
                const previousValue = Reflect.get(obj, prop, receiver)
                const result = Reflect.set(obj, prop, value, receiver)

                if (result && !Object.is(previousValue, value)) notify(obj, prop)

                return result
            },

            deleteProperty(obj, prop) {
                const existed = Reflect.has(obj, prop)
                const result = Reflect.deleteProperty(obj, prop)

                if (result && existed) notify(obj, prop)

                return result
            }
        })

        proxyCache.set(target, proxy)

        return proxy
    }


    return proxify(state) as T & { sub: StateSub }
}
