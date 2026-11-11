// TSX type tests: component props are type-checked; $ variables are plain TS variables to the checker.
/// <reference path="../types/jsx.d.ts" />
function Hello(props: { name: string; count?: number; onSave?: (v: string) => void }) { return <b>{props.name}{props.count}</b>; }

let $n = 0;
const $label = `n = ${$n}`;
export const ok = <div class="x" class:active={$n > 0} on:click={() => { $n++; }}>
  <Hello name={$label} count={$n} onSave={(v) => v.toUpperCase()} />
</div>;

// @ts-expect-error — wrong prop type
export const bad1 = <Hello name={42} />;
// @ts-expect-error — missing required prop
export const bad2 = <Hello />;
// @ts-expect-error — unknown prop
export const bad3 = <Hello name="a" nope />;
