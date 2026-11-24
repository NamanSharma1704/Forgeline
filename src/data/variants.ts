/**
 * Weapon variants: Prime, Kuva, Vandal and the rest. Each is a separate weapon in the game, with its
 * own mastery, its own recipe and its own sell check, so lists let a player see one kind at a time.
 *
 * Read from the name at build time. The game marks variants consistently in names ("Braton Prime",
 * "Kuva Bramma", "Mk1-Braton"), and @wfcd/items has no variant field beyond isPrime, so a name rule
 * is the source of truth. New weapons from a monthly refresh are classified without any change here
 * unless the game introduces a new variant line.
 */

/** The groups lists filter by. Small lines with few weapons share "other". */
export type Variant = 'normal' | 'prime' | 'lich' | 'event' | 'prisma' | 'syndicate' | 'other';

export const VARIANT_ORDER: readonly Variant[] = [
  'normal',
  'prime',
  'lich',
  'event',
  'prisma',
  'syndicate',
  'other',
];

export const VARIANT_LABEL: Record<Variant, string> = {
  normal: 'Normal',
  prime: 'Prime',
  lich: 'Kuva, Tenet, Coda',
  event: 'Vandal, Wraith',
  prisma: 'Prisma',
  syndicate: 'Syndicate',
  other: 'Other variants',
};

export interface VariantInfo {
  readonly variant: Variant;
  /** The specific line, for display: "Prime", "Kuva", "Telos". Null for a normal weapon. */
  readonly line: string | null;
  /** The name without the variant marker, which groups a weapon with its other versions. */
  readonly base: string;
}

const SUFFIXES: readonly (readonly [string, Variant])[] = [
  ['Prime', 'prime'],
  ['Vandal', 'event'],
  ['Wraith', 'event'],
];

const PREFIXES: readonly (readonly [string, Variant])[] = [
  ['Kuva', 'lich'],
  ['Tenet', 'lich'],
  ['Coda', 'lich'],
  ['Prisma', 'prisma'],
  // The six Syndicates' weapons.
  ['Telos', 'syndicate'],
  ['Vaykor', 'syndicate'],
  ['Rakta', 'syndicate'],
  ['Sancti', 'syndicate'],
  ['Secura', 'syndicate'],
  ['Synoid', 'syndicate'],
  ['Dex', 'other'],
  ['Mara', 'other'],
  ['Carmine', 'other'],
  ['Ceti', 'other'],
  ['Mutalist', 'other'],
];

export function variantOf(name: string): VariantInfo {
  for (const [suffix, variant] of SUFFIXES) {
    if (name.endsWith(` ${suffix}`)) {
      return { variant, line: suffix, base: name.slice(0, -suffix.length - 1) };
    }
  }
  // The starter line is written "Mk1-Braton" in the data and "MK1-Braton" in the game.
  const mk1 = /^mk1-(.+)$/i.exec(name);
  if (mk1) return { variant: 'other', line: 'MK1', base: mk1[1]! };
  for (const [prefix, variant] of PREFIXES) {
    if (name.startsWith(`${prefix} `)) {
      return { variant, line: prefix, base: name.slice(prefix.length + 1) };
    }
  }
  return { variant: 'normal', line: null, base: name };
}
