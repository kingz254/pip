export async function executeTradesSequentially<T>(count: number, execute: () => Promise<T>): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < count; i++) results.push(await execute());
    return results;
}
