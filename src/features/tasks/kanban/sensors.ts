import { MouseSensor, TouchSensor } from "@dnd-kit/core"

const INTERACTIVE = "button, a, input, textarea, select, label"

function startsOnInteractive(target: EventTarget | null) {
	return target instanceof Element && target.closest(INTERACTIVE) !== null
}

export class CardMouseSensor extends MouseSensor {
	static activators: typeof MouseSensor.activators = [
		{
			eventName: "onMouseDown",
			handler: (event, options) =>
				!startsOnInteractive(event.nativeEvent.target) &&
				MouseSensor.activators[0].handler(event, options),
		},
	]
}

export class CardTouchSensor extends TouchSensor {
	static activators: typeof TouchSensor.activators = [
		{
			eventName: "onTouchStart",
			handler: (event, options) =>
				!startsOnInteractive(event.nativeEvent.target) &&
				TouchSensor.activators[0].handler(event, options),
		},
	]
}
