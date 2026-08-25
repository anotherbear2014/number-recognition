export type SpeechClip = {
  src: string;
  playbackRate?: number;
};

type PlaybackFailureHandler = (error: unknown, clip: SpeechClip) => void;

function reportPlaybackFailure(error: unknown, clip: SpeechClip): void {
  console.warn(`Audio playback failed for ${clip.src}.`, error);
}

export class SpeechPlayback {
  private readonly player: HTMLAudioElement;
  private readonly onPlaybackFailure: PlaybackFailureHandler;
  private cancelActiveSpeech: (() => void) | null = null;
  private preparedSource: string | null = null;
  private preparedPlaybackRate = 1;
  private sequence = 0;

  constructor(
    player: HTMLAudioElement = new Audio(),
    onPlaybackFailure: PlaybackFailureHandler = reportPlaybackFailure
  ) {
    this.player = player;
    this.onPlaybackFailure = onPlaybackFailure;
    this.player.preload = 'auto';
  }

  /** Call from a user gesture with the intended Start sound to authorize this persistent player. */
  unlock(clip: SpeechClip): Promise<boolean> {
    return this.playSequence([clip]);
  }

  /** Load an upcoming clip without starting it, so automatic playback need not wait on its fetch. */
  prepare(clip: SpeechClip): void {
    this.stop();
    this.prepareSource(clip);
  }

  stop(): void {
    this.sequence += 1;
    const cancel = this.cancelActiveSpeech;
    this.cancelActiveSpeech = null;
    this.player.pause();
    if (this.preparedSource !== null) {
      this.player.currentTime = 0;
    }
    cancel?.();
  }

  play(clip: SpeechClip): Promise<boolean> {
    return this.playSequence([clip]);
  }

  async playSequence(clips: readonly SpeechClip[]): Promise<boolean> {
    this.stop();
    const sequence = this.sequence;

    for (const clip of clips) {
      const completed = await this.playClip(clip, sequence);
      if (!completed || sequence !== this.sequence) {
        return false;
      }
    }

    return true;
  }

  private prepareSource(clip: SpeechClip): void {
    const playbackRate = clip.playbackRate ?? 1;
    if (this.preparedSource === clip.src && this.preparedPlaybackRate === playbackRate) {
      return;
    }

    this.player.src = clip.src;
    this.player.playbackRate = playbackRate;
    this.player.load();
    this.preparedSource = clip.src;
    this.preparedPlaybackRate = playbackRate;
  }

  private playClip(clip: SpeechClip, sequence: number): Promise<boolean> {
    if (sequence !== this.sequence) {
      return Promise.resolve(false);
    }

    try {
      this.prepareSource(clip);
    } catch (error) {
      this.onPlaybackFailure(error, clip);
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      let settled = false;

      const finish = (completed: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        this.player.removeEventListener('ended', handleEnded);
        this.player.removeEventListener('error', handleError);
        if (this.cancelActiveSpeech === cancelPlayback) {
          this.cancelActiveSpeech = null;
        }
        resolve(completed);
      };
      const fail = (error: unknown): void => {
        if (settled) {
          return;
        }
        this.onPlaybackFailure(error, clip);
        finish(false);
      };
      const handleEnded = (): void => finish(true);
      const handleError = (): void => fail(new Error(`Unable to load audio from ${clip.src}.`));
      const cancelPlayback = (): void => finish(false);

      this.player.addEventListener('ended', handleEnded, { once: true });
      this.player.addEventListener('error', handleError, { once: true });
      this.cancelActiveSpeech = cancelPlayback;

      // Calling play immediately lets the browser wait for readiness without losing user activation.
      try {
        void this.player.play().catch(fail);
      } catch (error) {
        fail(error);
      }
    });
  }
}

export function chooseNonRepeatingIndex(
  itemCount: number,
  previousIndex: number | null,
  random: () => number = Math.random
): number {
  if (!Number.isInteger(itemCount) || itemCount < 1) {
    throw new Error('At least one item is required.');
  }

  const choices = Array.from({ length: itemCount }, (_, index) => index).filter(
    (index) => itemCount === 1 || index !== previousIndex
  );
  return choices[Math.floor(random() * choices.length)];
}
