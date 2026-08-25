type ScheduleTimer = (callback: () => void, delayMs: number) => number;
type CancelTimer = (timerId: number) => void;

export class QuestionPromptScheduler {
  private timerId: number | null = null;
  private readonly scheduleTimer: ScheduleTimer;
  private readonly cancelTimer: CancelTimer;

  constructor(
    scheduleTimer: ScheduleTimer = (callback, delayMs) => window.setTimeout(callback, delayMs),
    cancelTimer: CancelTimer = (timerId) => window.clearTimeout(timerId)
  ) {
    this.scheduleTimer = scheduleTimer;
    this.cancelTimer = cancelTimer;
  }

  schedule(prompt: () => void, delayMs: number): void {
    this.cancel();
    this.timerId = this.scheduleTimer(() => {
      this.timerId = null;
      prompt();
    }, delayMs);
  }

  cancel(): void {
    if (this.timerId === null) {
      return;
    }

    this.cancelTimer(this.timerId);
    this.timerId = null;
  }
}
