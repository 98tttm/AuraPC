import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-checkout-stepper',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './checkout-stepper.component.html',
    styleUrl: './checkout-stepper.component.css'
})
export class CheckoutStepperComponent {
    @Input() step: number = 1;
}
