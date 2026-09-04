export default function PageLoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-slate-50 px-4 py-8 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading page">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-56 rounded bg-slate-200" />
        <div className="h-4 w-80 max-w-full rounded bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: rows }, (_, index) => <div key={index} className="h-32 rounded-xl border border-slate-200 bg-white" />)}
        </div>
      </div>
    </main>
  )
}
