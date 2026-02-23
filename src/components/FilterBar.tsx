import clsx from "clsx";

import type { AppLanguage } from "@/lib/i18n";
import { getCopy, localizeWorkoutTypeName } from "@/lib/i18n";
import type { WorkoutType } from "@/lib/types";

import styles from "./styles/FilterBar.module.css";

type FilterBarProps = {
  language: AppLanguage;
  selectedTypeIds: string[];
  types: WorkoutType[];
  onChange: (next: string[]) => void;
};

export function FilterBar({
  language,
  selectedTypeIds,
  types,
  onChange,
}: FilterBarProps) {
  const copy = getCopy(language);
  const selectedSet = new Set(selectedTypeIds);
  const allSelected =
    selectedTypeIds.length === 0 || selectedTypeIds.length === types.length;

  const toggle = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    if (next.size === 0 || next.size === types.length) {
      onChange([]);
      return;
    }

    onChange([...next]);
  };

  return (
    <section className={styles.wrapper} aria-label={copy.filterBar.ariaLabel}>
      <button
        type="button"
        className={clsx(styles.pill, allSelected && styles.active)}
        onClick={() => onChange([])}
      >
        {copy.filterBar.allTypes}
      </button>

      {types.map((type) => {
        const selected = selectedSet.has(type.id);

        return (
          <button
            key={type.id}
            type="button"
            className={clsx(styles.pill, selected && styles.active)}
            style={{ "--pill-accent": type.color } as React.CSSProperties}
            onClick={() => toggle(type.id)}
          >
            {localizeWorkoutTypeName(type, language)}
          </button>
        );
      })}
    </section>
  );
}
