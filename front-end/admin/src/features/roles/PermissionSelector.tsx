import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { PlatformPermission } from '../../types/platform-role';

interface PermissionSelectorProps {
  options: PlatformPermission[];
  value: string;
  disabled?: boolean;
  onChange: (permissionId: string) => void;
}

export function PermissionSelector({
  options,
  value,
  disabled = false,
  onChange,
}: PermissionSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find((permission) => permission.id === value);
  const visibleOpen = open && !disabled;
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter(
      (permission) =>
        permission.key.toLowerCase().includes(normalized) ||
        permission.description.toLowerCase().includes(normalized),
    );
  }, [options, query]);
  const groupedOptions = useMemo(() => {
    const groups = new Map<string, PlatformPermission[]>();
    filteredOptions.forEach((permission) => {
      const domain = permissionDomain(permission.key);
      groups.set(domain, [...(groups.get(domain) ?? []), permission]);
    });
    return [...groups.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [filteredOptions]);
  const navigableOptions = useMemo(
    () => groupedOptions.flatMap(([, permissions]) => permissions),
    [groupedOptions],
  );

  useEffect(() => {
    if (!visibleOpen) return;
    searchRef.current?.focus();

    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [visibleOpen]);

  function close(restoreFocus = true) {
    setOpen(false);
    setQuery('');
    setHighlightedIndex(0);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function select(permission: PlatformPermission) {
    onChange(permission.id);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && visibleOpen) {
      event.preventDefault();
      close();
      return;
    }

    if (!visibleOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (!visibleOpen || navigableOptions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((current) =>
        current >= navigableOptions.length - 1 ? 0 : current + 1,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) =>
        current <= 0 ? navigableOptions.length - 1 : current - 1,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const permission = navigableOptions[highlightedIndex];
      if (permission) select(permission);
    }
  }

  return (
    <div
      className="permission-selector"
      onKeyDown={handleKeyDown}
      ref={rootRef}
    >
      <button
        aria-expanded={visibleOpen}
        aria-haspopup="listbox"
        aria-label="Permission to grant"
        className="permission-selector-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <span>{selected?.key ?? 'Select an available permission'}</span>
        <span aria-hidden="true">v</span>
      </button>
      {visibleOpen && (
        <div className="permission-selector-panel">
          <input
            aria-activedescendant={
              navigableOptions[highlightedIndex]
                ? `permission-option-${navigableOptions[highlightedIndex].id}`
                : undefined
            }
            aria-controls="permission-options"
            aria-expanded="true"
            aria-label="Search available permissions"
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlightedIndex(0);
            }}
            placeholder="Search permissions..."
            ref={searchRef}
            role="combobox"
            value={query}
          />
          <div
            aria-label="Available permissions"
            className="permission-selector-options"
            id="permission-options"
            role="listbox"
          >
            {navigableOptions.length === 0 ? (
              <p className="permission-selector-empty">No permissions found.</p>
            ) : (
              groupedOptions.map(([domain, permissions]) => (
                <div
                  aria-labelledby={`permission-domain-${domain}`}
                  className="permission-selector-group"
                  key={domain}
                  role="group"
                >
                  <div
                    className="permission-selector-group-label"
                    id={`permission-domain-${domain}`}
                  >
                    {domain}
                  </div>
                  {permissions.map((permission) => {
                    const index = navigableOptions.indexOf(permission);
                    return (
                      <button
                        aria-selected={permission.id === value}
                        className={`permission-selector-option${index === highlightedIndex ? ' permission-selector-option-highlighted' : ''}`}
                        id={`permission-option-${permission.id}`}
                        key={permission.id}
                        onClick={() => select(permission)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        role="option"
                        type="button"
                      >
                        <code>{permission.key}</code>
                        <span>{permission.description}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function permissionDomain(key: string) {
  const parts = key.split('.');
  const domain = parts[0] === 'platform' ? parts[1] : parts[0];
  return (domain || 'OTHER').toUpperCase();
}
