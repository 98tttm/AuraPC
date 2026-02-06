import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThreeCanvasComponent } from './components/three-canvas/three-canvas.component';
import { HeaderComponent } from './components/header/header.component';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, ThreeCanvasComponent, HeaderComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'my-client';
}
// Trigger rebuild
