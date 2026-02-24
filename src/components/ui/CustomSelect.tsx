import { useRef, useEffect } from "react";
import styles from "../styles/CustomSelect.module.css";

export type Option = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  className,
}: CustomSelectProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  const closeMenu = () => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    closeMenu();
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        detailsRef.current &&
        !detailsRef.current.contains(event.target as Node)
      ) {
        detailsRef.current.open = false;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <details 
      ref={detailsRef} 
      className={className ? `${styles.customSelectWrapper} ${className}` : styles.customSelectWrapper}
    >
      <summary className={styles.customSelectButton} aria-label={placeholder}>
        <span className={styles.customSelectLabel}>{displayLabel}</span>
        <span className={styles.customSelectCaret}>▼</span>
      </summary>
      <div className={styles.customSelectMenu}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={styles.selectOptionButton}
            onClick={() => handleSelect(option.value)}
          >
            <span>{option.label}</span>
            {option.value === value && (
              <span className={styles.activeCheck}>✓</span>
            )}
          </button>
        ))}
      </div>
    </details>
  );
}
