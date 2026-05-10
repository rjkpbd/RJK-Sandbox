import { z } from "zod";
import { NextResponse } from "next/server";

type ParseOk<T> = { ok: true; data: T };
type ParseFail = { ok: false; response: NextResponse };

/**
 * Parse + validate a JSON request body against a Zod schema.
 *
 * Returns { ok: true, data } on success, or { ok: false, response } with an
 * appropriate HTTP error response (400 for malformed JSON, 422 for schema
 * violations) that the route can return directly.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T
): Promise<ParseOk<z.infer<T>> | ParseFail> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return {
      ok: false,
      response: NextResponse.json({ error: "Validation error", details }, { status: 422 }),
    };
  }

  return { ok: true, data: result.data };
}
