import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface UseRealtimeTableOptions {
  table: string;
  select?: string;
  filter?: string;
  filterValue?: unknown;
  /**
   * Coluna usada no ORDER BY.
   * Deixe em branco se a tabela não tiver coluna de data confiável.
   * NÃO tem default — se você não passar, não ordena (evita erro 42703).
   */
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
}

export function useRealtimeTable<T>({
  table,
  select = '*',
  filter,
  filterValue,
  orderBy,
  ascending = false,
  limit = 100,
}: UseRealtimeTableOptions) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);

    const fetchData = async () => {
      let query = supabase.from(table).select(select);

      if (filter && filterValue !== undefined) {
        query = query.eq(filter, filterValue);
      }

      // Só aplica ORDER BY se o caller passou orderBy
      if (orderBy) {
        query = query.order(orderBy, { ascending });
      }

      const { data: result, error: err } = await query.limit(limit);

      if (!mountedRef.current) return;

      if (err) {
        setError(err.message);
        setData([]);
      } else {
        setData((result as T[]) ?? []);
        setError(null);
      }
      setLoading(false);
    };

    fetchData();

    const channel = supabase
      .channel(`realtime-${table}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          if (mountedRef.current) fetchData();
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, select, filter, JSON.stringify(filterValue), orderBy, ascending, limit]);

  return { data, loading, error };
}