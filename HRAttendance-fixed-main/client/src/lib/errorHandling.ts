export type DiagnosticError = {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  source?: string;
};

const MAX_ERRORS = 100;
const inMemoryErrors: DiagnosticError[] = [];

export const pushDiagnosticError = (error: unknown, source = "app") => {
  const message = error instanceof Error ? error.message : String(error || "خطأ غير معروف");
  const stack = error instanceof Error ? error.stack : undefined;
  const item: DiagnosticError = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    message,
    stack,
    source,
  };
  inMemoryErrors.unshift(item);
  if (inMemoryErrors.length > MAX_ERRORS) inMemoryErrors.pop();
  if (import.meta.env.DEV) console.error("[DiagnosticError]", source, error);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:error", { detail: item }));
  }
};

export const getDiagnosticErrors = () => [...inMemoryErrors];
export const clearDiagnosticErrors = () => { inMemoryErrors.splice(0, inMemoryErrors.length); };
