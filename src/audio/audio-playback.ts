export class SpeechPlayback {
  private activeSpeech: HTMLAudioElement | null = null;
  private cancelActiveSpeech: (() => void) | null = null;
  private sequence = 0;

  stop(): void {
    this.sequence += 1;
    const sound = this.activeSpeech;
    const cancel = this.cancelActiveSpeech;
    this.activeSpeech = null;
    this.cancelActiveSpeech = null;

    if (sound) {
      sound.pause();
      sound.currentTime = 0;
    }
    cancel?.();
  }

  play(sound: HTMLAudioElement): void {
    void this.playSequence([sound]);
  }

  async playSequence(sounds: readonly HTMLAudioElement[]): Promise<boolean> {
    this.stop();
    const sequence = this.sequence;

    for (const sound of sounds) {
      const completed = await this.playClip(sound, sequence);
      if (!completed || sequence !== this.sequence) {
        return false;
      }
    }

    return true;
  }

  private playClip(sound: HTMLAudioElement, sequence: number): Promise<boolean> {
    if (sequence !== this.sequence) {
      return Promise.resolve(false);
    }

    sound.pause();
    sound.currentTime = 0;
    this.activeSpeech = sound;

    return new Promise((resolve) => {
      let settled = false;

      const finish = (completed: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        sound.removeEventListener('ended', handleEnded);
        sound.removeEventListener('error', handleError);
        if (this.activeSpeech === sound) {
          this.activeSpeech = null;
          this.cancelActiveSpeech = null;
        }
        resolve(completed);
      };
      const handleEnded = (): void => finish(true);
      const handleError = (): void => finish(false);

      sound.addEventListener('ended', handleEnded, { once: true });
      sound.addEventListener('error', handleError, { once: true });
      this.cancelActiveSpeech = () => finish(false);
      void sound.play().catch(() => finish(false));
    });
  }
}

