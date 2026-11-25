import { Icon } from './Icon';

/**
 * The parts of a filter bar (My Arsenal, the Ingredient Index): a name search, compact dropdowns
 * and an on/off toggle. Native controls underneath, so keyboard and screen-reader behaviour come for
 * free; each carries its label for assistive technology, and the bar stays one quiet row.
 */

export function FilterSearch({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <span className="filter-search">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Icon name="search" size={16} />
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  );
}

/** A dropdown with a drawn chevron, lit cyan while `active`, so a filter in use is never missed. */
export function FilterSelect({
  id,
  label,
  value,
  active = false,
  className,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  /** Narrowing the list. A sort order is never active. */
  active?: boolean;
  className?: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <span
      className={className ? `filter-select ${className}` : 'filter-select'}
      data-active={active ? '' : undefined}
    >
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      <Icon name="chevron-down" size={16} className="filter-select__chevron" />
    </span>
  );
}

/** An on/off filter, lit the same way as an active dropdown. */
export function FilterToggle({
  pressed,
  onToggle,
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="filter-toggle" aria-pressed={pressed} onClick={onToggle}>
      {children}
    </button>
  );
}
