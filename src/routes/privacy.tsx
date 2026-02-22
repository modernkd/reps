import { Link, createFileRoute } from "@tanstack/react-router";

import styles from "./legal.module.css";

const effectiveDate = "February 22, 2026";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      {
        title: "Privacy Policy | Reps",
      },
      {
        name: "description",
        content: "Privacy Policy for Reps.",
      },
    ],
  }),
  component: PrivacyRoute,
});

function PrivacyRoute() {
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <div className={styles.topRow}>
          <Link to="/" className={styles.backLink}>
            ← Back to Reps
          </Link>
          <p className={styles.meta}>Effective date: {effectiveDate}</p>
        </div>

        <div className={styles.body}>
          <h1>Privacy Policy</h1>
          <p>
            Reps is a local-first app. Your workout data is stored on your
            device by default.
          </p>

          <h2>What We Collect</h2>
          <p>
            We collect workout records, schedule data, templates, and session
            logs that you enter into the app.
          </p>

          <h2>How Data Is Stored</h2>
          <p>
            Data is stored locally in your browser/device. If you enable
            optional cloud sync, your data is also stored in your linked cloud
            account to keep your devices in sync.
          </p>

          <h2>How Data Is Used</h2>
          <ul>
            <li>
              To show your calendar, workout details, and progress graphs.
            </li>
            <li>To support guided workouts, schedules, and reminders.</li>
            <li>To provide account and sync features when you opt in.</li>
          </ul>

          <h2>Data Sharing</h2>
          <p>
            We do not sell your personal data. We only share data with
            infrastructure providers required to run optional cloud sync and
            authentication.
          </p>

          <h2>Your Controls</h2>
          <ul>
            <li>You can edit or delete workout data in the app at any time.</li>
            <li>
              You can sign out and disable cloud sync from account settings.
            </li>
            <li>You can clear local data by clearing your browser storage.</li>
          </ul>

          <h2>Contact</h2>
          <p>
            For privacy questions, contact:{" "}
            <a href="mailto:privacy@kd.works">privacy@kd.works</a>
          </p>
        </div>
      </article>
    </main>
  );
}
