import clsx from "clsx";

import { getCopy } from "@/lib/i18n";
import type { AppLanguage } from "@/lib/i18n";

import styles from "./styles/AppHeader.module.css";

type AppHeaderProps = {
  view: "calendar" | "graph" | "exercises";
  language: AppLanguage;
  greetingName?: string | null;
  templates: Array<{ id: string; name: string }>;
  activeTemplateId?: string;
  onViewChange: (view: "calendar" | "graph" | "exercises") => void;
  onTemplateChange: (templateId: string) => void;
  onApplyTemplateToCalendar: (templateId: string) => void;
  onOpenCreateTemplate: () => void;
  onOpenEditTemplate: (templateId: string) => void;
  onOpenDuplicateTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
};

export function AppHeader({
  view,
  language,
  greetingName,
  templates,
  activeTemplateId,
  onViewChange,
  onTemplateChange,
  onApplyTemplateToCalendar,
  onOpenCreateTemplate,
  onOpenEditTemplate,
  onOpenDuplicateTemplate,
  onDeleteTemplate,
}: AppHeaderProps) {
  const copy = getCopy(language);
  const canDeleteTemplate = templates.length > 1;
  const activeTemplate = templates.find(
    (template) => template.id === activeTemplateId,
  );
  const hasTemplates = templates.length > 0;

  const closeActionMenu = (target: HTMLElement) => {
    const wrapper = target.closest(`.${styles.customSelectWrapper}`);
    if (wrapper instanceof HTMLDetailsElement) {
      wrapper.open = false;
    } else {
      const details = target.closest("details");
      if (details instanceof HTMLDetailsElement) {
        details.open = false;
      }
    }
  };

  return (
    <header className={styles.wrapper}>
      <div>
        <p className={styles.kicker}>{copy.appHeader.kicker}</p>
        <h1>{copy.appHeader.title}</h1>
        {greetingName ? (
          <p className={styles.greeting}>
            {copy.appHeader.greeting(greetingName)}
          </p>
        ) : null}
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
            <details className={styles.customSelectWrapper}>
              <summary
                className={styles.customSelectButton}
                aria-label={copy.appHeader.selectTemplate}
              >
                <span className={styles.customSelectLabel}>
                  {hasTemplates
                    ? activeTemplate?.name ?? copy.appHeader.selectTemplate
                    : copy.appHeader.noTemplates}
                </span>
                <span className={styles.customSelectCaret}>▼</span>
              </summary>
              <div className={styles.customSelectMenu}>
                {templates.map((template) => (
                  <div key={template.id} className={styles.templateOptionRow}>
                    <button
                      type="button"
                      className={styles.templateOptionButton}
                      onClick={(event) => {
                        onTemplateChange(template.id);
                        closeActionMenu(event.currentTarget);
                      }}
                    >
                      {template.name}
                      {template.id === activeTemplateId && (
                        <span className={styles.activeCheck}>✓</span>
                      )}
                    </button>

                    <details className={styles.templateActions}>
                      <summary
                        className={styles.meatball}
                        aria-label={copy.appHeader.manageTemplateActions(
                          template.name,
                        )}
                      >
                        ⋯
                      </summary>

                      <div className={styles.actionsMenu} role="menu">
                        <button
                          type="button"
                          onClick={(event) => {
                            onApplyTemplateToCalendar(template.id);
                            closeActionMenu(event.currentTarget);
                          }}
                        >
                          {copy.appHeader.addTemplateToCalendar}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            onOpenEditTemplate(template.id);
                            closeActionMenu(event.currentTarget);
                          }}
                        >
                          {copy.appHeader.editTemplate}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            onOpenDuplicateTemplate(template.id);
                            closeActionMenu(event.currentTarget);
                          }}
                        >
                          {copy.appHeader.duplicateTemplate}
                        </button>
                        <button
                          type="button"
                          className={styles.deleteAction}
                          disabled={!canDeleteTemplate}
                          title={
                            canDeleteTemplate
                              ? undefined
                              : copy.appHeader.minTemplatesRequired
                          }
                          onClick={(event) => {
                            onDeleteTemplate(template.id);
                            closeActionMenu(event.currentTarget);
                          }}
                        >
                          {copy.appHeader.deleteTemplate}
                        </button>
                      </div>
                    </details>
                  </div>
                ))}

                {hasTemplates && <hr className={styles.menuDivider} />}

                <button
                  type="button"
                  className={styles.newTemplateDropdownAction}
                  onClick={(event) => {
                    onOpenCreateTemplate();
                    closeActionMenu(event.currentTarget);
                  }}
                >
                  + {copy.appHeader.newTemplate}
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}
