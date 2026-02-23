export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-accent/8 dark:bg-accent/15 px-1.5 py-0.5 text-2xs font-medium text-accent-dark dark:text-accent-light">
      {children}
    </span>
  );
}
