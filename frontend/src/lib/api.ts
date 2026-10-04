import createClient from "openapi-fetch";
import type { paths, components } from "./api-schema";
export const client = createClient<paths>();
export type User = components["schemas"]["User"];
export type Product = components["schemas"]["Product"];
export function unwrap<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): T {
  if (!result.response.ok || result.data === undefined) {
    const error = result.error as { message?: string } | undefined;
    throw new Error(
      error?.message ?? "Сервис временно недоступен. Попробуйте ещё раз.",
    );
  }
  return result.data;
}
export function errorMessage(error: unknown) {
  return error instanceof TypeError
    ? "Нет соединения с сервером. Проверьте подключение и повторите попытку."
    : error instanceof Error
      ? error.message
      : "Произошла ошибка. Попробуйте ещё раз.";
}
