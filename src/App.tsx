import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import "./App.css";

function DarkModeToggle({ toggleTheme, theme }: { toggleTheme: () => void; theme: string }) {
  return (
    <button className="theme-toggle" onClick={toggleTheme}>
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

function ThreeCube({ theme }: { theme: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const camera = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.current = cam;
    
    // Initial camera position
    const radius = 6;
    cam.position.set(0, 0, radius);
    cam.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    // Capture mouse movement for camera pivot
    const handleMouseMove = (e: MouseEvent) => {
      const rect = mountRef.current!.getBoundingClientRect();
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1; // Invert Y for natural feel
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Simple 3D noise function
    const noiseGLSL = `
      vec3 mod289(vec3 x) { return x - floor(x / 289.0) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x / 289.0) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
      float snoise(vec3 v){
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0,0.5,1.0,2.0);
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute( permute( permute(i.z + vec4(0.0,i1.z,i2.z,1.0)) + i.y + vec4(0.0,i1.y,i2.y,1.0)) + i.x + vec4(0.0,i1.x,i2.x,1.0));
        float n_ = 1.0/7.0;
        vec3 ns = n_*D.wyz-D.xzx;
        vec4 j = p - 49.0*floor(p*ns.z*ns.z);
        vec4 x_ = floor(j*ns.z);
        vec4 y_ = floor(j-7.0*x_);
        vec4 x = x_*ns.x + ns.yyyy;
        vec4 y = y_*ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0+1.0;
        vec4 s1 = floor(b1)*2.0+1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
        p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
        m=m*m;
        return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
      }
    `;

    const uniforms = {
      time: { value: 0.0 },
      mouseX: { value: 0.0 },
      mouseY: { value: 0.0 },
    };

    const geometry = new THREE.SphereGeometry(1.5, 320, 320);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        uniform float time;
        uniform float mouseX;
        uniform float mouseY;
        varying vec3 vPos;
        ${noiseGLSL}
        void main() {
          vPos = position;
          
          // Subtle base undulation
          float baseWave = sin(time * 0.5 + position.x * 2.0) * 0.02 + 
                          cos(time * 0.3 + position.y * 3.0) * 0.015 +
                          sin(time * 0.7 + position.z * 2.5) * 0.01;
          
          // Smooth melting with reduced intensity
          float melt = snoise(position * 1.5 + time * 0.06) * 0.08;
          
          vec3 newPos = position + normal * (melt + baseWave);
          
          // Gentler drip effect
          if(position.y < -0.2){
            float dripStrength = smoothstep(-0.2, -1.5, position.y);
            newPos.y -= pow(abs(snoise(position * 2.5 + time * 0.025)), 1.2) * 0.15 * dripStrength;
            
            // Subtle mouse-based distortion
            newPos.x += sin(time * 0.15 + position.y * 3.0 + mouseX * 1.5) * 0.015 * dripStrength;
            newPos.z += cos(time * 0.15 + position.y * 3.0 + mouseY * 1.5) * 0.015 * dripStrength;
          }
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float mouseX;
        uniform float mouseY;
        varying vec3 vPos;
        ${noiseGLSL}
        void main() {
          float n = snoise(vPos * 2.5 + time * 0.02 + mouseX * 0.5 + mouseY * 0.5);
          float mask = smoothstep(-0.3, 0.3, n);
          vec3 color = mix(vec3(0.0), vec3(1.0), mask);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });

    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Lighting
    const pointLight = new THREE.PointLight(0xffffff, 1.2, 50);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);
    scene.add(new THREE.AmbientLight(0x404040));

    // Particles with slow movement
    const particleCount = 200;
    const positions: number[] = [];
    const velocities: number[] = [];
    for (let i = 0; i < particleCount; i++) {
      positions.push((Math.random() - 0.5) * 20);
      positions.push((Math.random() - 0.5) * 20);
      positions.push((Math.random() - 0.5) * 20);
      
      // Add small random velocities for movement
      velocities.push((Math.random() - 0.5) * 0.002);
      velocities.push((Math.random() - 0.5) * 0.002);
      velocities.push((Math.random() - 0.5) * 0.002);
    }

    const particlesGeometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
    particlesGeometry.setAttribute("position", positionAttribute);
    const particlesMaterial = new THREE.PointsMaterial({
      color: theme === "dark" ? 0xffffff : 0x1f2937,
      size: 0.05
    });
    const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particleSystem);

    const clock = new THREE.Clock();
    
    // Camera pivot variables
    let targetTheta = 0;
    let targetPhi = Math.PI / 2;
    let currentTheta = 0;
    let currentPhi = Math.PI / 2;

    const animate = () => {
      requestAnimationFrame(animate);
      
      uniforms.time.value = clock.getElapsedTime();
      
      // Slowly interpolate mouse for lag effect
      uniforms.mouseX.value += (mouse.current.x - uniforms.mouseX.value) * 0.05;
      uniforms.mouseY.value += (mouse.current.y - uniforms.mouseY.value) * 0.05;

      // Calculate target camera angles based on mouse position
      targetTheta = mouse.current.x * Math.PI * 0.5; // Horizontal rotation
      targetPhi = (mouse.current.y * 0.5 + 1) * Math.PI * 0.5; // Vertical rotation, constrained

      // Smoothly interpolate camera position
      currentTheta += (targetTheta - currentTheta) * 0.05;
      currentPhi += (targetPhi - currentPhi) * 0.05;

      // Constrain phi to avoid gimbal lock
      currentPhi = Math.max(0.1, Math.min(Math.PI - 0.1, currentPhi));

      // Convert spherical coordinates to Cartesian
      const radius = 6;
      cam.position.x = radius * Math.sin(currentPhi) * Math.cos(currentTheta);
      cam.position.y = radius * Math.cos(currentPhi);
      cam.position.z = radius * Math.sin(currentPhi) * Math.sin(currentTheta);

      // Always look at the center
      cam.lookAt(0, 0, 0);

      // Sphere rotation - slower and more subtle
      sphere.rotation.y += 0.0003;
      sphere.rotation.x += 0.0001;
      
      // Animate particles with slow movement
      const particlePositions = particleSystem.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particlePositions.length; i += 3) {
        particlePositions[i] += velocities[i];
        particlePositions[i + 1] += velocities[i + 1];
        particlePositions[i + 2] += velocities[i + 2];
        
        // Wrap particles around the scene boundaries
        if (Math.abs(particlePositions[i]) > 10) velocities[i] *= -1;
        if (Math.abs(particlePositions[i + 1]) > 10) velocities[i + 1] *= -1;
        if (Math.abs(particlePositions[i + 2]) > 10) velocities[i + 2] *= -1;
      }
      particleSystem.geometry.attributes.position.needsUpdate = true;

      renderer.render(scene, cam);
    };

    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      cam.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      cam.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (mountRef.current && renderer.domElement.parentNode) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [theme]);

  return <div ref={mountRef} className="three-cube" />;
}

