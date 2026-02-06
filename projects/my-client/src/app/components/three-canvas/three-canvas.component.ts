import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-three-canvas',
  standalone: true,
  imports: [],
  templateUrl: './three-canvas.component.html',
  styleUrl: './three-canvas.component.css'
})
export class ThreeCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private cube!: THREE.Mesh;
  private animationId!: number;

  ngAfterViewInit(): void {
    this.initThree();
    this.animate();
  }

  private initThree(): void {
    const width = this.canvasContainer.nativeElement.clientWidth;
    const height = this.canvasContainer.nativeElement.clientHeight;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 5;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.canvasContainer.nativeElement.appendChild(this.renderer.domElement);

    // Light
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(2, 2, 5).normalize();
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0x404040));

    // Objects (Example Cube)
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshPhongMaterial({ color: 0x8a2be2 });
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);

    // Resize Handler
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    if (this.cube) {
      this.cube.rotation.x += 0.01;
      this.cube.rotation.y += 0.01;
    }

    this.renderer.render(this.scene, this.camera);
  }

  private onResize(): void {
    if (!this.canvasContainer) return;
    const width = this.canvasContainer.nativeElement.clientWidth;
    const height = this.canvasContainer.nativeElement.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.onResize);
  }
}
