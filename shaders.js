// GLSL sources. Everything is procedural (no textures) -> tiny download.

export const LIT_VS = `
attribute vec3 aPos; attribute vec3 aNrm;
uniform mat4 uVP; uniform mat4 uM;
varying vec3 vN; varying vec3 vW;
void main(){
  vec4 w = uM * vec4(aPos,1.0);
  vW = w.xyz;
  vN = mat3(uM) * aNrm;
  gl_Position = uVP * w;
}`;

export const LIT_FS = `
precision mediump float;
varying vec3 vN; varying vec3 vW;
uniform vec3 uColor; uniform vec3 uEmissive; uniform vec3 uRimColor; uniform float uRim;
uniform vec3 uCam; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform float uAlpha;
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  vec3 L = normalize(vec3(0.45,0.8,0.35));
  float d = max(dot(N,L),0.0);
  float wrap = max(dot(N,L)*0.6+0.4, 0.0);                       // soft wrap light (skin / cloth)
  float hemi = 0.5 + 0.5*N.y;
  float ao = mix(0.62, 1.0, smoothstep(0.0, 0.9, vW.y));           // contact darkening near the ground
  vec3 amb = mix(vec3(0.30,0.27,0.25), vec3(0.42,0.52,0.7), hemi) * ao;
  vec3 col = uColor * (amb + vec3(1.0,0.93,0.82) * (0.55*d + 0.2*wrap));
  vec3 H = normalize(L + V);
  col += vec3(1.0,0.95,0.85) * pow(max(dot(N,H),0.0), 40.0) * 0.22 * (0.4 + 0.6*d);   // sun glint
  float rim = pow(1.0 - max(dot(N,V),0.0), 2.4);
  col += uRimColor * rim * uRim + uEmissive;
  col = col * (1.04 + 0.1*col) / (1.0 + 0.1*col);                  // gentle contrast / shoulder
  float dist = length(uCam - vW);
  float f = clamp((dist - uFogNear)/(uFogFar-uFogNear),0.0,1.0);
  col = mix(col, uFog, f);
  gl_FragColor = vec4(col, uAlpha);
}`;

export const FLOOR_VS = `
attribute vec3 aPos; attribute vec3 aNrm;
uniform mat4 uVP; varying vec3 vW;
void main(){ vW = aPos; gl_Position = uVP * vec4(aPos,1.0); }`;

