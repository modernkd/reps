import {
  type InputHTMLAttributes,
  useRef,
  useState,
} from "react";
import {
  motion,
  useAnimation,
  useMotionValue,
  useTransform,
} from "motion/react";

import styles from "./styles/ScrubSlider.module.css";

// Constants inspired by the Dialkit reference implementation
const MAX_STRETCH = 8;

type ScrubSliderProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "min" | "max" | "step" | "type"
> & {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  formatValue?: (val: number) => string;
  /** If provided, renders hashmarks along the track */
  hashmarks?: number;
};

export function ScrubSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  formatValue = (v) => v.toString(),
  hashmarks,
  className,
  ...props
}: ScrubSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  const [isActive, setIsActive] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startXRef = useRef<number>(0);
  const startValueRef = useRef<number>(value);
  const initialDownXRef = useRef<number>(0);
  const pointerXRef = useRef<number>(0);
  const currentValueRef = useRef(value);
  currentValueRef.current = value;
  
  const [zoomOriginPercent, setZoomOriginPercent] = useState(50);

  // Motion values for fluid dragging
  const rawX = useMotionValue(0); // Tracks pointer movement exactly
  const controls = useAnimation();

  // Calculate percentage of track fill based on bounded value
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  // Visual stretch effect when dragging past bounds
  const xOffset = useTransform(rawX, (x) => {
    if (!containerRef.current) return 0;
    const { width } = containerRef.current.getBoundingClientRect();

    // Convert value to an ideal X pixel coordinate
    const idealX = (percentage / 100) * width;

    // Determine how far rawX is from the ideal bounds
    const dx = x - idealX;

    if (dx > 0 && value >= max) {
      return MAX_STRETCH * (1 - Math.exp(-dx / 50));
    }
    if (dx < 0 && value <= min) {
      return -MAX_STRETCH * (1 - Math.exp(dx / 50));
    }

    return 0; // Within bounds, no stretch
  });

  // Calculate value based on pointer position relative to container
  const updateValueFromPointer = (clientX: number) => {
    if (!containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    
    let targetValue: number;

    if (isZoomed) {
      // Fine control mode: 4x less sensitive for fat fingers
      const draggedPhysicalDistance = clientX - startXRef.current;
      const normalUnitsPerPixel = (max - min) / width;
      const fineUnitsPerPixel = normalUnitsPerPixel * 0.25; 
      
      targetValue = startValueRef.current + (draggedPhysicalDistance * fineUnitsPerPixel);
    } else {
      // Normal map to value space based on percentage
      const rawPercentage = (clientX - left) / width;
      targetValue = min + rawPercentage * (max - min);
    }
    
    // Snap to step
    const remainder = targetValue % step;
    let snappedValue = targetValue - remainder;
    if (remainder >= step / 2) {
      snappedValue += step;
    } else if (remainder <= -step / 2) {
        snappedValue -= step;
    }

    // Clamp
    const clampedValue = Math.max(min, Math.min(max, snappedValue));
    
    // To handle floating point issues with steps (e.g. 0.1)
    const factor = 1 / step;
    const finalValue = Math.round(clampedValue * factor) / factor;

    if (finalValue !== value) {
      onChange(finalValue);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // If we're clicking the input to edit, don't start dragging
    if (isEditing) return;
    
    setIsActive(true);
    setIsZoomed(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    
    initialDownXRef.current = e.clientX;
    pointerXRef.current = e.clientX;
    
    // Initial sync
    const { left, width } = containerRef.current!.getBoundingClientRect();
    setZoomOriginPercent(((e.clientX - left) / width) * 100);
    rawX.set(e.clientX - left);
    updateValueFromPointer(e.clientX);
    
    controls.start({ scaleY: 0.96, transition: { duration: 0.1 } });

    // Start long press detection for zoom mode
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = setTimeout(() => {
      setIsZoomed(true);
      startValueRef.current = currentValueRef.current; // Anchor to exact currently rounded value
      startXRef.current = pointerXRef.current; // Anchor to exact resting pointer position
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 400); // 400ms hold to zoom
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isActive || isEditing) return;

    pointerXRef.current = e.clientX;

    // If they move too much before the timer hits, cancel the zoom timer
    if (!isZoomed && Math.abs(e.clientX - initialDownXRef.current) > 10) {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
    }
    
    const { left } = containerRef.current!.getBoundingClientRect();
    rawX.set(e.clientX - left);
    updateValueFromPointer(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isActive) return;
    
    setIsActive(false);
    setIsZoomed(false);
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    // Animate back the stretch and scale
    rawX.set(0);
    controls.start({ scaleY: 1, transition: { type: "spring", stiffness: 400, damping: 25 } });
  };

  // Direct edit handlers
  const handleValueClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setInputValue(value.toString());
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleInputBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setInputValue(value.toString());
    }
  };

  return (
    <motion.div
      ref={containerRef}
      data-zoomed={isZoomed}
      className={`${styles.container} ${className || ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      animate={controls}
      style={{
        x: xOffset,
        cursor: isEditing ? "text" : isZoomed ? "ew-resize" : "ew-resize",
        touchAction: "none", // Crucial for preventing scroll during drag on mobile
      }}
    >
      <motion.div 
        className={styles.trackContent}
        animate={{ scaleX: isZoomed ? 4 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        style={{ transformOrigin: `${zoomOriginPercent}% 50%` }}
      >
        <div className={styles.textureNormal} data-zoomed={isZoomed} />
        <div className={styles.textureZoomed} data-zoomed={isZoomed} />

        {hashmarks ? (
          <div className={styles.hashmarks} aria-hidden="true">
            {Array.from({ length: hashmarks + 1 }).map((_, i) => (
              <div key={i} className={styles.hashmark} />
            ))}
          </div>
        ) : null}
        
        <div 
          className={styles.fill} 
          style={{ width: `${percentage}%` }}
        />
      </motion.div>
        
      <div className={styles.labels}>
        {label && <span className={styles.labelText}>{label}</span>}
        
        <div className={styles.valueWrap}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              className={styles.valueInput}
              step={step}
              min={min}
              max={max}
              {...props}
            />
          ) : (
            <span 
              className={styles.valueText}
              onClick={handleValueClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                   e.preventDefault();
                   handleValueClick(e as any);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Edit ${label || "value"}`}
            >
              {formatValue(value)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
