import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { IntroStateService } from './core/services/intro-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @if (introState.shellVisible()) {
      <app-header></app-header>
    }
    <main>
      <router-outlet></router-outlet>
    </main>
    @if (introState.shellVisible()) {
      <app-footer></app-footer>
    }
  `,
  styles: [`
    main {
      min-height: 100vh;
    }
  `],
})
export class AppComponent {
  constructor(public introState: IntroStateService) {}
}
