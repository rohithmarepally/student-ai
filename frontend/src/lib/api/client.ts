import { createClient } from "@/lib/supabase/client";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL
  ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

type ApiErrorPayload = {
  detail?: unknown;
};

export class ApiRequestError extends Error {
  status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);

    this.name = "ApiRequestError";
    this.status = status;
  }
}

function getValidationErrorMessage(
  detail: unknown,
): string | null {
  if (typeof detail === "string") {
    return detail;
  }

  if (!Array.isArray(detail)) {
    return null;
  }

  for (const item of detail) {
    if (
      typeof item === "object"
      && item !== null
      && "msg" in item
      && typeof item.msg === "string"
    ) {
      return item.msg;
    }
  }

  return null;
}

async function getApiErrorMessage(
  response: Response,
): Promise<string> {
  const fallbackMessage =
    `The request failed with status ${response.status}.`;

  try {
    const payload =
      (await response.json()) as ApiErrorPayload;

    return (
      getValidationErrorMessage(
        payload.detail,
      )
      ?? fallbackMessage
    );
  } catch {
    return fallbackMessage;
  }
}

export async function authenticatedApiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const supabase = createClient();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new ApiRequestError(
      "Your session is unavailable. "
      + "Please log in again.",
      401,
    );
  }

  const headers = new Headers(
    options.headers,
  );

  headers.set(
    "Authorization",
    `Bearer ${session.access_token}`,
  );

  if (
    options.body
    && !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  const response = await fetch(
    `${API_URL}${normalizedPath}`,
    {
      ...options,
      headers,
      cache: options.cache ?? "no-store",
    },
  );

  if (!response.ok) {
    throw new ApiRequestError(
      await getApiErrorMessage(response),
      response.status,
    );
  }

  if (
    response.status === 204
    || response.headers.get(
      "content-length",
    ) === "0"
  ) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