// The static part of the floor pattern is baked once per map into a texture (see Renderer._bakeFloor):
// r = main pattern (grid / cracks / tiles), g = rings, b = spokes + centre ring, a = centre emblem glow.
export const BAKE_FS = `
precision highp float;
varying vec2 vP;
uniform float uSpan; uniform float uPattern;
float line(float v, float w){ float f = abs(fract(v) - 0.5); return 1.0 - smoothstep(0.5 - w, 0.5, f); }
vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
float voroEdge(vec2 p){
  vec2 n = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++){
    vec2 g = vec2(float(i),float(j)); vec2 o = hash2(n+g); vec2 r = g + o - f; float d = dot(r,r);
    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(d2) - sqrt(d1);
}
void main(){
  vec2 p = vP * uSpan; float r = length(p);
  float a = atan(p.x, p.y);
  float m = 0.0, rings = 0.0, sp = 0.0, em = exp(-r*0.32);
  if (uPattern < 0.5) {            // neon grid
    m = max(line(p.x/2.0, 0.035), line(p.y/2.0, 0.035));
    for (int i=1;i<5;i++){ float rr = float(i)*6.0; rings += exp(-abs(r-rr)*9.0); }
    sp = (1.0 - smoothstep(0.0,0.03,abs(fract(a/6.2831853*12.0+0.5)-0.5))) * smoothstep(3.0,6.0,r) * 0.35 + exp(-abs(r-3.2)*5.0);
  } else if (uPattern < 1.5) {     // ember: glowing cracks in dark stone
    float e = voroEdge(p/4.5);
    m = (1.0 - smoothstep(0.0, 0.1, e)) * (0.55 + 0.45*smoothstep(0.0, 14.0, r));
    rings = exp(-abs(r-9.0)*5.0)*0.6 + exp(-abs(r-19.0)*5.0)*0.5;
    sp = exp(-abs(r-3.0)*6.0); em = exp(-r*0.22);
  } else if (uPattern < 2.5) {     // frost: big ice tiles with diagonal facets
    m = max(max(line(p.x/6.0, 0.02), line(p.y/6.0, 0.02)), line((p.x+p.y)/8.485, 0.012)*0.6);
    rings = exp(-abs(r-11.0)*2.5)*0.6 + exp(-abs(r-24.0)*2.5)*0.5;
    sp = (1.0 - smoothstep(0.0,0.05,abs(fract(a/6.2831853*6.0+0.5)-0.5))) * smoothstep(2.0,8.0,r) * 0.5 + exp(-abs(r-3.0)*4.0);
  } else if (uPattern < 3.5) {     // colosseum: stone rings with radial joints, sunburst in the middle
    float ringLine = line(r/5.0, 0.03);
    float radial = line(a/6.2831853*(8.0*floor(r/5.0+1.0)), 0.025) * step(5.0, r);
    m = max(ringLine, radial*0.8);
    rings = exp(-abs(r-17.0)*0.9)*0.15;
    sp = (1.0 - smoothstep(0.0,0.08,abs(fract(a/6.2831853*16.0+0.5)-0.5))) * smoothstep(1.0,5.0,r) * (1.0 - smoothstep(5.0,9.0,r)) + exp(-abs(r-5.0)*6.0);
    em = exp(-r*0.28);
  } else if (uPattern < 4.5) {     // storm circuit: diagonal traces and dashed rings
    m = max(line((p.x+p.y)/3.0, 0.04), line((p.x-p.y)/3.0, 0.04)) * 0.8;
    rings = exp(-abs(r-12.0)*7.0) * step(0.45, fract(a*3.0)) + exp(-abs(r-26.0)*7.0) * step(0.55, fract(a*5.0 + 0.3));
    sp = exp(-abs(r-4.0)*5.0);
  } else {                         // meadow: mowing stripes, chalk rings and a little grass noise
    float st = step(0.5, fract(r/4.0));
    float nz = hash2(floor(p*5.0)).x;
    m = st*0.55 + nz*0.18;
    rings = exp(-abs(r-9.0)*14.0)*0.5 + exp(-abs(r-21.0)*14.0)*0.4;
    sp = exp(-abs(r-3.2)*6.0)*0.8;
    em = exp(-r*0.2);
  }
  gl_FragColor = vec4(m, min(rings,1.0), min(1.0, sp), em);
}`;

