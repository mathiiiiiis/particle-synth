import { useState, useRef, useEffect, useCallback } from 'react';

//C minor
const SCALE = [
  130.81, 155.56, 174.61, 196.00, 233.08, 
  261.63, 311.13, 349.23, 392.00, 466.16, 
  523.25, 622.25, 698.46, 783.99, 932.33  
];

const DEFAULT_SETTINGS = {
  masterVol: 0.4,
  delayTime: 0.3,
  feedback: 0.3,
  octaveShift: 0,
  
  //physics
  spawnRate: 0.3,
  particleSize: 1.0,
  particleDecay: 1.0,
  filterBase: 200,
  
  //colour
  colorMode: 'cycle', //'cycle' or 'fixed'
  fixedHue: 200,      
  colorSpeed: 2,
  
  //visuals
  showGrid: true,
  reflectionRadius: 100, 
  reflectionStrength: 0.15 
};

export default function App() {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  
  const masterGainRef = useRef(null);
  const delayNodeRef = useRef(null);
  const feedbackNodeRef = useRef(null);
  
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: 0, y: 0, down: false });
  const hueRef = useRef(0);
  
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const settingsRef = useRef(DEFAULT_SETTINGS);

  useEffect(() => {
    settingsRef.current = settings;
    if (audioContextRef.current) {
      const now = audioContextRef.current.currentTime;
      if (masterGainRef.current) masterGainRef.current.gain.setTargetAtTime(settings.masterVol, now, 0.1);
      if (delayNodeRef.current) delayNodeRef.current.delayTime.setTargetAtTime(settings.delayTime, now, 0.1);
      if (feedbackNodeRef.current) feedbackNodeRef.current.gain.setTargetAtTime(settings.feedback, now, 0.1);
    }
  }, [settings]);

  const playTone = useCallback((x, y, width, height) => {
    if (!audioContextRef.current || !isAudioEnabled || !masterGainRef.current) return;
    
    const ctx = audioContextRef.current;
    const s = settingsRef.current;

    const percentage = x / width;
    const index = Math.floor(percentage * SCALE.length);
    const safeIndex = Math.min(Math.max(index, 0), SCALE.length - 1);
    
    // 0 = x1, 1 = x2, -1 = x0.5 etc
    const baseFreq = SCALE[safeIndex];
    const freq = baseFreq * Math.pow(2, s.octaveShift);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = ['sine', 'triangle'][Math.floor(Math.random() * 2)];
    osc.frequency.value = freq;
    
    filter.type = 'lowpass';
    const openness = 1 - y / height;
    filter.frequency.value = s.filterBase + openness * 4000;
    filter.Q.value = 5 + (y / height) * 10;
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainRef.current);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }, [isAudioEnabled]);

  const enableAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const s = settingsRef.current;
    setIsAudioEnabled(true);

    masterGainRef.current = ctx.createGain();
    masterGainRef.current.gain.value = s.masterVol;

    delayNodeRef.current = ctx.createDelay();
    delayNodeRef.current.delayTime.value = s.delayTime;

    feedbackNodeRef.current = ctx.createGain();
    feedbackNodeRef.current.gain.value = s.feedback;

    masterGainRef.current.connect(delayNodeRef.current);
    delayNodeRef.current.connect(feedbackNodeRef.current);
    feedbackNodeRef.current.connect(delayNodeRef.current);
    delayNodeRef.current.connect(ctx.destination);
    masterGainRef.current.connect(ctx.destination);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;
    
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnParticle = (x, y) => {
      const s = settingsRef.current;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      
      let particleHue;
      if (s.colorMode === 'fixed') {
        particleHue = s.fixedHue;
      } else {
        particleHue = hueRef.current;
        hueRef.current = (hueRef.current + s.colorSpeed) % 360;
      }

      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: (0.008 + Math.random() * 0.015) * s.particleDecay,
        size: (3 + Math.random() * 8) * s.particleSize,
        hue: particleHue,
      });
    };

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (e.touches && e.touches.length > 0) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top
        };
      }
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const handleMove = (e) => {
      e.preventDefault();
      const pos = getPos(e);
      mouseRef.current.x = pos.x;
      mouseRef.current.y = pos.y;
      
      if (mouseRef.current.down) {
        for (let i = 0; i < 3; i++) {
          spawnParticle(
            pos.x + (Math.random() - 0.5) * 20,
            pos.y + (Math.random() - 0.5) * 20
          );
        }
        if (Math.random() < settingsRef.current.spawnRate) {
          playTone(pos.x, pos.y, canvas.offsetWidth, canvas.offsetHeight);
        }
      }
    };

    const handleDown = (e) => {
      e.preventDefault();
      mouseRef.current.down = true;
      handleMove(e);
    };
    
    const handleUp = () => {
      mouseRef.current.down = false;
    };

    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('mousedown', handleDown);
    canvas.addEventListener('touchstart', handleDown, { passive: false });
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);

    const animate = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      const s = settingsRef.current;
      
      ctx.fillStyle = 'rgba(10, 10, 15, 0.2)';
      ctx.fillRect(0, 0, width, height);

      const colWidth = width / SCALE.length;

      //only draw grid if showGrid = true
      if (s.showGrid && width > 0) {
        
        //draw grid (passive)
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255, 255, 255, 0.02)`;
        SCALE.forEach((_, i) => {
          const x = i * colWidth;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        });

        //draw reflections
        ctx.lineWidth = 2;
        particlesRef.current.forEach(p => {
          if (p.life <= 0) return;

          const gridIndex = Math.round(p.x / colWidth);
          for (let i = gridIndex - 1; i <= gridIndex + 1; i++) {
            if (i < 0 || i >= SCALE.length) continue;
            
            const lineX = i * colWidth;
            const dist = Math.abs(p.x - lineX);
            
            if (dist < s.reflectionRadius) {
              const proximity = (1 - dist / s.reflectionRadius);
              const alpha = proximity * p.life * s.reflectionStrength;
              
              if (alpha < 0.01) continue;

              const yStart = p.y - s.reflectionRadius;
              const yEnd = p.y + s.reflectionRadius;

              ctx.beginPath();
              ctx.strokeStyle = `hsla(${p.hue}, 80%, 60%, ${alpha})`;
              ctx.moveTo(lineX, yStart);
              ctx.lineTo(lineX, yEnd);
              ctx.stroke();
            }
          }
        });
      }
      
      //draw particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.vx *= 0.99;
        p.life -= p.decay;
        
        if (p.life <= 0) return false;
        
        const alpha = p.life;
        const size = p.size * p.life;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha * 0.15})`;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha * 0.3})`;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha})`;
        ctx.fill();
        
        return true;
      });
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('touchmove', handleMove);
      canvas.removeEventListener('mousedown', handleDown);
      canvas.removeEventListener('touchstart', handleDown);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, [playTone]);

  const updateSetting = (key, value) => {
    let val = value;
    if (typeof value === 'string' && key !== 'colorMode') {
      val = parseFloat(value);
    }
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <div className="synth-container">
      <canvas ref={canvasRef} className="synth-canvas" />
      
      {!isAudioEnabled && (
        <button onClick={enableAudio} className="sound-btn">
          tap to enable sound
        </button>
      )}
      
      <div className="hint hint--top">click & drag to play</div>
      
      {isAudioEnabled && (
        <>
          <div className="hint hint--bottom">x = scale · y = filter</div>
          
          <div className="controls-container">
            <a 
              href="https://github.com/mathiiiiiis/particle-synth" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="icon-btn"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>

            <button 
              className="icon-btn"
              onClick={() => setShowSettings(!showSettings)}
              style={showSettings ? { background: 'rgba(255,255,255,0.3)' } : {}}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
          </div>

          {showSettings && (
            <div className="settings-panel">
              <h3>Audio</h3>
              <div className="control-group">
                <label><span>Volume</span><span>{settings.masterVol}</span></label>
                <input type="range" min="0" max="1" step="0.01" value={settings.masterVol} onChange={e => updateSetting('masterVol', e.target.value)} />
              </div>
              <div className="control-group">
                <label><span>Delay Time</span><span>{settings.delayTime}s</span></label>
                <input type="range" min="0" max="1" step="0.01" value={settings.delayTime} onChange={e => updateSetting('delayTime', e.target.value)} />
              </div>
              <div className="control-group">
                <label><span>Feedback</span><span>{settings.feedback}</span></label>
                <input type="range" min="0" max="0.9" step="0.01" value={settings.feedback} onChange={e => updateSetting('feedback', e.target.value)} />
              </div>
              <div className="control-group">
                <label><span>Octave</span><span>{settings.octaveShift > 0 ? '+' : ''}{settings.octaveShift}</span></label>
                <input type="range" min="-2" max="2" step="1" value={settings.octaveShift} onChange={e => updateSetting('octaveShift', e.target.value)} />
              </div>
              
              <h3 style={{ marginTop: '1.5rem' }}>Physics</h3>
              <div className="control-group">
                <label><span>Spawn Rate</span><span>{settings.spawnRate}</span></label>
                <input type="range" min="0.05" max="1" step="0.05" value={settings.spawnRate} onChange={e => updateSetting('spawnRate', e.target.value)} />
              </div>
              <div className="control-group">
                <label><span>Decay Speed</span><span>{settings.particleDecay}x</span></label>
                <input type="range" min="0.5" max="3" step="0.1" value={settings.particleDecay} onChange={e => updateSetting('particleDecay', e.target.value)} />
              </div>
              <div className="control-group">
                <label><span>Size</span><span>{settings.particleSize}x</span></label>
                <input type="range" min="0.5" max="3" step="0.1" value={settings.particleSize} onChange={e => updateSetting('particleSize', e.target.value)} />
              </div>

              <h3 style={{ marginTop: '1.5rem' }}>Visuals</h3>
              <div className="control-group">
                <label style={{ cursor: 'pointer', marginBottom: '1rem' }}>
                  <span>Show Grid</span>
                  <input 
                    type="checkbox" 
                    checked={settings.showGrid} 
                    onChange={e => updateSetting('showGrid', e.target.checked)}
                  />
                </label>
              </div>
              <div className="control-group">
                <label><span>Reflect Opacity</span><span>{settings.reflectionStrength}</span></label>
                <input type="range" min="0" max="0.5" step="0.05" value={settings.reflectionStrength} onChange={e => updateSetting('reflectionStrength', e.target.value)} />
              </div>
              <div className="control-group">
                <label><span>Reflect Radius</span><span>{settings.reflectionRadius}px</span></label>
                <input type="range" min="50" max="300" step="10" value={settings.reflectionRadius} onChange={e => updateSetting('reflectionRadius', e.target.value)} />
              </div>
              
              <h3 style={{ marginTop: '1.5rem' }}>Color</h3>
              <div className="control-group">
                <label style={{ cursor: 'pointer', marginBottom: '1rem' }}>
                  <span>Rainbow Mode</span>
                  <input 
                    type="checkbox" 
                    checked={settings.colorMode === 'cycle'} 
                    onChange={e => updateSetting('colorMode', e.target.checked ? 'cycle' : 'fixed')}
                  />
                </label>
              </div>
              
              {settings.colorMode === 'cycle' ? (
                <div className="control-group">
                  <label><span>Cycle Speed</span><span>{settings.colorSpeed}</span></label>
                  <input type="range" min="0" max="10" step="0.5" value={settings.colorSpeed} onChange={e => updateSetting('colorSpeed', e.target.value)} />
                </div>
              ) : (
                <div className="control-group">
                  <label><span>Hue</span><span>{settings.fixedHue}°</span></label>
                  <input 
                    type="range" 
                    min="0" 
                    max="360" 
                    step="5" 
                    value={settings.fixedHue} 
                    onChange={e => updateSetting('fixedHue', e.target.value)}
                    style={{ background: `linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)` }}
                  />
                </div>
              )}

              <button className="reset-btn" onClick={resetSettings}>
                Reset to Default
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}