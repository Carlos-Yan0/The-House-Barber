export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const response = (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response;
    const data = response?.data;

    if (typeof data?.error === "string" && data.error.trim().length > 0) {
      return data.error;
    }

    if (typeof data?.error === "object" && data.error !== null) {
      const structured = data.error as {
        formErrors?: unknown;
        fieldErrors?: Record<string, unknown>;
      };

      if (Array.isArray(structured.formErrors)) {
        const firstFormError = structured.formErrors.find(
          (entry) => typeof entry === "string" && entry.trim().length > 0
        ) as string | undefined;

        if (firstFormError) return firstFormError;
      }

      if (structured.fieldErrors && typeof structured.fieldErrors === "object") {
        for (const value of Object.values(structured.fieldErrors)) {
          if (Array.isArray(value)) {
            const firstFieldError = value.find(
              (entry) => typeof entry === "string" && entry.trim().length > 0
            ) as string | undefined;

            if (firstFieldError) return firstFieldError;
          }
        }
      }
    }

    if (typeof data?.message === "string" && data.message.trim().length > 0) {
      return data.message;
    }
  }

  return fallback;
}
