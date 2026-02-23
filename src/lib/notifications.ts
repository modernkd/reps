type SkippedWorkoutNotificationInput = {
  sessionId: string;
  date: string;
  label: string;
  nextDate: string;
};

export async function sendSkippedWorkoutNotification(
  input: SkippedWorkoutNotificationInput,
): Promise<boolean> {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return false;
  }

  let permission = Notification.permission;

  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return false;
    }
  }

  if (permission !== "granted") {
    return false;
  }

  try {
    const notification = new Notification("Workout skipped", {
      body: `${input.label} on ${input.date} was skipped. Move it to ${input.nextDate}?`,
      tag: `skip-session-${input.sessionId}`,
      renotify: true,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return true;
  } catch {
    return false;
  }
}
