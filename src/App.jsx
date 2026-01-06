import { useState, useRef, useEffect, useCallback } from 'react';

export default function App() {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: 0, y: 0, down: false });
  const hueRef = useRef(0);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  const playTone = useCallback((x, y, width, height) => {
    if (!audioContextRef.current || !isAudioEnabled) return;
    
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    const freq = 100 + (x / width) * 800;
    const detune = ((y / height) - 0.5) * 1200;
    
    osc.type = ['sine', 'triangle', 'sawtooth'][Math.floor(Math.random() * 3)];
    osc.frequency.value = freq;
    osc.detune.value = detune;
    
    filter.type = 'lowpass';
    filter.frequency.value = 1000 + (1 - y / height) * 3000;
    filter.Q.value = 5;
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }, [isAudioEnabled]);

  const enableAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    setIsAudioEnabled(true);
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
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.008 + Math.random() * 0.015,
        size: 3 + Math.random() * 8,
        hue: hueRef.current,
      });
      hueRef.current = (hueRef.current + 2) % 360;
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
        if (Math.random() < 0.3) {
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
      
      ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
      ctx.fillRect(0, 0, width, height);
      
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.vx *= 0.99;
        p.life -= p.decay;
        
        if (p.life <= 0) return false;
        
        const alpha = p.life;
        const size = p.size * p.life;
        
        //glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha * 0.15})`;
        ctx.fill();
        
        //outer
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha * 0.3})`;
        ctx.fill();
        
        //core
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

  return (
    <div className="synth-container">
      <canvas
        ref={canvasRef}
        className="synth-canvas"
      />
      
      {!isAudioEnabled && (
        <button
          onClick={enableAudio}
          className="sound-btn"
        >
          tap to enable sound
        </button>
      )}
      
      <div className="hint hint--top">
        click & drag
      </div>
      
      {isAudioEnabled && (
        <div className="hint hint--bottom">
          x = pitch · y = filter
        </div>
      )}
    </div>
  );
}