export const FLOOR_FS = `
precision highp float;
varying vec3 vW;
uniform sampler2D uTex;
uniform float uTime; uniform float uR; uniform float uRMax;
uniform vec3 uBall; uniform vec3 uBallCol; uniform vec4 uTarget; uniform vec3 uCam;
uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform float uIntensity; uniform vec3 uAccent;
uniform vec3 uBase; uniform vec3 uDanger; uniform vec3 uGridCol; uniform float uPattern;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
vec3 grassCol(vec2 p, float dist){
  float lod = smoothstep(18.0, 70.0, dist);
  float n1 = vn(p*0.22), n2 = vn(p*1.3+4.0), n3 = vn(p*6.0), n4 = vn(p*23.0), n5 = vn(vec2(p.x*38.0, p.y*9.0) + 7.0);
  float band = floor((p.x*0.8+p.y*0.6)/3.2);
  float st = mod(band, 2.0);
  vec3 dark = vec3(0.09,0.28,0.05), light = vec3(0.24,0.5,0.1);
  vec3 g = mix(dark, light, 0.25 + 0.45*st + 0.45*n1);
  g *= 0.78 + 0.34*n2 + (0.28*n3 + 0.3*n4 + 0.2*n5 - 0.39) * (1.0 - lod);
  g = mix(g, vec3(0.36,0.38,0.12), smoothstep(0.55,0.85,n1*0.55+n2*0.45)*0.42);
  // soft clover / flower speckles
  vec2 cc = floor(p*2.4); float hh = h21(cc);
  vec2 off = vec2(h21(cc+3.1), h21(cc+8.7)) - 0.5;
  float fl = step(0.955, hh) * smoothstep(0.1, 0.04, length(fract(p*2.4)-0.5-off*0.5)) * (1.0 - lod);
  vec3 fc = hh > 0.985 ? vec3(1.0,0.86,0.2) : vec3(0.95,0.95,0.88);
  g = mix(g, fc, fl);
  return g;
}
vec3 sandCol(vec2 p, float dist){
  float lod = smoothstep(20.0, 80.0, dist);
  float n1 = vn(p*0.15), n2 = vn(p*0.9+3.0), n3 = vn(p*14.0);
  float w = (p.x*0.9 + p.y*0.35 + n1*7.0 + n2*1.2) * 2.1;
  float rip = 0.5 + 0.5*sin(w);
  rip = mix(rip, 0.5, lod);
  vec3 dark = vec3(0.04,0.11,0.42), light = vec3(0.14,0.3,0.76);
  vec3 g = mix(dark, light, 0.25 + 0.5*rip*0.85 + 0.25*n1);
  g *= 0.9 + 0.2*n3*(1.0-lod);
  return g;
}
void main(){
  vec2 p = vW.xz; float r = length(p);
  vec4 tx = texture2D(uTex, p / (2.0 * uRMax) + 0.5);
  vec3 col = uBase + uGridCol*tx.r + uAccent*tx.g*0.5 + mix(uAccent, vec3(0.75,0.4,1.0), step(r,4.2)*step(uPattern,0.5))*tx.b*0.6
           + uAccent * tx.a * (0.30 + 0.12*sin(uTime*1.7));
  if (uPattern > 0.5 && uPattern < 1.5) col += uGridCol * tx.r * (0.35 + 0.35*sin(uTime*1.3 + r*0.4)); // lava pulse
  if (uPattern > 4.5) {                                  // meadow lawn / dune sand
    float dd = length(uCam - vec3(p.x,0.0,p.y));
    if (uPattern < 5.5) {
      col = grassCol(p, dd) * (0.92 + 0.12*tx.g) + vec3(0.9,0.85,0.6) * tx.b * 0.05;
      col = mix(col, vec3(0.3,0.2,0.1), smoothstep(uR-1.2, uR+0.1, r) * 0.55);   // worn dirt at the rim
    } else {
      col = sandCol(p, dd) + vec3(0.5,0.7,1.0) * tx.b * 0.04;
      col = mix(col, vec3(0.03,0.08,0.3), smoothstep(uR-1.0, uR+0.1, r) * 0.5);
    }
  }
  // rim of the platform
  col += mix(uAccent, vec3(1.0,0.2,0.6), 0.35) * exp((r - uR)*2.4) * smoothstep(uR+0.15, uR-0.05, r) * 0.8 * (uPattern > 4.5 ? 0.0 : 1.0);
  // danger zone outside the shrinking arena
  float danger = smoothstep(uR-0.05, uR+0.6, r);
  if (danger > 0.001) {
    float hatch = 0.5+0.5*sin((p.x+p.y)*3.0 + uTime*2.0);
    col = mix(col, uDanger * (0.4+0.6*hatch), danger*0.85);
  }
  // light pool under the ball
  float bd = length(p - uBall.xz);
  col += uBallCol * exp(-bd*0.28) * uBall.y * 0.5;
  // target ring: red pulse around the targeted player
  if (uTarget.z > 0.0) {
    float td = length(p - uTarget.xy);
    float pulse = 0.65 + 0.35*sin(uTime*10.0);
    col += vec3(1.0,0.2,0.12) * (exp(-abs(td-1.7)*7.0) * 1.1 + exp(-td*0.9) * 0.25) * pulse;
  }
  col *= uIntensity;
  float dist = length(uCam - vec3(p.x,0.0,p.y));
  col = mix(col, uFog, clamp((dist - uFogNear)/(uFogFar-uFogNear),0.0,1.0));
  gl_FragColor = vec4(col, smoothstep(uRMax+0.05, uRMax-0.25, r));
}`;

