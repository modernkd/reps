import { useEffect, useMemo, useState } from "react";

import type { AppLanguage } from "@/lib/i18n";
import { getCopy, localizeWorkoutTypeName } from "@/lib/i18n";
import type { Workout, WorkoutIntensity, WorkoutType } from "@/lib/types";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { ScrubSlider } from "@/components/ui/ScrubSlider";

import styles from "./styles/WorkoutForm.module.css";

export type WorkoutFormValue = {
  date: string;
  type: string;
  durationMin: number;
  targetWeightKg?: number;
  distanceKm?: number;
  intensity?: WorkoutIntensity;
  notes?: string;
};

type WorkoutFormProps = {
  language: AppLanguage;
  initialValue?: Workout;
  defaultDate: string;
  types: WorkoutType[];
  onSubmit: (value: WorkoutFormValue) => Promise<void> | void;
  onCancel: () => void;
};

type FieldErrors = {
  durationMin?: string;
  targetWeightKg?: string;
  distanceKm?: string;
  type?: string;
};

export function WorkoutForm({
  language,
  initialValue,
  defaultDate,
  types,
  onSubmit,
  onCancel,
}: WorkoutFormProps) {
  const copy = getCopy(language);
  const defaultType = useMemo(() => types[0]?.id ?? "lift", [types]);

  const [date, setDate] = useState(initialValue?.date ?? defaultDate);
  const [type, setType] = useState(initialValue?.type ?? defaultType);
  const [durationMin, setDurationMin] = useState(
    initialValue?.durationMin ?? 45,
  );
  const [targetWeightKg, setTargetWeightKg] = useState(
    initialValue?.targetWeightKg ? String(initialValue.targetWeightKg) : "",
  );
  const [distanceKm, setDistanceKm] = useState(
    initialValue?.distanceKm ? String(initialValue.distanceKm) : "",
  );
  const [intensity, setIntensity] = useState<WorkoutIntensity | "">(
    initialValue?.intensity ?? "",
  );
  const [notes, setNotes] = useState(initialValue?.notes ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!type && defaultType) {
      setType(defaultType);
    }
  }, [type, defaultType]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FieldErrors = {};
    const parsedDuration = Number(durationMin);
    const parsedTargetWeight = targetWeightKg
      ? Number(targetWeightKg)
      : undefined;
    const parsedDistance = distanceKm ? Number(distanceKm) : undefined;

    if (!type) {
      nextErrors.type = copy.form.selectTypeError;
    }

    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      nextErrors.durationMin = copy.form.durationError;
    }

    if (
      parsedTargetWeight !== undefined &&
      (!Number.isFinite(parsedTargetWeight) || parsedTargetWeight <= 0)
    ) {
      nextErrors.targetWeightKg = copy.form.targetWeightError;
    }

    if (
      parsedDistance !== undefined &&
      (!Number.isFinite(parsedDistance) || parsedDistance <= 0)
    ) {
      nextErrors.distanceKm = copy.form.distanceError;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      await onSubmit({
        date,
        type,
        durationMin: parsedDuration,
        targetWeightKg: parsedTargetWeight,
        distanceKm: parsedDistance,
        intensity: intensity || undefined,
        notes: notes.trim() || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label>
        {copy.form.date}
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </label>

      <label>
        {copy.form.type}
        <CustomSelect
          value={type}
          onChange={(val) => setType(val)}
          options={[
            { value: "", label: copy.form.selectType },
            ...types.map((item) => ({
              value: item.id,
              label: localizeWorkoutTypeName(item, language),
            })),
          ]}
        />
        {errors.type ? (
          <span className={styles.error}>{errors.type}</span>
        ) : null}
      </label>

      <label>
        {copy.form.duration}
        <div className={styles.sliderField}>
          <ScrubSlider
            value={durationMin}
            onChange={(value) => setDurationMin(value)}
            min={5}
            max={300}
            step={5}
            label={copy.form.duration}
            formatValue={(value) => `${Math.round(value)} min`}
          />
        </div>
        <input type="hidden" name="durationMin" value={durationMin} readOnly />
        {errors.durationMin ? (
          <span className={styles.error}>{errors.durationMin}</span>
        ) : null}
      </label>

      <label>
        {copy.form.targetWeight}
        <ScrubSlider
          value={targetWeightKg ? Number(targetWeightKg) : 0}
          onChange={(val) => setTargetWeightKg(val === 0 ? "" : String(val))}
          min={0}
          max={200}
          step={0.5}
          formatValue={(val) => val === 0 ? copy.form.notSet : `${val} kg`}
        />
        {errors.targetWeightKg ? (
          <span className={styles.error}>{errors.targetWeightKg}</span>
        ) : null}
      </label>

      <label>
        {copy.form.distance}
        <ScrubSlider
          value={distanceKm ? Number(distanceKm) : 0}
          onChange={(val) => setDistanceKm(val === 0 ? "" : String(val))}
          min={0}
          max={50}
          step={0.1}
          formatValue={(val) => val === 0 ? copy.form.notSet : `${val.toFixed(1)} km`}
        />
        {errors.distanceKm ? (
          <span className={styles.error}>{errors.distanceKm}</span>
        ) : null}
      </label>

      <label>
        {copy.form.intensity}
        <CustomSelect
          value={intensity}
          onChange={(val) => setIntensity(val as WorkoutIntensity | "")}
          options={[
            { value: "", label: copy.form.notSet },
            { value: "low", label: copy.form.low },
            { value: "medium", label: copy.form.medium },
            { value: "high", label: copy.form.high },
          ]}
        />
      </label>

      <label>
        {copy.form.notes}
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          placeholder={copy.form.notesPlaceholder}
        />
      </label>

      <div className={styles.actions}>
        <button type="button" onClick={onCancel} className={styles.secondary}>
          {copy.common.cancel}
        </button>
        <button type="submit" disabled={isSaving} className={styles.primary}>
          {isSaving
            ? copy.common.saving
            : initialValue
              ? copy.form.saveChanges
              : copy.form.createWorkout}
        </button>
      </div>
    </form>
  );
}
