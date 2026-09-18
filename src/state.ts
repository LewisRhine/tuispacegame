export type StateSub = (onUpdate: () => void) => void

const isObject = (value: unknown): value is object => {
    return value !== null && typeof value === "object"
}

const mainSubs = new Map<string, Set<() => void>>()
const notify = (id: string) => {
    mainSubs.get(id)?.forEach(onUpdate => onUpdate())
}
const addSub = (id: string, onUpdate: () => void) => {
    if (!mainSubs.has(id)) mainSubs.set(id, new Set())
    mainSubs.get(id)?.add(onUpdate)
    onUpdate()

}

export function newState<T extends object>(state: T): T & { sub: StateSub } {
    const proxyCache = new WeakMap<object, any>()
    const id = crypto.randomUUID()

    const proxify = <K extends object>(target: K): K => {
        const cached = proxyCache.get(target)
        if (cached) return cached

        if (target instanceof Map) return proxifyMap(target as Map<any, any>) as K
        if (target instanceof Set) return proxifySet(target as Set<any>) as K

        const proxy = new Proxy(target, {
            get(obj, prop, receiver) {
                if (prop === "sub") {
                    return (onUpdate: () => void) => {
                        addSub(id, onUpdate)
                    }
                }

                const value = Reflect.get(obj, prop, receiver)

                if (isObject(value)) return proxify(value)

                return value
            },

            set(obj, prop, value, receiver) {
                const result = Reflect.set(obj, prop, value, receiver)

                if (result) notify(id)

                return result
            },

            deleteProperty(obj, prop) {
                const result = Reflect.deleteProperty(obj, prop)

                if (result) notify(id)

                return result
            }
        })

        proxyCache.set(target, proxy)

        return proxy
    }

    const proxifyMap = <K, V>(target: Map<K, V>): Map<K, V> => {
        const cached = proxyCache.get(target)
        if (cached) return cached


        const proxy = new Proxy(target, {
            get(obj, prop) {
                if (prop === "sub") {
                    return (onUpdate: () => void) => {
                        addSub(id, onUpdate)
                    }
                }

                switch (prop) {
                    case "set":
                        return (key: K, value: V) => {
                            const result = obj.set(key, value)
                            if (result) notify(id)
                            return proxy
                        }

                    case "delete":
                        return (key: K) => {
                            const result = obj.delete(key)
                            if (result) notify(id)
                            return result
                        }

                    case "clear":
                        return () => {
                            if (obj.size > 0) {
                                obj.clear()
                                notify(id)
                            }
                        }

                    case "get":
                        return (key: K) => {
                            const value = obj.get(key)

                            return isObject(value)
                                ? proxify(value)
                                : value
                        }

                    case "values":
                        return function* () {
                            for (const value of obj.values()) {
                                yield isObject(value)
                                    ? proxify(value)
                                    : value
                            }
                        }

                    case "entries":
                        return function* () {
                            for (const [key, value] of obj.entries()) {
                                yield [
                                    key,
                                    isObject(value)
                                        ? proxify(value)
                                        : value
                                ] as [K, V]
                            }
                        }

                    case "forEach":
                        return (callback: (value: V, key: K, map: Map<K, V>) => void) => {
                            obj.forEach((value, key) => {
                                callback(
                                    isObject(value)
                                        ? proxify(value)
                                        : value,
                                    key,
                                    proxy
                                )
                            })
                        }

                    case Symbol.iterator:
                        return function* () {
                            for (const [key, value] of obj) {
                                yield [
                                    key,
                                    isObject(value)
                                        ? proxify(value)
                                        : value
                                ] as [K, V]
                            }
                        }

                    default: {
                        const value = Reflect.get(obj, prop)

                        if (typeof value === "function") {
                            return value.bind(obj)
                        }

                        return value
                    }
                }
            }
        })

        proxyCache.set(target, proxy)

        return proxy
    }

    const proxifySet = <V>(target: Set<V>): Set<V> => {
        const cached = proxyCache.get(target)
        if (cached) {
            return cached
        }

        const proxy = new Proxy(target, {
            get(obj, prop) {
                if (prop === "sub") {
                    return (onUpdate: () => void) => {
                        addSub(id, onUpdate)
                    }
                }

                switch (prop) {
                    case "add":
                        return (value: V) => {
                            const hadValue = obj.has(value)

                            obj.add(value)

                            if (!hadValue) {
                                notify(id)
                            }

                            return proxy
                        }

                    case "delete":
                        return (value: V) => {
                            const result = obj.delete(value)

                            if (result) {
                                notify(id)
                            }

                            return result
                        }

                    case "clear":
                        return () => {
                            if (obj.size > 0) {
                                obj.clear()
                                notify(id)
                            }
                        }

                    case "values":
                    case "keys":
                        return function* () {
                            for (const value of obj.values()) {
                                yield isObject(value)
                                    ? proxify(value)
                                    : value
                            }
                        }

                    case "entries":
                        return function* () {
                            for (const value of obj.values()) {
                                const proxied = isObject(value)
                                    ? proxify(value)
                                    : value

                                yield [proxied, proxied] as [V, V]
                            }
                        }

                    case "forEach":
                        return (callback: (value: V, key: V, set: Set<V>) => void) => {
                            obj.forEach(value => {
                                const proxied = isObject(value)
                                    ? proxify(value)
                                    : value

                                callback(proxied, proxied, proxy)
                            })
                        }

                    case Symbol.iterator:
                        return function* () {
                            for (const value of obj) {
                                yield isObject(value)
                                    ? proxify(value)
                                    : value
                            }
                        }

                    default: {
                        const value = Reflect.get(obj, prop)

                        if (typeof value === "function") {
                            return value.bind(obj)
                        }

                        return value
                    }
                }
            }
        })

        proxyCache.set(target, proxy)

        return proxy
    }

    return proxify(state) as T & { sub: StateSub }
}