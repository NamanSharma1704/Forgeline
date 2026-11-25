'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { TreeEdge } from './FamilyTree';

/**
 * The schematic's circuit (design plan 4.4): orthogonal wires from each ingredient's box to the box
 * it goes into, measured from the laid-out boxes and drawn in one SVG behind them. Pointing at or
 * focusing a box lights its wires. Each wire carries its copy count at the end away from the
 * weapon, where that box's caption says the same in words.
 *
 * Wires are drawn only while the columns sit side by side. When they stack (phones), or before the
 * page is hydrated, the arrow icons between columns do the job instead.
 */

interface Wire {
  readonly key: string;
  readonly from: string;
  readonly to: string;
  readonly d: string;
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
  readonly label: { readonly x: number; readonly y: number; readonly text: string } | null;
}

/** An orthogonal path with softened corners, the way a trace turns on a board. */
function trace(x1: number, y1: number, xm: number, y2: number, x2: number): string {
  const dy = y2 - y1;
  if (Math.abs(dy) < 1) return `M${x1} ${y1}H${x2}`;
  const r = Math.min(6, Math.abs(dy) / 2, (xm - x1) / 2, (x2 - xm) / 2);
  const s = Math.sign(dy);
  return [
    `M${x1} ${y1}`,
    `H${xm - r}`,
    `Q${xm} ${y1} ${xm} ${y1 + s * r}`,
    `V${y2 - s * r}`,
    `Q${xm} ${y2} ${xm + r} ${y2}`,
    `H${x2}`,
  ].join('');
}

export function TreeWires({ edges, children }: { edges: readonly TreeEdge[]; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [wires, setWires] = useState<readonly Wire[]>([]);
  const [lit, setLit] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;

    // A box shared by two wires at its far end would stack two counts on one spot: leave it to the caption.
    const farCount = new Map<string, number>();
    for (const edge of edges) {
      const far = edge[edge.far];
      farCount.set(far, (farCount.get(far) ?? 0) + 1);
    }

    const measure = () => {
      const base = element.getBoundingClientRect();
      const boxes = new Map<string, DOMRect>();
      element.querySelectorAll<HTMLElement>('[data-box]').forEach((box) => {
        boxes.set(box.dataset.box!, box.getBoundingClientRect());
      });
      const next: Wire[] = [];
      for (const edge of edges) {
        const a = boxes.get(edge.from);
        const b = boxes.get(edge.to);
        if (!a || !b) continue;
        // Stacked columns: no room between them for a wire.
        if (b.left < a.right) {
          setWires([]);
          return;
        }
        const x1 = a.right - base.left;
        const y1 = a.top + a.height / 2 - base.top;
        const x2 = b.left - base.left;
        const y2 = b.top + b.height / 2 - base.top;
        const xm = (x1 + x2) / 2;
        const far = edge[edge.far];
        const label =
          farCount.get(far) === 1
            ? edge.far === 'from'
              ? { x: (x1 + xm) / 2, y: y1 - 7, text: `×${edge.copies}` }
              : { x: (xm + x2) / 2, y: y2 - 7, text: `×${edge.copies}` }
            : null;
        next.push({
          key: `${edge.from}>${edge.to}`,
          from: edge.from,
          to: edge.to,
          d: trace(x1, y1, xm, y2, x2),
          start: [x1, y1],
          end: [x2, y2],
          label,
        });
      }
      setWires(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('[data-box]').forEach((box) => observer.observe(box));
    return () => observer.disconnect();
  }, [edges]);

  const boxOf = (target: EventTarget | null) =>
    target instanceof Element ? (target.closest<HTMLElement>('[data-box]')?.dataset.box ?? null) : null;

  return (
    <div
      ref={root}
      className="tree"
      data-wired={wires.length > 0 ? '' : undefined}
      onPointerOver={(event) => setLit(boxOf(event.target))}
      onPointerLeave={() => setLit(null)}
      onFocus={(event) => setLit(boxOf(event.target))}
      onBlur={() => setLit(null)}
    >
      {wires.length > 0 && (
        <svg className="tree-wires" aria-hidden="true" focusable="false">
          {wires.map((wire) => {
            const on = lit !== null && (wire.from === lit || wire.to === lit);
            const [x2, y2] = wire.end;
            return (
              <g key={wire.key} className={on ? 'tree-wire is-lit' : 'tree-wire'}>
                <path className="tree-wire__trace" d={wire.d} />
                <circle className="tree-wire__pad" cx={wire.start[0]} cy={wire.start[1]} r={2.5} />
                <path className="tree-wire__head" d={`M${x2 - 6} ${y2 - 4}L${x2 - 1} ${y2}L${x2 - 6} ${y2 + 4}`} />
                {wire.label && (
                  <text className="tree-wire__count" x={wire.label.x} y={wire.label.y} textAnchor="middle">
                    {wire.label.text}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {children}
    </div>
  );
}
