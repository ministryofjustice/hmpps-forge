declare module '@ministryofjustice/frontend/moj/filters/all' {
  export default function mojFilters(): Record<string, (...args: unknown[]) => unknown>
}
