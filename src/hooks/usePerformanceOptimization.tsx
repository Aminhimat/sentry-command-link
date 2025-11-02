import React, { useCallback, useMemo, useRef } from 'react';

/**
 * Custom hook for performance optimizations
 */
export const useDebounce = (callback: Function, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: any[]) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
};

export const useThrottle = (callback: Function, delay: number) => {
  const lastRun = useRef(Date.now());

  return useCallback((...args: any[]) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = Date.now();
    }
  }, [callback, delay]);
};

export const useMemoizedData = <T,>(data: T[], deps: any[] = []) => {
  return useMemo(() => data, deps);
};

export const useOptimizedFilter = <T,>(
  data: T[],
  filterFn: (item: T) => boolean,
  deps: any[] = []
) => {
  return useMemo(() => data.filter(filterFn), [data, ...deps]);
};