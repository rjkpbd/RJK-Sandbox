// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RangeQuery = (from: number, to: number) => Promise<{ data: any[] | null; error: { message: string } | null }>;

const PAGE = 1000;

/**
 * Fetches every row for a query by iterating through 1 000-row pages.
 * Pass a factory that accepts (from, to) and returns a Supabase ranged query.
 */
export async function fetchAll<T>(queryFn: RangeQuery): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await queryFn(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}
