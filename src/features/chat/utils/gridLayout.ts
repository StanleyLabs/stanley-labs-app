const COLUMNS_BY_COUNT: Record<number, string> = {
	1: "grid-cols-1",
	2: "grid-cols-1 sm:grid-cols-2",
	3: "grid-cols-1 sm:grid-cols-3",
	4: "grid-cols-1 sm:grid-cols-2",
	5: "grid-cols-2 sm:grid-cols-3",
	6: "grid-cols-2 sm:grid-cols-3",
	7: "grid-cols-2 sm:grid-cols-4",
	8: "grid-cols-2 sm:grid-cols-4",
	9: "grid-cols-3 sm:grid-cols-3",
}

/**
 * Returns Tailwind grid classes based on peer count.
 * Uses auto row sizing so rows shrink to content and place-content-center
 * clusters them together instead of stretching to fill the container.
 */
export function getGridClasses(count: number): string {
	return `grid gap-2 place-content-center ${COLUMNS_BY_COUNT[count] ?? "grid-cols-4 sm:grid-cols-5"}`
}