export const SKY_VS = `
attribute vec2 aP; varying vec2 vP;
void main(){ vP = aP; gl_Position = vec4(aP, 1.0, 1.0); }`;

export const SKY_FS = `
precision mediump float;
varying vec2 vP;
uniform mat4 uInvVP; uniform vec3 uCam; uniform float uTime; uniform vec3 uTop; uniform vec3 uHor; uniform float uAlert; uniform vec3 uNeb1; uniform vec3 uNeb2;
float hash(vec3 p){ p = fract(p*0.3183099+vec3(0.1,0.2,0.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float ch(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float cnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(ch(i),ch(i+vec2(1,0)),f.x), mix(ch(i+vec2(0,1)),ch(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec4 w = uInvVP * vec4(vP, 1.0, 1.0);
  vec3 dir = normalize(w.xyz / w.w - uCam);
  float h = dir.y;
  vec3 col = mix(uHor, uTop, smoothstep(-0.1, 0.65, h));
  col = mix(col, uHor*0.25, smoothstep(0.0,-0.6,h));
  // stars
  vec3 sp = dir*140.0; vec3 id = floor(sp);
  float s = hash(id); float star = step(0.9965, s);
  vec3 fp = fract(sp)-0.5; star *= smoothstep(0.5,0.0,length(fp)) ;
  col += vec3(0.8,0.9,1.0) * star * smoothstep(0.35,0.1,dot(uTop,vec3(0.33))) * (0.5+0.5*sin(uTime*2.0 + s*50.0));
  // nebula bands
  float n = sin(dir.x*3.0 + sin(dir.z*2.0+uTime*0.05)*1.5) * sin(dir.z*2.5 + dir.y*3.0);
  col += uNeb1 * max(n,0.0) * 0.28 * smoothstep(-0.2,0.5,h);
  col += uNeb2 * max(-n,0.0) * 0.2 * smoothstep(-0.2,0.5,h);
  col += vec3(0.6,0.05,0.08) * uAlert * 0.18 * smoothstep(0.7,-0.2,abs(h));
  if (dot(uTop,vec3(0.33)) > 0.25) {                    // bright day sky: gradient, sun glow and drifting clouds
    vec3 sky = mix(uHor, uTop, pow(clamp(h,0.0,1.0), 0.55));
    sky = mix(sky, uHor, smoothstep(0.0,-0.3,h));
    vec3 sd = normalize(vec3(0.45,0.5,0.7));
    float sdot = max(dot(dir, sd), 0.0);
    sky += vec3(1.0,0.9,0.65) * (pow(sdot, 8.0)*0.25 + pow(sdot, 200.0)*1.5);
    if (h > 0.02) {
      vec2 uv = dir.xz / (h + 0.22) * 1.3 + vec2(uTime*0.012, uTime*0.004);
      float c = 0.0, a = 0.5; vec2 q = uv;
      for (int i=0;i<5;i++){ c += a * cnoise(q); q = q*2.03 + 1.7; a *= 0.5; }
      float cl = smoothstep(0.5, 0.95, c) * smoothstep(0.02, 0.2, h);
      vec3 cc = mix(vec3(0.82,0.86,0.94), vec3(1.0,0.99,0.97), smoothstep(0.55,1.0,c));
      sky = mix(sky, cc, cl*0.92);
    }
    col = sky;
  }
  gl_FragColor = vec4(col,1.0);
}`;

// Billboard quads: center(3) corner(2) size(1) color(4) shape(1)
export const FX_VS = `
attribute vec3 aC; attribute vec2 aK; attribute float aS; attribute vec4 aCol; attribute float aShape;
uniform mat4 uVP; uniform vec3 uRight; uniform vec3 uUp;
varying vec2 vK; varying vec4 vCol; varying float vShape;
void main(){
  vec3 p = aC + (uRight*aK.x + uUp*aK.y) * aS;
  vK = aK; vCol = aCol; vShape = aShape;
  gl_Position = uVP * vec4(p,1.0);
}`;

