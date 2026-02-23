import { pointerWithin, rectIntersection } from "@dnd-kit/core";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function stopProp(e: React.MouseEvent) {
  e.stopPropagation();
}

export function collisionDetection(args: Parameters<typeof pointerWithin>[0]) {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
}

export const AVATAR_COLORS = [
  "#6c5ce7", "#e84393", "#00b894", "#fdcb6e", "#e17055",
  "#0984e3", "#6c5ce7", "#00cec9", "#d63031", "#a29bfe",
];

export function nameToInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
