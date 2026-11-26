import type { PermissionGroup } from '@/api/types';
import { Checkbox } from '@/components/ui';
import type { Permission } from '@/lib/permissions';
import { catalogKeys, effectivePermissions, impliedPermissions } from './permissions';

/**
 * Role permission editor. `value` is the explicit selection; permissions it
 * implies (manage → view, any order action → POS access) are shown checked
 * and locked, exactly as the server will store them.
 */
export function PermissionMatrix({
  catalog,
  value,
  onChange,
}: {
  catalog: PermissionGroup[];
  value: Permission[];
  onChange: (value: Permission[]) => void;
}) {
  const selected = new Set(value);
  const implied = impliedPermissions(selected);
  const effective = effectivePermissions(selected);
  const labels = new Map(catalog.flatMap((group) => group.permissions.map((item) => [item.key, item.label] as const)));

  const commit = (next: Set<Permission>) => onChange(catalogKeys(catalog).filter((key) => next.has(key)));

  const toggle = (key: Permission, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    commit(next);
  };

  const toggleGroup = (group: PermissionGroup, checked: boolean) => {
    const next = new Set(selected);
    for (const item of group.permissions) {
      if (checked) next.add(item.key);
      else next.delete(item.key);
    }
    commit(next);
  };

  return (
    <div className="columns-1 gap-4 lg:columns-2">
      {catalog.map((group) => {
        const checkedCount = group.permissions.filter((item) => effective.has(item.key)).length;
        return (
          <section
            key={group.key}
            className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-ink-150 bg-white"
          >
            <header className="flex items-center justify-between gap-3 border-b border-ink-100 bg-ink-25 px-4 py-3">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-semibold text-ink-900">{group.label}</h4>
                <p className="mt-0.5 text-xs text-ink-500 tabular">
                  Выбрано {checkedCount} из {group.permissions.length}
                </p>
              </div>
              <Checkbox
                className="shrink-0"
                label="Выбрать все"
                checked={checkedCount === group.permissions.length}
                onChange={(checked) => toggleGroup(group, checked)}
              />
            </header>
            <ul className="flex flex-col gap-3.5 px-4 py-4">
              {group.permissions.map((item) => {
                const requiredBy = implied.get(item.key);
                return (
                  <li
                    key={item.key}
                    title={
                      requiredBy
                        ? `Требуется для: ${requiredBy.map((key) => `«${labels.get(key) ?? key}»`).join(', ')}`
                        : undefined
                    }
                  >
                    <Checkbox
                      checked={effective.has(item.key)}
                      disabled={Boolean(requiredBy)}
                      onChange={(checked) => toggle(item.key, checked)}
                      label={
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          {item.label}
                          {requiredBy && (
                            <span className="text-xs font-medium text-brand-700">включено автоматически</span>
                          )}
                        </span>
                      }
                      description={item.description}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
