import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { router } from "@/app/router";
import { SessionProvider } from "@/app/session";
import { toProblem } from "@/api/problem";
import "./i18n";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: (count, error) => count < 1 && !isClientError(error), refetchOnWindowFocus: false } },
});

// A 4xx will not succeed on retry; only network and server errors are retried once.
const isClientError = (error: unknown) => {
  const { status } = toProblem(error);
  return status >= 400 && status < 500;
};

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
        <Toaster position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
