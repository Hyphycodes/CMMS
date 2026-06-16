import { QueryClient } from "@tanstack/react-query";

/** Single client. The world is loaded once; everything else works in memory. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});
