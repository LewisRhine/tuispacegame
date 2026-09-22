type OnUpdate = () => void
export type StateSub = (onUpdate: OnUpdate) => () => void

type DependencyMap = Map<object, Set<PropertyKey>>

const arrayStructure = Symbol("arrayStructure")

const isArrayIndex = (key: PropertyKey): boolean => {
    if (typeof key !== "string") return false

    const index = Number(key)
    return Number.isInteger(index) && index >= 0 && index < 2 ** 32 - 1 && String(index) === key
}

const isObject = (value: unknown): value is object => {
    return value !== null && typeof value === "object"
}

let activeDependencies: DependencyMap | null = null

export function traceReads(onUpdate: OnUpdate): DependencyMap {
    const dependencies: DependencyMap = new Map()

    const previousDependencies = activeDependencies
    activeDependencies = dependencies
    try {
        onUpdate()
    } finally {
        activeDependencies = previousDependencies
    }

    return dependencies
}

export function newState<T extends object>(state: T) {
    const proxyCache = new WeakMap<object, object>()
    const subscribers = new Set<(target: object, key: PropertyKey) => void>()

    const track = (target: object, key: PropertyKey) => {
        if (!activeDependencies) return

        let keys = activeDependencies.get(target)
        if (!keys) {
            keys = new Set()
            activeDependencies.set(target, keys)
        }

        keys.add(key)
    }

    const notify = (target: object, key: PropertyKey) => {
        subscribers.forEach(subscriber => subscriber(target, key))
    }

    const notifyChange = (target: object, key: PropertyKey) => {
        notify(target, key)

        if (Array.isArray(target) && (key === "length" || isArrayIndex(key))) {
            notify(target, arrayStructure)
        }
    }

    const proxify = <K extends object>(target: K): K => {
        const cached = proxyCache.get(target)
        if (cached) return cached as K

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

                                if (!disposed) dependencies = traceReads(onUpdate)
                            }, 0)
                        }
                        let dependencies = traceReads(onUpdate)
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

                if (Array.isArray(obj) && (prop === Symbol.iterator || typeof value === "function")) {
                    track(obj, arrayStructure)
                }
                track(obj, prop)

                return isObject(value) ? proxify(value) : value
            },

            set(obj, prop, value, receiver) {
                const previousValue = Reflect.get(obj, prop, receiver)
                const result = Reflect.set(obj, prop, value, receiver)

                if (result && !Object.is(previousValue, value)) {
                    notifyChange(obj, prop)
                }

                return result
            },

            deleteProperty(obj, prop) {
                const existed = Reflect.has(obj, prop)
                const result = Reflect.deleteProperty(obj, prop)

                if (result && existed) {
                    notifyChange(obj, prop)
                }

                return result
            }
        })

        proxyCache.set(target, proxy)

        return proxy
    }


    return proxify(state) as T & { sub: StateSub }
}
