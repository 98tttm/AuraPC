import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-aura-builder',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './aura-builder.component.html',
    styleUrl: './aura-builder.component.css'
})
export class AuraBuilderComponent {
    steps: string[] = [
        'GPU',
        'CPU',
        'MB',
        'CASE',
        'COOLING',
        'MEMORY',
        'STORAGE',
        'PSU',
        'FANS',
        'ADD-ONS'
    ];

    currentStep: string = ''; // Empty string means Welcome screen

    setStep(step: string) {
        this.currentStep = step;
        // In future logic, this would navigate to specific step view
    }
}
