import { Injectable, signal } from '@angular/core';

/**
 * Trạng thái intro toàn app: ẩn header/footer cho đến khi màn chờ kết thúc.
 * Homepage gọi setIntroComplete() khi intro fade out xong.
 */
@Injectable({ providedIn: 'root' })
export class IntroStateService {
  /** true = hiện header + footer (sau khi màn load biến mất) */
  readonly shellVisible = signal<boolean>(false);

  setIntroComplete(): void {
    this.shellVisible.set(true);
  }
}
