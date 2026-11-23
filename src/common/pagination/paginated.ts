/** One page of results, plus the total count across all pages. */
export interface Paginated<T> {
  data: T[];
  total: number;
}
