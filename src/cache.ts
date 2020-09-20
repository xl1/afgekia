const map = new Map<string, Promise<unknown>>();
export const cache = {
    get<T>(key: string, func: () => Promise<T>) {
        if (!map.has(key)) map.set(key, func());
        return map.get(key) as Promise<T>;
    }
};
