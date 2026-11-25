/**
 * The small marks (design plan 11.7), drawn and reused everywhere. The laurel is MasteredMark (it
 * reads the arsenal); corner brackets are the .shape--frame class.
 */

/** A rotated square: tree nodes, active tabs, rule ends. Gold by default; steel for the inactive. */
export function DiamondNode({ tone = 'gold' }: { tone?: 'gold' | 'steel' }) {
  return <span className="diamond-node" data-tone={tone} aria-hidden="true" />;
}

/** A section rule: a hairline that starts with a gold diamond. */
export function DiamondRule() {
  return <hr className="diamond-rule" />;
}