export const FX_FS = `
precision mediump float;
varying vec2 vK; varying vec4 vCol; varying float vShape;
void main(){
  float d = length(vK);
  if (d > 1.0) discard;
  float a;
  if (vShape < 0.5) { a = pow(1.0 - d, 2.0); }                 // soft glow
  else if (vShape < 1.5) { a = smoothstep(1.0, 0.8, d); }       // hard disc
  else if (vShape < 2.5) { a = smoothstep(0.78,0.9,d) * smoothstep(1.0,0.92,d); } // ring
  else { a = pow(1.0 - d, 1.2) * (0.6 + 0.4*smoothstep(0.0,0.3,1.0-d)); }          // bright core
  gl_FragColor = vec4(vCol.rgb * a * vCol.a, a * vCol.a);
}`;

// ---- bloom (post-process): bright-pass + downsample, separable blur, additive composite
export const BLOOM_BRIGHT_FS = `
precision mediump float;
varying vec2 vP; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThr;
void main(){
  vec2 uv = vP*0.5+0.5;
  vec3 c = texture2D(uTex, uv + uTexel*vec2(-1.0,-1.0)).rgb + texture2D(uTex, uv + uTexel*vec2(1.0,-1.0)).rgb
         + texture2D(uTex, uv + uTexel*vec2(-1.0,1.0)).rgb + texture2D(uTex, uv + uTexel*vec2(1.0,1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(uThr, uThr + 0.35, l), 1.0);
}`;
export const BLOOM_BLUR_FS = `
precision mediump float;
varying vec2 vP; uniform sampler2D uTex; uniform vec2 uDir;
void main(){
  vec2 uv = vP*0.5+0.5;
  vec3 c = texture2D(uTex, uv).rgb * 0.227;
  c += (texture2D(uTex, uv + uDir*1.385).rgb + texture2D(uTex, uv - uDir*1.385).rgb) * 0.316;
  c += (texture2D(uTex, uv + uDir*3.231).rgb + texture2D(uTex, uv - uDir*3.231).rgb) * 0.070;
  gl_FragColor = vec4(c, 1.0);
}`;
export const BLOOM_COMP_FS = `
precision mediump float;
varying vec2 vP; uniform sampler2D uTex; uniform float uStrength;
void main(){ gl_FragColor = vec4(texture2D(uTex, vP*0.5+0.5).rgb * uStrength, 1.0); }`;


// ---- static scenery with per-vertex colour (trees, grass, rocks, columns...) + wind sway
export const SCENE_VS = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec4 aCol;
uniform mat4 uVP; uniform float uTime;
varying vec3 vN; varying vec3 vW; varying vec3 vC;
void main(){
  vec3 p = aPos; float s = aCol.w;
  p.x += sin(uTime*1.7 + aPos.x*0.35 + aPos.z*0.21) * 0.1 * s;
  p.z += cos(uTime*1.3 + aPos.z*0.3 + aPos.x*0.17) * 0.07 * s;
  vW = p; vN = aNrm; vC = aCol.rgb;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const SCENE_FS = `
precision mediump float;
varying vec3 vN; varying vec3 vW; varying vec3 vC;
uniform vec3 uCam; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform float uAlpha;
void main(){
  vec3 N = normalize(vN);
  vec3 L = normalize(vec3(0.45,0.8,0.35));
  float d = max(dot(N,L),0.0);
  float back = max(dot(-N,L),0.0);
  vec3 amb = mix(vec3(0.34,0.32,0.28), vec3(0.5,0.62,0.78), N.y*0.5+0.5);
  vec3 col = vC * (amb*0.9 + vec3(1.0,0.93,0.8)*d*0.85 + vec3(0.3,0.4,0.1)*back*0.35);
  col = col * (1.04 + 0.1*col) / (1.0 + 0.1*col);
  float dist = length(uCam - vW);
  col = mix(col, uFog, clamp((dist - uFogNear)/(uFogFar-uFogNear),0.0,1.0));
  gl_FragColor = vec4(col, uAlpha);
}`;
