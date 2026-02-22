import clsx from "clsx";

import { getCopy } from "@/lib/i18n";
import type { AppLanguage } from "@/lib/i18n";

import styles from "./styles/AppHeader.module.css";

type AppHeaderProps = {
  view: "calendar" | "graph" | "exercises";
  language: AppLanguage;
  templates: Array<{ id: string; name: string }>;
  activeTemplateId?: string;
  onViewChange: (view: "calendar" | "graph" | "exercises") => void;
  onTemplateChange: (templateId: string) => void;
  onApplyTemplateToCalendar: () => void;
  onOpenCreateTemplate: () => void;
  onOpenEditTemplate: (templateId: string) => void;
  onOpenDuplicateTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onOpenCreateWorkout: () => void;
};

export function AppHeader({
  view,
  language,
  templates,
  activeTemplateId,
  onViewChange,
  onTemplateChange,
  onApplyTemplateToCalendar,
  onOpenCreateTemplate,
  onOpenEditTemplate,
  onOpenDuplicateTemplate,
  onDeleteTemplate,
  onOpenCreateWorkout,
}: AppHeaderProps) {
  const copy = getCopy(language);
  const canDeleteTemplate = templates.length > 1;
  const activeTemplate = templates.find(
    (template) => template.id === activeTemplateId,
  );
  const hasTemplates = templates.length > 0;
  const hasActiveTemplate = Boolean(activeTemplate);

  const closeActionMenu = (target: HTMLElement) => {
    const details = target.closest("details");
    if (details instanceof HTMLDetailsElement) {
      details.open = false;
    }
  };

  return (
    <header className={styles.wrapper}>
      <div>
        <p className={styles.kicker}>{copy.appHeader.kicker}</p>
        <h1>{copy.appHeader.title}</h1>
      </div>

      <div className={styles.controls}>
        <div
          className={styles.toggle}
          role="tablist"
          aria-label={copy.appHeader.viewSwitcherAria}
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "calendar"}
            className={clsx(view === "calendar" && styles.active)}
            onClick={() => onViewChange("calendar")}
          >
            {copy.appHeader.calendar}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "graph"}
            className={clsx(view === "graph" && styles.active)}
            onClick={() => onViewChange("graph")}
          >
            {copy.appHeader.graphs}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "exercises"}
            className={clsx(view === "exercises" && styles.active)}
            onClick={() => onViewChange("exercises")}
          >
            {copy.appHeader.exercises}
          </button>
        </div>

        <div className={styles.templatePicker}>
          <label htmlFor="template-select">
            {copy.appHeader.templateLabel}
          </label>
          <div className={styles.templatePickerRow}>
            <select
              id="template-select"
              className={styles.templateSelect}
              aria-label={copy.appHeader.selectTemplate}
              value={activeTemplate?.id ?? ""}
              onChange={(event) => {
                if (event.target.value) {
                  onTemplateChange(event.target.value);
                }
              }}
              disabled={!hasTemplates}
            >
              {!hasTemplates ? (
                <option value="">{copy.appHeader.noTemplates}</option>
              ) : (
                <>
                  {!hasActiveTemplate ? (
                    <option value="" disabled>
                      {copy.appHeader.selectTemplate}
                    </option>
                  ) : null}
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </>
              )}
            </select>

            <button
              type="button"
              className={styles.newTemplateAction}
              onClick={onOpenCreateTemplate}
            >
              {copy.appHeader.newTemplate}
            </button>

            <details
              className={styles.templateActions}
              data-disabled={!hasActiveTemplate}
            >
              <summary
                className={styles.meatball}
                aria-label={copy.appHeader.manageTemplateActions(
                  activeTemplate?.name ?? copy.appHeader.templateLabel,
                )}
                aria-disabled={!hasActiveTemplate}
                onClick={(event) => {
                  if (!hasActiveTemplate) {
                    event.preventDefault();
                  }
                }}
              >
                ⋯
              </summary>

              <div className={styles.actionsMenu} role="menu">
                <button
                  type="button"
                  disabled={!hasActiveTemplate}
                  onClick={(event) => {
                    if (!activeTemplate) {
                      return;
                    }
                    onOpenEditTemplate(activeTemplate.id);
                    closeActionMenu(event.currentTarget);
                  }}
                >
                  {copy.appHeader.editTemplate}
                </button>
                <button
                  type="button"
                  disabled={!hasActiveTemplate}
                  onClick={(event) => {
                    if (!activeTemplate) {
                      return;
                    }
                    onOpenDuplicateTemplate(activeTemplate.id);
                    closeActionMenu(event.currentTarget);
                  }}
                >
                  {copy.appHeader.duplicateTemplate}
                </button>
                <button
                  type="button"
                  className={styles.deleteAction}
                  disabled={!canDeleteTemplate || !hasActiveTemplate}
                  title={
                    canDeleteTemplate
                      ? undefined
                      : copy.appHeader.minTemplatesRequired
                  }
                  onClick={(event) => {
                    if (!activeTemplate) {
                      return;
                    }
                    onDeleteTemplate(activeTemplate.id);
                    closeActionMenu(event.currentTarget);
                  }}
                >
                  {copy.appHeader.deleteTemplate}
                </button>
              </div>
            </details>
          </div>
        </div>

        <button
          type="button"
          className={styles.secondary}
          onClick={onApplyTemplateToCalendar}
        >
          {copy.appHeader.addTemplateToCalendar}
        </button>
      </div>
    </header>
  );
}
