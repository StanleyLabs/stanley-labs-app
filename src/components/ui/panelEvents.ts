/**
 * Portaled panels aren't DOM descendants of the panel that opened them, but
 * React events still bubble through the component tree. Each FloatingPanel
 * records the native event as it passes, so a parent can tell that a click in
 * a nested panel (e.g. a calendar inside the start-time popover) is "inside".
 */
const passed = new WeakMap<Event, Set<Element>>()

export function markPanelEvent(e: Event, el: Element) {
	let set = passed.get(e)
	if (!set) {
		set = new Set()
		passed.set(e, set)
	}
	set.add(el)
}

export function passedThroughPanel(e: Event, el: Element): boolean {
	return passed.get(e)?.has(el) ?? false
}