function Home({ theme, toggleTheme }: { theme: string; toggleTheme: () => void }) {
  const welcomeRef = useRef<HTMLElement | null>(null);

  const scrollToWelcome = () => {
    if (welcomeRef.current) welcomeRef.current.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className={`container ${theme}`}>
      <DarkModeToggle toggleTheme={toggleTheme} theme={theme} />
      <section className="hero">
        <ThreeCube theme={theme} />
        <header className="site-header">
          <h1>Sugarfox Studios</h1>
          <p className="subtitle">Elevated Web Experiences</p>
        </header>
        <div className="hero-footer">
          <button onClick={scrollToWelcome} className="button">Learn More</button>
        </div>
      </section>

      <main className="content">
        <section ref={welcomeRef} className="section">
          <h2>Welcome</h2>
          <p>I bring web, sound, and imagination together. Transforming ideas into vibrant digital experiences that resonate.</p>
        </section>

        <section className="section">
          <h2>Portfolio</h2>
          <p>Step into a world where pixels meet pulse. Explore the projects that define my journey.</p>
          <a href="https://FeinsteinWeb.com" target="_blank" rel="noopener noreferrer" className="button">Enter the Portfolio</a>
        </section>

        <section className="section">
          <h2>Services</h2>
          <ul className="services-list">
            <li>🎙️ Podcasting & Audio Editing</li>
            <li>🎚️ Audio Engineering</li>
            <li>🌐 Custom Web Solutions</li>
            <li>📈 Digital Web Marketing</li>
            <li>🎨 Design</li>
            <li>🤖 AI Workflows</li>
          </ul>
        </section>
      </main>

      <footer className="site-footer">
        <p>&copy; {new Date().getFullYear()} Daniel Feinstein. All rights reserved.</p>
      </footer>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState<string>("dark");
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home theme={theme} toggleTheme={toggleTheme} />} />
      </Routes>
    </Router>
  );
}

export default App;