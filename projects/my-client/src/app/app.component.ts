import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { ToastComponent } from './components/toast/toast.component';
import { ChatbotWidgetComponent } from './components/chatbot-widget/chatbot-widget.component';
import { SupportChatWidgetComponent } from './components/support-chat-widget/support-chat-widget.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { RealtimeService } from './core/services/realtime.service';
import { AuthService } from './core/services/auth.service';
import { ToastService } from './core/services/toast.service';

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
    <app-support-chat-widget></app-support-chat-widget>
    <app-chatbot-widget></app-chatbot-widget>
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
  `],
})
export class AppComponent implements OnInit, OnDestroy {
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
  private supportMsgSub: Subscription | null = null;
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private realtime = inject(RealtimeService);

  constructor(
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.initScrollAnimations();
    this.supportMsgSub = this.realtime.supportMessageCreated$.subscribe((payload) => {
      const currentUserId = this.auth.currentUser()?._id;
      if (!currentUserId || payload.conversation.user?._id !== currentUserId) return;
      if (payload.message.senderType === 'admin') {
        const name = payload.message.sender?.name || 'Nhân viên tư vấn';
        this.toast.showInfo(`💬 ${name}: ${payload.message.content.slice(0, 80)}`);
      }
    });
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
    this.mutationObs?.disconnect();
    this.supportMsgSub?.unsubscribe();
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
