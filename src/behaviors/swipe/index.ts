// hadi-march/behaviors/swipe — "follow the finger, then settle" gestures written once: Drawer sheets, PullToRefresh,
// ChatBubble swipe to reply, StoryViewer (tap halves, hold to pause, swipe sideways / down).
//   const off = swipeable(el, { axis: "y", accept: (p) => p.dy > 0, onMove: (p) => follow(p.dy), onEnd: (p) => settle(fling(pos, p.vy)) })
// Axis lock, a veto before the gesture is claimed, release velocity, rubberBand() resistance, fling() projection and
// nearest() snapping, tap / hold for presses that never swiped, and the click after a mouse swipe is swallowed.
export { swipeable, rubberBand, fling, nearest } from "./swipe.ts";
export type { SwipeOptions, SwipePoint, SwipeAxis } from "./swipe.ts";
