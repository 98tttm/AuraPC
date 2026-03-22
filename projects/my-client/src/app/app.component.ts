import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, OnDestroy, inject, HostListener, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { map, startWith } from 'rxjs/operators';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { ToastComponent } from './components/toast/toast.component';
import { ChatbotWidgetComponent } from './components/chatbot-widget/chatbot-widget.component';
import { SupportChatWidgetComponent } from './components/support-chat-widget/support-chat-widget.component';
import { toSignal } from '@angular/core/rxjs-interop';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, ToastComponent, FooterComponent, SupportChatWidgetComponent, ChatbotWidgetComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: { '[class.route-aura-builder]': 'hideFooter()' },
  template: `
    <app-toast></app-toast>
    <app-header></app-header>
    <main>
      <router-outlet></router-outlet>
    </main>
    @if (!hideFooter()) {
      <app-footer></app-footer>
    }
    <div class="floating-actions">
      @if (showScrollTop()) {
        <button class="scroll-top-btn" (click)="scrollToTop()" title="Lên đầu trang">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 15l-6-6-6 6"/>
          </svg>
        </button>
      }
      @if (!hideFooter()) {
        <app-support-chat-widget></app-support-chat-widget>
        <app-chatbot-widget></app-chatbot-widget>
      }
    </div>
  `,
  styles: [`
    main {
      min-height: 100vh;
    }
    :host.route-aura-builder main {
      min-height: 0;
      height: calc(100vh - 72px);
      overflow: hidden;
    }
    .floating-actions {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 1200;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
    }
    .scroll-top-btn {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s, background 0.2s, border-color 0.2s;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      animation: scrollBtnIn 0.3s ease-out;
    }
    .scroll-top-btn:hover {
      background: #FF6D2D;
      border-color: #FF6D2D;
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(255, 109, 45, 0.3);
    }
    @keyframes scrollBtnIn {
      from { opacity: 0; transform: translateY(12px) scale(0.8); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  showScrollTop = signal(false);

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.isBrowser) return;
    this.showScrollTop.set(window.scrollY > 600);
  }

  scrollToTop(): void {
    if (!this.isBrowser) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  hideFooter = toSignal(
    this.router.events.pipe(
      startWith(null),
      map(() => this.router.url.startsWith('/aura-builder'))
    ),
    { initialValue: false }
  );

  private scrollObserver: IntersectionObserver | null = null;
  private mutationObs: MutationObserver | null = null;
  private observedEls = new WeakSet<Element>();

  constructor(
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.initScrollAnimations();
    // Tin nhắn tư vấn chỉ hiển thị trong khung chat (SupportChatWidget), không bật toast/popup toàn trang.
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
    this.mutationObs?.disconnect();
  }

  private initScrollAnimations(): void {
    this.scrollObserver = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' },
    );
    this.observeNewFadeElements();
    this.mutationObs = new MutationObserver(() => this.observeNewFadeElements());
    this.mutationObs.observe(document.body, { childList: true, subtree: true });
  }

  private observeNewFadeElements(): void {
    if (!this.scrollObserver) return;
    document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right, .scale-in').forEach((el) => {
      if (!this.observedEls.has(el)) {
        this.observedEls.add(el);
        this.scrollObserver!.observe(el);
      }
    });
  }
}
