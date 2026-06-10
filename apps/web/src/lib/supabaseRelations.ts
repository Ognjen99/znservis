export type SupabaseRelation<T> = T | T[] | null;

export function firstRelation<T>(relation: SupabaseRelation<T>) {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}
