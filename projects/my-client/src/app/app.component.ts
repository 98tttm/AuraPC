import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { map, startWith } from 'rxjs/operators';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { ToastComponent } from './components/toast/toast.component';
import { ChatbotWidgetComponent } from './components/chatbot-widget/chatbot-widget.component';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, ToastComponent, FooterComponent, ChatbotWidgetComponent],
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

  constructor(private router: Router) { }

  ngOnInit(): void {
    this.initScrollAnimations();
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
