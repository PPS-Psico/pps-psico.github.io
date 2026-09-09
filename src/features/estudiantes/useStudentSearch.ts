import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { normalizeStudentSearch, searchStudents, studentSearchKeys } from "./studentSearchService";

export function useStudentSearch(enabled: boolean, enrolledIds: readonly string[]) {
  const [search, setSearch] = useState({ term: "", page: 1 });
  const term = normalizeStudentSearch(search.term);
  const [settledTerm, setSettledTerm] = useState(term);
  useEffect(() => {
    const timer = setTimeout(() => setSettledTerm(term), 300);
    return () => clearTimeout(timer);
  }, [term]);
  const isDebouncing = settledTerm !== term;
  const canSearch = enabled && term.length >= 2 && !isDebouncing;
  const query = useQuery({
    queryKey: studentSearchKeys.page(term, search.page),
    queryFn: ({ signal }) => searchStudents(term, search.page, signal),
    enabled: canSearch,
    staleTime: 60_000,
  });
  const enrolled = new Set(enrolledIds);
  // La página base es compartida entre lanzamientos. La exclusión siempre usa
  // el roster actual, sin congelarlo dentro de una query cacheada.
  return {
    term: search.term,
    setTerm: (value: string) => setSearch({ term: value, page: 1 }),
    page: search.page,
    previous: () => setSearch((current) => ({ ...current, page: Math.max(1, current.page - 1) })),
    next: () => {
      if (query.data?.hasNextPage && !query.isFetching)
        setSearch((current) => ({ ...current, page: current.page + 1 }));
    },
    students: canSearch
      ? (query.data?.students ?? []).filter((student) => !enrolled.has(student.id))
      : [],
    hasNextPage: canSearch && !!query.data?.hasNextPage,
    needsTerm: term.length < 2,
    isLoading: enabled && term.length >= 2 && (isDebouncing || query.isFetching),
    error: canSearch ? query.error : null,
    retry: () => {
      if (canSearch) void query.refetch();
    },
  };
}
