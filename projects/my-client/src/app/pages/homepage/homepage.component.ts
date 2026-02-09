import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnInit,
  ChangeDetectionStrategy, ChangeDetectorRef, NgZone,
  PLATFORM_ID, Inject, signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { ApiService, Product, Category, BlogPost } from '../../core/services/api.service';
import { IntroStateService } from '../../core/services/intro-state.service';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* ==========================================================================
 *  HOTSPOT CONFIG - BAN CO THE TU CHINH TAY PHAN NAY
 *
 *  Sau khi model load, console se in ra bounding box cua model.
 *  Dung thong tin do de dieu chinh relativePos:
 *    x: 0 = mep trai,  1 = mep phai
 *    y: 0 = day (san),  1 = dinh (cao nhat)
 *    z: 0 = phia sau,   1 = phia truoc (huong camera)
 *
 *  GÓC CAMERA khi bấm chấm: chỉnh cameraOffset (ngay dưới relativePos từng hotspot)
 *    x dương = camera đặt sang phải,  âm = sang trái
 *    y dương = camera cao lên,       âm = thấp xuống
 *    z dương = camera GẦN hơn (cận cảnh),  z nhỏ = camera xa hơn
 *  Camera luôn nhìn vào đúng điểm chấm (hotspot); cameraOffset chỉ đổi vị trí đặt máy quay.
 * ========================================================================== */
const HOTSPOT_CONFIG = [
  {
    id: 'case', label: 'PC Case',
    description: 'Vỏ case gaming cao cấp với thiết kế airflow tối ưu, kính cường lực và hệ thống RGB đồng bộ.',
    specs: ['Mid-Tower ATX', 'Kính cường lực', 'Tản nước 360mm', 'RGB Sync'],
    relativePos: { x: 0.45, y: 0.7, z: 0.05 },
    cameraOffset: { x: 2.0, y: 0.3, z: 2.5 },
  },
  {
    id: 'monitor', label: 'Dual Monitor',
    description: 'Hệ thống dual monitor gaming 27" QHD 165Hz, tấm nền IPS sắc nét.',
    specs: ['2x 27" QHD', '165Hz / 1ms', 'IPS Panel', 'HDR400'],
    relativePos: { x: 0.3, y: 0.76, z: 0.40 },
    cameraOffset: { x: 2.5, y: 0.5, z: 0.7 },
  },
  {
    id: 'keyboard', label: 'Bàn phím cơ',
    description: 'Bàn phím cơ gaming với switch Cherry MX, RGB per-key.',
    specs: ['Cherry MX Red', 'RGB Per-Key', 'TKL Layout', 'USB-C'],
    relativePos: { x: 0.40, y: 0.60, z: 0.50 },
    cameraOffset: { x: 2, y: 1.0, z: -0.5 },
  },
  {
    id: 'chair', label: 'Gaming Chair',
    description: 'Ghế gaming ergonomic với tựa lưng 4D, đệm memory foam.',
    specs: ['Tựa tay 4D', 'Memory Foam', 'Khung thép', 'Ngả 180°'],
    relativePos: { x: 0.65, y: 0.50, z: 0.65 },
    cameraOffset: { x: 2.50, y: 1.0, z: -4.0 },
  },
  {
    id: 'mouse', label: 'Gaming Mouse',
    description: 'Chuột gaming siêu nhẹ 58g, cảm biến 25K DPI.',
    specs: ['58g Siêu nhẹ', '25,600 DPI', 'Switch quang học', 'Wireless'],
    relativePos: { x: 0.40, y: 0.60, z: 0.25 },
    cameraOffset: { x: 0.80, y: 1.0, z: -0.5 },
  },
  {
    id: 'headset', label: 'Headset',
    description: 'Tai nghe gaming 7.1 surround, driver 50mm, micro khử ồn.',
    specs: ['7.1 Surround', 'Driver 50mm', 'Micro ClearCast', 'Wireless'],
    relativePos: { x: 0.40, y: 0.6, z: 0.85 },
    cameraOffset: { x: 0.80, y: 1.0, z: -0.5 },
  },
];

