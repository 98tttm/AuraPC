import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { map, startWith } from 'rxjs/operators';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { ToastComponent } from './components/toast/toast.component';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, ToastComponent, FooterComponent],
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
export class AppComponent {
  hideFooter = toSignal(
    this.router.events.pipe(
      startWith(null),
      map(() => this.router.url.startsWith('/aura-builder'))
    ),
    { initialValue: false }
  );

  constructor(private router: Router) { }
}
