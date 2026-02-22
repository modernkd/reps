import { Link, createFileRoute } from "@tanstack/react-router";

import styles from "./legal.module.css";

const effectiveDate = "February 22, 2026";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      {
        title: "Terms of Service | Reps",
      },
      {
        name: "description",
        content: "Terms of Service for Reps.",
      },
    ],
  }),
  component: TermsRoute,
});

function TermsRoute() {
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
          <h1>Terms of Service</h1>
          <p>
            These Terms of Service govern your use of Reps. By using the app,
            you agree to these terms.
          </p>

          <h2>Use of the App</h2>
          <p>
            You may use the app for personal fitness tracking. You agree not to
            misuse, disrupt, or attempt unauthorized access to the app or its
            services.
          </p>

          <h2>Accounts and Security</h2>
          <p>
            Cloud sync and authentication are optional. If you use them, you are
            responsible for maintaining the security of your account
            credentials.
          </p>

          <h2>Health Disclaimer</h2>
          <p>
            Reps provides logging and planning tools only. It is not medical
            advice. Consult a qualified professional before beginning or
            changing a fitness program.
          </p>

          <h2>Availability</h2>
          <p>
            We may update, change, or discontinue features at any time,
            including cloud sync functionality.
          </p>

          <h2>Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Reps is provided on an "as
            is" basis without warranties, and we are not liable for indirect or
            consequential damages from use of the app.
          </p>

          <h2>Changes to These Terms</h2>
          <p>
            We may update these terms. Continued use after updates means you
            accept the revised terms.
          </p>

          <h2>Contact</h2>
          <p>
            For terms questions, contact:{" "}
            <a href="mailto:legal@kd.works">legal@kd.works</a>
          </p>
        </div>
      </article>
    </main>
  );
}
