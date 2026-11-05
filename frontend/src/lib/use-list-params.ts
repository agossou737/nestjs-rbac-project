import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

// Filters, sort and page live in the URL (FE-2): a list is shareable and the back button restores it.
export function useListParams<K extends string>(filterKeys: readonly K[]) {
  const [params, setParams] = useSearchParams();

  const state = useMemo(() => {
    const filters = Object.fromEntries(filterKeys.map((key) => [key, params.get(key) ?? undefined])) as Record<K, string | undefined>;
    return {
      page: Math.max(1, Number(params.get("page")) || 1),
      sort: params.get("sort") ?? undefined,
      order: (params.get("order") as "asc" | "desc" | null) ?? undefined,
      filters,
    };
  }, [params, filterKeys]);

  const update = useCallback(
    (changes: Record<string, string | number | undefined>, resetPage = true) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === "") next.delete(key);
          else next.set(key, String(value));
        }
        if (resetPage && !("page" in changes)) next.delete("page");
        return next;
      });
    },
    [setParams],
  );

  const toggleSort = useCallback(
    (field: string) => {
      const order = state.sort === field && state.order === "asc" ? "desc" : "asc";
      update({ sort: field, order });
    },
    [state.sort, state.order, update],
  );

  const reset = useCallback(() => setParams(new URLSearchParams()), [setParams]);
  const hasFilters = filterKeys.some((key) => state.filters[key] !== undefined);

  return { ...state, update, toggleSort, reset, hasFilters };
}