/* ===== Types ===== */
interface Hotspot {
  id: string; label: string; description: string; specs: string[];
  relativePos: { x: number; y: number; z: number };
  cameraOffset: THREE.Vector3;
  worldPos: THREE.Vector3; cameraPos: THREE.Vector3; lookAt: THREE.Vector3;
  screenX: number; screenY: number; visible: boolean;
}

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomepageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('heroCanvas', { static: false }) heroCanvas!: ElementRef<HTMLDivElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animationId = 0;
  private model: THREE.Object3D | null = null;
  private observer: IntersectionObserver | null = null;
  private isBrowser: boolean;
  private particles: THREE.Points | null = null;
  private clock = new THREE.Clock();
  private frameCount = 0;

  /* Camera animation */
  private isAnimating = false;
  private animStartPos = new THREE.Vector3();
  private animEndPos = new THREE.Vector3();
  private animStartTarget = new THREE.Vector3();
  private animEndTarget = new THREE.Vector3();
  private animProgress = 0;
  private animDuration = 1.2;

  /* Default camera - CLOSER to model */
  private defaultCameraPos = new THREE.Vector3(0, 1.8, 4.5);
  private defaultLookAt = new THREE.Vector3(0, 0.8, 0);

  /* State */
  modelLoaded = signal(false);
  introComplete = signal(false);
  activeHotspot = signal<Hotspot | null>(null);
  /** Bật sau khi intro xong một chút để hai khối hero text trượt vào bằng transition (tránh lần 2 ẩn không trượt) */
  heroTextVisible = signal(false);
  /** 0 = bộ chữ đầu (Khám phá/Cá nhân hóa), 1 = bộ chữ thứ hai (Bước vào/Trải nghiệm) – luân phiên sau ~2s khi gõ xong */
  heroHeaderSet = signal(0);
  loadProgress = signal(0);
  /** Trên mobile không load 3D model (tránh WASM OOM), chỉ hiện scene nền */
  private isMobile = false;
  private headerCycleTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private headerCycleIntervalId: ReturnType<typeof setInterval> | null = null;

  /* Build hotspots from config */
  hotspots: Hotspot[] = HOTSPOT_CONFIG.map(cfg => ({
    ...cfg,
    cameraOffset: new THREE.Vector3(cfg.cameraOffset.x, cfg.cameraOffset.y, cfg.cameraOffset.z),
    worldPos: new THREE.Vector3(),
    cameraPos: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
    screenX: 0, screenY: 0, visible: false,
  }));

  /* Section data from API */
  featuredProducts = signal<Product[]>([]);
  apiCategories = signal<Category[]>([]);
  apiBlogs = signal<BlogPost[]>([]);
  readonly benefits = [
    { icon: '🚚', title: 'GIAO HÀNG\nNHANH' }, { icon: '⚙️', title: 'CẤU HÌNH\nĐỘC QUYỀN' },
    { icon: '💬', title: 'TƯ VẤN\nTRỰC TIẾP' }, { icon: '🛡️', title: 'BẢO HÀNH\nAN TÂM' },
  ];

  /** Logo hãng công nghệ trong assets/logotech – ~20 ô (lặp để fill). */
  readonly iconStripLogos = [
    { src: 'assets/logotech/amd-logo-1.svg', alt: 'AMD' },
    { src: 'assets/logotech/asus_882744.png', alt: 'ASUS' },
    { src: 'assets/logotech/asus-rog-1-logo.svg', alt: 'ASUS ROG' },
    { src: 'assets/logotech/CORSAIRLogo2020_stack_K.png', alt: 'Corsair' },
    { src: 'assets/logotech/Deepcool-logo-black.png', alt: 'Deepcool' },
    { src: 'assets/logotech/Intel_logo_(2006-2020).svg', alt: 'Intel' },
    { src: 'assets/logotech/Kingston-logo.png', alt: 'Kingston' },
    { src: 'assets/logotech/lenovo-logo.png', alt: 'Lenovo' },
    { src: 'assets/logotech/logo-edra.png', alt: 'Edra' },
    { src: 'assets/logotech/logo-acer-inkythuatso-2-01-27-15-49-45.jpg', alt: 'Acer' },
    { src: 'assets/logotech/Nvidia_logo.svg.png', alt: 'NVIDIA' },
    { src: 'assets/logotech/msi.png', alt: 'MSI' },
    { src: 'assets/logotech/Razer_snake_logo.png', alt: 'Razer' },
    { src: 'assets/logotech/amd-logo-1.svg', alt: 'AMD' },
    { src: 'assets/logotech/asus_882744.png', alt: 'ASUS' },
    { src: 'assets/logotech/CORSAIRLogo2020_stack_K.png', alt: 'Corsair' },
    { src: 'assets/logotech/Intel_logo_(2006-2020).svg', alt: 'Intel' },
    { src: 'assets/logotech/Nvidia_logo.svg.png', alt: 'NVIDIA' },
    { src: 'assets/logotech/msi.png', alt: 'MSI' },
    { src: 'assets/logotech/Razer_snake_logo.png', alt: 'Razer' },
  ];

  productImageUrl(p: Product): string {
    const img = p.images?.[0];
    const url = typeof img === 'string' ? img : (img as { url?: string })?.url;
    return url || 'assets/c8c67b26bfbd0df3a88be06bec886fd8bd006e7d.png';
  }
  productPrice(p: Product): number { return p.salePrice ?? p.price; }
  blogCoverUrl(b: BlogPost): string { return b.coverImage || 'assets/c8c67b26bfbd0df3a88be06bec886fd8bd006e7d.png'; }

  constructor(
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object,
    private api: ApiService,
    private introState: IntroStateService,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.api.getFeaturedProducts(8).subscribe({
      next: (list) => this.featuredProducts.set(Array.isArray(list) ? list : []),
      error: () => {},
    });
    this.api.getCategories().subscribe({
      next: (list) => this.apiCategories.set(list),
      error: () => {},
    });
    this.api.getBlogs(1, 6).subscribe({
      next: (res) => this.apiBlogs.set(res.items || []),
      error: () => {},
    });
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    if (!this.heroCanvas?.nativeElement) {
      console.warn('[AuraPC] Canvas not available, skipping intro.');
      this.finishIntro();
      return;
    }
    this.initThreeJS();
    this.initScrollAnimations();
  }

  /* ============================== THREE.JS ============================== */

  private initThreeJS(): void {
    const c = this.heroCanvas.nativeElement;
    const w = c.clientWidth, h = c.clientHeight;
    this.isMobile = window.matchMedia('(max-width: 768px)').matches;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05050f);
    this.scene.fog = new THREE.FogExp2(0x05050f, 0.02);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 500);
    this.camera.position.copy(this.defaultCameraPos);
    this.camera.lookAt(this.defaultLookAt);

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.isMobile, powerPreference: this.isMobile ? 'low-power' : 'default' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.shadowMap.enabled = !this.isMobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    c.appendChild(this.renderer.domElement);

    this.setupLights();
    this.createBackground();
    this.createGround();

    /* Controls: orbit only, NO scroll zoom */
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2.2;
    this.controls.target.copy(this.defaultLookAt);

    this.loadModel();
    window.addEventListener('resize', this.onResize);
    this.ngZone.runOutsideAngular(() => this.animate());
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0xe0e4f0, 1.0));
    this.scene.add(new THREE.HemisphereLight(0x8899cc, 0x222233, 0.6));

    const key = new THREE.DirectionalLight(0xfff8ee, 2.5);
    key.position.set(4, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0005;
    const sc = key.shadow.camera;
    sc.near = 0.5; sc.far = 30; sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x8db8ff, 1.2);
    fill.position.set(-6, 5, -4);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xff8040, 0.8);
    rim.position.set(0, 4, -7);
    this.scene.add(rim);

    const p1 = new THREE.PointLight(0xffffff, 1.2, 12);
    p1.position.set(0, 6, 0);
    this.scene.add(p1);

    const p2 = new THREE.PointLight(0x4466ff, 0.5, 5);
    p2.position.set(0, 0.1, 1);
    this.scene.add(p2);

    const p3 = new THREE.PointLight(0xff6d2d, 0.5, 8);
    p3.position.set(3, 1, 4);
    this.scene.add(p3);
  }

  private createBackground(): void {
    // Không gian vũ trụ 3D: gradient trời + sao (không dùng video)
    const skyGeo = new THREE.SphereGeometry(80, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x0e0e3a) },
        midColor: { value: new THREE.Color(0x0a1528) },
        bottomColor: { value: new THREE.Color(0x050508) },
      },
      vertexShader: `varying vec3 vWP; void main(){ vWP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 topColor,midColor,bottomColor; varying vec3 vWP; void main(){ float h=normalize(vWP).y; vec3 c=mix(bottomColor,midColor,smoothstep(-0.1,0.2,h)); c=mix(c,topColor,smoothstep(0.2,0.8,h)); gl_FragColor=vec4(c,1.0); }`,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    const cnt = this.isMobile ? 1200 : 3500;
    const pos = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) {
      const t = Math.random() * 6.28, p = Math.acos(2 * Math.random() - 1), r = 25 + Math.random() * 40;
      pos[i * 3] = r * Math.sin(p) * Math.cos(t);
      pos[i * 3 + 1] = Math.abs(r * Math.sin(p) * Math.sin(t)) * 0.6 + 2;
      pos[i * 3 + 2] = r * Math.cos(p);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.particles = new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xffffff,
      size: this.isMobile ? 0.12 : 0.18,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    }));
    this.scene.add(this.particles);
  }

  private createGround(): void {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x080810, roughness: 0.7, metalness: 0.2 }),
    );
    g.rotation.x = -Math.PI / 2; g.position.y = -0.02; g.receiveShadow = true;
    this.scene.add(g);

    const grid = new THREE.GridHelper(60, 120, 0x111130, 0x0a0a1c);
    grid.position.y = -0.01;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    this.scene.add(grid);
  }

  /* ============================== MODEL ============================== */

  private loadModel(): void {
    /* Mobile: không load model (tránh WASM OOM, texture lỗi) — hiện scene nền ngay */
    if (this.isMobile) {
      const bar = document.querySelector('.intro__bar-fill') as HTMLElement;
      if (bar) { bar.style.width = '100%'; bar.style.marginLeft = '0'; bar.style.animation = 'none'; }
      this.loadProgress.set(100);
      setTimeout(() => this.finishIntro(), 800);
      return;
    }

    /* Safety: nếu sau 25s model vẫn chưa xong → hiện scene trống */
    const safetyTimer = setTimeout(() => {
      if (!this.modelLoaded()) {
        console.warn('[AuraPC] Model load timeout. Showing scene without model.');
        this.finishIntro();
      }
    }, 25_000);

    const loader = new GLTFLoader();
    loader.manager.onError = (url) => console.warn('[AuraPC] Resource load failed:', url);

    /* DRACO decoder — dùng CDN; chỉ dùng trên desktop */
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    draco.preload();
    loader.setDRACOLoader(draco);

    const modelUrl = 'assets/models/GamingPC-opt.glb';
    console.log('[AuraPC] Loading model:', modelUrl);

    loader.load(
      modelUrl,
      /* ── onLoad ── */
      (gltf) => {
        clearTimeout(safetyTimer);
        this.setupModel(gltf.scene, draco);
      },
      /* ── onProgress ── */
      (xhr) => {
        if (xhr.total > 0) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          this.loadProgress.set(pct);

          /* Update progress bar trực tiếp (DOM) — nhanh hơn Change Detection */
          const bar = document.querySelector('.intro__bar-fill') as HTMLElement;
          if (bar) {
            bar.style.animation = 'none';
            bar.style.width = pct + '%';
            bar.style.marginLeft = '0';
          }
        }
      },
      /* ── onError: fallback sang bản gốc ── */
      (err) => {
        console.warn('[AuraPC] Optimized model failed, trying original...', err);
        loader.load(
          'assets/models/GamingPC.glb',
          (gltf) => {
            clearTimeout(safetyTimer);
            this.setupModel(gltf.scene, draco);
          },
          (xhr) => {
            if (xhr.total > 0) {
              const pct = Math.round((xhr.loaded / xhr.total) * 100);
              this.loadProgress.set(pct);
              const bar = document.querySelector('.intro__bar-fill') as HTMLElement;
              if (bar) { bar.style.animation = 'none'; bar.style.width = pct + '%'; bar.style.marginLeft = '0'; }
            }
          },
          (err2) => {
            clearTimeout(safetyTimer);
            draco.dispose();
            console.error('[AuraPC] All model loads failed:', err2);
            this.finishIntro();
          },
        );
      },
    );
  }

  private setupModel(scene: THREE.Object3D, draco: DRACOLoader): void {
    console.log('[AuraPC] Model loaded successfully.');

    this.model = scene;
    this.model.updateMatrixWorld(true);

    /* Scale model to fit ~4 units */
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 4 / maxDim;
    this.model.scale.setScalar(scale);
    this.model.updateMatrixWorld(true);

    /* Center model on ground */
    const box2 = new THREE.Box3().setFromObject(this.model);
    const c2 = box2.getCenter(new THREE.Vector3());
    this.model.position.set(-c2.x, -box2.min.y, -c2.z);
    this.model.updateMatrixWorld(true);

    /* Shadows */
    this.model.traverse(ch => {
      if ((ch as THREE.Mesh).isMesh) {
        ch.castShadow = true;
        ch.receiveShadow = true;
      }
    });
    this.scene.add(this.model);

    /* Compute hotspot world positions */
    const fb = new THREE.Box3().setFromObject(this.model);
    const fs = fb.getSize(new THREE.Vector3());
    const fc = fb.getCenter(new THREE.Vector3());

    for (const hs of this.hotspots) {
      const wx = fb.min.x + hs.relativePos.x * fs.x;
      const wy = fb.min.y + hs.relativePos.y * fs.y;
      const wz = fb.min.z + hs.relativePos.z * fs.z;
      hs.worldPos.set(wx, wy, wz);
      hs.lookAt.set(wx, wy, wz);
      hs.cameraPos.set(wx + hs.cameraOffset.x, wy + hs.cameraOffset.y, wz + hs.cameraOffset.z);
    }

    /* Camera mặc định: góc front-left, cao — ghế bên trái, bàn/màn hình từ giữa sang phải */
    this.defaultLookAt.set(fc.x, fc.y, fc.z);
    this.defaultCameraPos.set(
      fc.x + 5.50,
      fc.y + 1.0,
      fc.z - 3.0
    );
    this.camera.position.copy(this.defaultCameraPos);
    this.controls.target.copy(this.defaultLookAt);

    draco.dispose();
    this.finishIntro();
  }

  private finishIntro(): void {
    if (this.modelLoaded()) return; // already done
    this.modelLoaded.set(true);
    this.cdr.detectChanges();
    const exitDelay = 1800;
    setTimeout(() => {
      this.introComplete.set(true);
      this.introState.setIntroComplete(); // hiện header/footer sau khi intro biến mất
      this.cdr.detectChanges();
      setTimeout(() => {
        this.heroTextVisible.set(true);
        this.cdr.detectChanges();
        this.startHeaderCycle();
      }, 450);
    }, exitDelay);
  }

  /* ============================== RENDER LOOP ============================== */

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    if (this.isAnimating) {
      this.animProgress += delta / this.animDuration;
      if (this.animProgress >= 1) { this.animProgress = 1; this.isAnimating = false; }
      const t = this.ease(this.animProgress);
      this.camera.position.lerpVectors(this.animStartPos, this.animEndPos, t);
      this.controls.target.copy(
        new THREE.Vector3().lerpVectors(this.animStartTarget, this.animEndTarget, t),
      );
    }

    this.controls?.update();
    if (this.particles) this.particles.rotation.y += delta * 0.008;

    /* Update hotspot screen positions + trigger Angular CD every 3 frames */
    this.frameCount++;
    if (this.introComplete() && this.frameCount % 3 === 0) {
      this.projectHotspots();
      this.ngZone.run(() => this.cdr.detectChanges());
    }

    this.renderer?.render(this.scene, this.camera);
  };

  private ease(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* ============================== HOTSPOT PROJECTION ============================== */

  private projectHotspots(): void {
    if (!this.camera || !this.renderer) return;
    const zoomed = this.activeHotspot() !== null;
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;

    for (const hs of this.hotspots) {
      const p = hs.worldPos.clone().project(this.camera);
      hs.screenX = (p.x * 0.5 + 0.5) * w;
      hs.screenY = (-p.y * 0.5 + 0.5) * h;
      hs.visible = !zoomed && p.z > 0 && p.z < 1
        && hs.screenX > 30 && hs.screenX < w - 30
        && hs.screenY > 60 && hs.screenY < h - 60;
    }
  }

  /* ============================== INTERACTIONS ============================== */

  onHotspotClick(hs: Hotspot): void {
    this.controls.autoRotate = false;
    this.activeHotspot.set(hs);
    this.animStartPos.copy(this.camera.position);
    this.animEndPos.copy(hs.cameraPos);
    this.animStartTarget.copy(this.controls.target);
    this.animEndTarget.copy(hs.lookAt);
    this.animProgress = 0;
    this.isAnimating = true;
    this.animDuration = 1.2;
    this.cdr.detectChanges();
  }

  onZoomOut(): void {
    this.activeHotspot.set(null);
    this.animStartPos.copy(this.camera.position);
    this.animEndPos.copy(this.defaultCameraPos);
    this.animStartTarget.copy(this.controls.target);
    this.animEndTarget.copy(this.defaultLookAt);
    this.animProgress = 0;
    this.isAnimating = true;
    this.animDuration = 1;
    setTimeout(() => { if (this.controls) this.controls.autoRotate = true; }, 1100);
    this.cdr.detectChanges();
  }

  /* ============================== UTILS ============================== */

  private onResize = (): void => {
    if (!this.heroCanvas) return;
    const c = this.heroCanvas.nativeElement;
    this.camera.aspect = c.clientWidth / c.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(c.clientWidth, c.clientHeight);
  };

  private initScrollAnimations(): void {
    const els = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right, .scale-in');
    this.observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' },
    );
    els.forEach(el => this.observer!.observe(el));
  }

  /** Sau khi 2 dòng header gõ xong (~2.1s), đợi 2s rồi đổi sang bộ chữ kia; xong lại đợi 2s rồi đổi lại – lặp mãi */
  private startHeaderCycle(): void {
    if (!this.isBrowser) return;
    const typewriterDuration = 2100; // line1 + line2 ~2.1s
    const pauseAfterType = 2000;
    const cycleMs = typewriterDuration + pauseAfterType;
    this.headerCycleTimeoutId = setTimeout(() => {
      this.heroHeaderSet.set(1);
      this.cdr.detectChanges();
      this.headerCycleIntervalId = setInterval(() => {
        this.heroHeaderSet.update(v => 1 - v);
        this.cdr.detectChanges();
      }, cycleMs);
    }, cycleMs);
  }

  ngOnDestroy(): void {
    if (this.headerCycleTimeoutId != null) clearTimeout(this.headerCycleTimeoutId);
    if (this.headerCycleIntervalId != null) clearInterval(this.headerCycleIntervalId);
    if (this.animationId) cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.onResize);
    this.observer?.disconnect();
    this.renderer?.dispose();
    this.controls?.dispose();
  }
}
