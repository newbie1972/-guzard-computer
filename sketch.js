/**
 * [v1.38.20] 총칼 근거리 대쉬 잔상(Afterimage) 효과 추가
 * 1. 총칼 대쉬 시 순간이동이 아닌 빠른 속도로 목표 위치까지 실제 이동 (isDashing)
 * 2. 대쉬 도중 가벼운 잔상 효과(dashShadows)를 남겨 시각적 자연스러움 극대화
 * - 기존 v1.38.19의 화면 흔들림, 피격 파티클, 탄피, 총구 번쩍임, 무기 밸런스 완벽 유지
 */

// --- 1. 변수 설정 ---
let x, y, velocity = 0, gravity = 0.8;
let jumpCount = 0, maxJumpCount = 2;
let mana = 100, maxMana = 100, manaRegen = 0.2;
let playerHP = 100, maxPlayerHP = 100; 
let isInvincible = false, invincibleTimer = 0, playerFlashTimer = 0;

let weaponMode = 0; 
let weapons = [
  { name: "PISTOL", ammo: 6, magSize: 6, totalAmmo: 36, fireRate: 15, reloadTime: 60, bulletColor: [150, 150, 150], dmg: 12 }, 
  { name: "SHOTGUN", ammo: 2, magSize: 2, totalAmmo: 6, fireRate: 50, reloadTime: 120, bulletColor: [255, 100, 0], dmg: 16 }, 
  { name: "RIFLE", ammo: 1, magSize: 1, totalAmmo: 8, fireRate: 30, reloadTime: 220, bulletColor: [255, 0, 0], dmg: 0 }, 
  { name: "SMG", ammo: 30, magSize: 30, totalAmmo: 90, fireRate: 5, reloadTime: 100, bulletColor: [0, 255, 0], dmg: 6 }, 
  { name: "GUNBLADE", ammo: 15, magSize: 15, totalAmmo: 40, fireRate: 8, reloadTime: 90, bulletColor: [200, 150, 255], dmg: 2 }
];

let isReloading = false, reloadTimer = 0, fireTimer = 0;
let adsMode = false, adsScale = 1, bladeExtension = 0;
let aimX = 0, aimY = 0;

let enemyX, enemyY, enemyHealth = 200, maxEnemyHealth = 200;
let enemyAlive = true, respawnTimer = 0, enemyFlash = 0, enemySpeed = 2.8; 
let enemyStunTimer = 0; 
let bullets = [], damageTexts = []; 
let particles = [], screenShake = 0;
let casings = [], muzzleFlashTimer = 0, flashColor = [255, 255, 255], flashX = 0, flashY = 0;

// [추가 변수] 가벼운 대쉬 및 잔상 시스템
let isDashing = false;      // 대쉬 중인지 여부
let dashTimer = 0;         // 대쉬 지속 시간 프레임
let dashVx = 0, dashVy = 0; // 대쉬 이동 속도
let dashShadows = [];      // 잔상 좌표 배열

// --- 2. 기본 엔진 ---
function setup() { 
  createCanvas(windowWidth, windowHeight); 
  x = 100; y = height - 100;
  enemyX = width - 200; enemyY = height - 100;
  noCursor(); 
  document.oncontextmenu = () => false;
}

function draw() {
  updateLogic();
  renderGame();
}

// --- 3. 로직 처리 ---
function updateLogic() {
  if (mana < maxMana) mana += manaRegen;
  
  adsScale = lerp(adsScale, (adsMode && weaponMode !== 4) ? 1.1 : 1.0, 0.1);
  bladeExtension = lerp(bladeExtension, (weaponMode === 4 && adsMode) ? 45 : 0, 0.2);
  
  if (adsMode && enemyAlive && weaponMode !== 4) {
    aimX = lerp(aimX, enemyX, 0.25); aimY = lerp(aimY, enemyY, 0.25);
  } else {
    aimX = mouseX; aimY = mouseY;
    if (!enemyAlive) adsMode = false;
  }

  // 대쉬 중일 때는 수동 이동 및 중력 무시
  if (isDashing) {
    x += dashVx;
    y += dashVy;
    
    // 이동하는 경로에 잔상 위치 기록 (가볍게 2프레임마다 하나씩)
    if (frameCount % 2 === 0) {
      dashShadows.push({ x: x, y: y, life: 15 }); // 수명 15프레임
    }
    
    dashTimer--;
    if (dashTimer <= 0) {
      isDashing = false;
      velocity = 0; // 대쉬 종료 시 낙하 속도 초기화
    }
    // 화면 바닥 제한
    if (y > height - 100) { y = height - 100; isDashing = false; }
  } else {
    if (keyIsDown(65)) x -= 5; 
    if (keyIsDown(68)) x += 5;
    y += velocity; velocity += gravity;
  }
  
  if (y > height - 100) { y = height - 100; velocity = 0; jumpCount = 0; }

  // 잔상 타이머 업데이트 및 제거
  for (let i = dashShadows.length - 1; i >= 0; i--) {
    dashShadows[i].life--;
    if (dashShadows[i].life <= 0) dashShadows.splice(i, 1);
  }

  handleEnemySystem();
  handleWeaponSystem();
  updateParticles();
  updateCasings();

  for (let i = damageTexts.length - 1; i >= 0; i--) {
    damageTexts[i].y -= 1; if (--damageTexts[i].life <= 0) damageTexts.splice(i, 1);
  }
}

function handleEnemySystem() {
  if (enemyAlive) {
    if (enemyStunTimer > 0) {
      enemyStunTimer--;
    } else {
      enemyX += (enemyX > x ? -enemySpeed : enemySpeed);
    }
    if (dist(enemyX, enemyY, x, y) < 45 && !isInvincible) {
      playerHP -= (weaponMode === 4 ? 7.5 : 15);
      x += (x > enemyX ? 20 : -20); velocity = -7;
      isInvincible = true; invincibleTimer = 90;
      screenShake = 15; 
    }
  } else if (++respawnTimer > 100) {
    enemyAlive = true; enemyHealth = maxEnemyHealth; respawnTimer = 0;
    enemyStunTimer = 0;
    enemyX = (x < width/2) ? width + 200 : -200;
  }
  if (isInvincible && --invincibleTimer <= 0) isInvincible = false;
  if (playerHP <= 0) { playerHP = maxPlayerHP; x = 100; isInvincible = false; }
}

function handleWeaponSystem() {
  let curFireRate = weapons[weaponMode] ? weapons[weaponMode].fireRate : 10;
  if (weaponMode === 3 && adsMode) curFireRate = 2; 

  if (mouseIsPressed && mouseButton === LEFT && fireTimer <= 0 && !isReloading && !isDashing) {
    if (weaponMode === 0 && weapons[0].ammo > 0) fireNormal();
    else if (weaponMode === 1) fireShotgun(); 
    else if (weaponMode === 2 && weapons[2].ammo > 0) fireRifle();
    else if (weaponMode === 3 && weapons[3].ammo > 0) fireSMG(curFireRate);
    else if (weaponMode === 4 && adsMode) fireGunbladeDash();
    else if (weaponMode === 4 && !adsMode && weapons[4].ammo > 0) fireGunblade();
    else if (weaponMode === 5 && mana >= 25) fireFireball();
  }
  if (fireTimer > 0) fireTimer--;

  if (isReloading) {
    if (++reloadTimer >= weapons[weaponMode].reloadTime) {
      let fill = min(weapons[weaponMode].magSize - weapons[weaponMode].ammo, weapons[weaponMode].totalAmmo);
      weapons[weaponMode].ammo += fill; weapons[weaponMode].totalAmmo -= fill;
      isReloading = false;
    }
  } else if (weaponMode < 5 && weapons[weaponMode].ammo <= 0 && weapons[weaponMode].totalAmmo > 0) {
    isReloading = true; reloadTimer = 0;
  }
}

// --- 4. 무기 발사 함수들 ---
function triggerMuzzleAndCasing(fColor, casingCount = 1) {
  muzzleFlashTimer = 2; flashColor = fColor;
  let ang = atan2(aimY - (y + 10), aimX - x);
  for(let i=0; i<casingCount; i++) {
    casings.push({ x: x + cos(ang) * 20, y: y + 10 + sin(ang) * 5, vx: -cos(ang) * random(2, 5) + random(-1, 1), vy: -random(3, 6), angle: random(TWO_PI), rotSpeed: random(-0.2, 0.2), life: 50 });
  }
}

function fireNormal() { spawnBullet(15, 0, 12, 8); weapons[0].ammo--; fireTimer = 15; triggerMuzzleAndCasing([200, 200, 200]); }
function fireShotgun() {
  let needAmmo = adsMode ? 2 : 1; if (weapons[1].ammo < needAmmo) return; 
  if (adsMode) {
    for(let i=0; i<10; i++) spawnBullet(random(20, 24), 1, 16, 6, random(-0.25, 0.25));
    weapons[1].ammo = max(0, weapons[1].ammo - 2); triggerMuzzleAndCasing([255, 150, 50], 2);
  } else {
    for(let i=0; i<5; i++) spawnBullet(random(10, 13), 1, 16, 6, random(-0.2, 0.2));
    weapons[1].ammo = max(0, weapons[1].ammo - 1); triggerMuzzleAndCasing([255, 150, 50], 1);
  }
  fireTimer = 50;
}
function fireRifle() { spawnBullet(28, 2, 0, 8); weapons[2].ammo--; fireTimer = 30; triggerMuzzleAndCasing([255, 50, 50]); }
function fireSMG(rate) { spawnBullet(18, 3, 5, 7); weapons[3].ammo--; fireTimer = rate; triggerMuzzleAndCasing([100, 255, 100]); }
function fireGunblade() { spawnBullet(20, 4, weapons[4].dmg, 7); weapons[4].ammo--; fireTimer = 8; triggerMuzzleAndCasing([200, 150, 255]); }

function fireGunbladeDash() { 
  let a = atan2(aimY-y, aimX-x); 
  
  // 순간이동 대신, 6프레임 동안 초고속 돌진하도록 설정 (총 이동 거리 약 150 보존)
  isDashing = true;
  dashTimer = 6;
  dashVx = cos(a) * 25;
  dashVy = sin(a) * 8; // 상하 보정
  
  if(enemyAlive && dist(x, y, enemyX, enemyY) < 160) applyDamage(30); 
  fireTimer = 20; 
}

function fireFireball() { mana -= 25; let a = atan2(aimY-y, aimX-x); bullets.push({x:x, y:y+10, vx:cos(a)*10, vy:sin(a)*10, dmg:30, type:5}); fireTimer=40; muzzleFlashTimer = 3; flashColor = [255, 100, 0]; }

// --- 5. 렌더링 시스템 ---
function renderGame() {
  background(220);
  if (adsMode && weaponMode !== 4) drawADSEffect();
  
  push();
  if (screenShake > 0) {
    translate(random(-screenShake, screenShake), random(-screenShake, screenShake));
    screenShake *= 0.9; if (screenShake < 0.5) screenShake = 0;
  }

  translate(width/2, height/2); scale(adsScale); translate(-width/2, -height/2);
  stroke(100); line(-width, height-60, width*2, height-60); 
  
  if (enemyAlive) { 
    if (enemyFlash > 0) { fill(255); enemyFlash--; } 
    else if (enemyStunTimer > 0) { fill(100, 100, 255); } 
    else { fill(200, 50, 50); }
    rect(enemyX-20, enemyY-20, 40, 40, 5); 
    
    stroke(0); strokeWeight(1); fill(50, 50, 50, 150); rect(enemyX - 25, enemyY - 45, 50, 10, 2);
    noStroke(); fill(255, 50, 50); let enemyHpWidth = map(enemyHealth, 0, maxEnemyHealth, 0, 50);
    rect(enemyX - 25, enemyY - 45, constrain(enemyHpWidth, 0, 50), 10, 2);
    fill(255); textSize(9); textStyle(BOLD); textAlign(CENTER, CENTER);
    text(`${floor(max(0, enemyHealth))}/${maxEnemyHealth}`, enemyX, enemyY - 40);
  }
  
  drawParticles(); 
  drawCasings(); 
  
  // [추가] 대쉬 잔상 그리기 (가볍게 사각형 실루엣으로 반투명 연출)
  for (let s of dashShadows) {
    push();
    fill(138, 43, 226, map(s.life, 0, 15, 0, 100)); // 보라색 톤의 투명한 잔상
    noStroke();
    rect(s.x - 15, s.y, 30, 40, 5);
    pop();
  }

  drawDamageTexts();
  updateAndDrawBullets();
  playerFlashTimer++;
  drawWizard(x, y, isInvincible && floor(playerFlashTimer/5)%2===0);
  
  if (muzzleFlashTimer > 0) {
    push(); noStroke(); fill(flashColor[0], flashColor[1], flashColor[2], 200); circle(flashX, flashY, random(20, 35));
    stroke(flashColor[0], flashColor[1], flashColor[2], 150); strokeWeight(3); let ang = atan2(aimY - (y+10), aimX - x); line(flashX, flashY, flashX + cos(ang)*25, flashY + sin(ang)*25);
    pop(); muzzleFlashTimer--;
  }

  drawCrosshair();
  pop();
  drawUI();
}

function drawWizard(wx, wy, trans) {
  push(); let a = trans ? 100 : 255;
  fill(75, 0, 130, a); noStroke(); rect(wx-15, wy, 30, 40, 5); 
  fill(255, 224, 189, a); circle(wx, wy, 25);
  fill(50, 0, 100, a); triangle(wx-20, wy-10, wx+20, wy-10, wx, wy-45); 

  let ang = atan2(aimY - (wy+10), aimX - wx);
  translate(wx, wy+10); rotate(ang);
  
  let weaponLen = 25;
  if(weaponMode===0){ fill(50,a); rect(0,-3,25,8,2); rect(0,0,8,15,2); fill(100,a); rect(15,-2,10,3); weaponLen = 25; }
  else if(weaponMode===1){ fill(60,a); rect(0,-5,35,10,2); fill(40,a); rect(5,-2,10,8); weaponLen = 35; }
  else if(weaponMode===2){ fill(40,a); rect(-10,-3,55,7); fill(80,a); rect(10,-6,15,4); weaponLen = 45; }
  else if(weaponMode===3){ fill(30,a); rect(0,-4,30,9); fill(20,a); rect(10,0,6,15); weaponLen = 30; }
  else if(weaponMode===4){ fill(50,a); rect(-5,-5,30,10); fill(180,a); triangle(25,-6,55,0,25,6); if(bladeExtension>5){fill(100,200,255,150); triangle(30,-8,30+bladeExtension,0,30,8);} weaponLen = 30; }
  else if(weaponMode===5){ noStroke(); fill(255,150,0,200*(a/255)); circle(15,0,15+sin(frameCount*0.2)*3); weaponLen = 15; }
  
  flashX = wx + cos(ang) * weaponLen; flashY = (wy+10) + sin(ang) * weaponLen;
  pop();

  if (isReloading && weapons[weaponMode]) {
    push(); noFill(); stroke(50, 50, 50, 150); strokeWeight(4); circle(wx, wy - 60, 16);
    stroke(0, 255, 100); let progress = map(reloadTimer, 0, weapons[weaponMode].reloadTime, 0, TWO_PI); arc(wx, wy - 60, 16, 16, -HALF_PI, -HALF_PI + progress);
    pop();
  }
}

function drawUI() {
  push(); fill(0); textSize(20); textStyle(BOLD); textAlign(LEFT);
  text(weaponMode === 5 ? "FIREBALL" : weapons[weaponMode].name, 20, 40);
  if(weaponMode < 5) { textSize(16); textStyle(NORMAL); text(`AMMO: ${weapons[weaponMode].ammo} / ${weapons[weaponMode].totalAmmo}`, 20, 65); }
  if(isReloading) { fill(255, 0, 0); text("RELOADING...", 20, 90); }
  fill(50, 50, 50, 100); rect(20, 130, 150, 15); fill(weaponMode === 4 ? [255, 200, 0] : [255, 50, 50]); rect(20, 130, map(playerHP, 0, maxPlayerHP, 0, 150), 15);
  fill(255); textSize(11); textAlign(CENTER, CENTER); text(`HP: ${floor(playerHP)} / ${maxPlayerHP}`, 95, 137.5);
  fill(50, 50, 50, 100); rect(20, 105, 150, 15); fill(0, 150, 255); rect(20, 105, map(mana, 0, maxMana, 0, 150), 15);
  fill(255); text(`MP: ${floor(mana)} / ${maxMana}`, 95, 112.5);
  pop();
}

// --- 6. 유틸리티 ---
function spawnBullet(spd, type, dmg, sz, spread = 0) {
  let angle = atan2(aimY - (y + 10), aimX - x) + spread;
  bullets.push({x:x, y:y+10, startX:x, startY:y+10, vx:cos(angle)*spd, vy:sin(angle)*spd, dmg:dmg, type:type, size:sz, wasAds:adsMode});
}

function updateAndDrawBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i]; b.x += b.vx; b.y += b.vy;
    fill(b.type === 5 ? [255,100,0] : (weapons[b.type] ? weapons[b.type].bulletColor : 0)); noStroke(); circle(b.x, b.y, b.type === 5 ? 20 : 7);
    if (enemyAlive && dist(b.x, b.y, enemyX, enemyY) < 35) {
      let finalDmg = b.dmg;
      if (b.type === 0 && b.wasAds) enemyStunTimer = 30; 
      if (b.type === 2) finalDmg = floor(map(constrain(dist(b.startX, b.startY, b.x, b.y), 0, 700), 0, 700, 30, 100)) * (b.wasAds?2:1);
      let pColor = b.type === 5 ? [255, 100, 0] : (weapons[b.type] ? weapons[b.type].bulletColor : [255, 255, 255]);
      createParticles(enemyX, enemyY, 5, pColor); applyDamage(finalDmg); bullets.splice(i, 1);
    } else if (b.x < -1000 || b.x > width + 1000) bullets.splice(i, 1);
  }
}

function applyDamage(dmg) { enemyHealth -= dmg; enemyFlash = 5; damageTexts.push({x: enemyX, y: enemyY - 40, val: floor(dmg), life: 40}); if (enemyHealth <= 0) { enemyAlive = false; createParticles(enemyX, enemyY, 25, [200, 50, 50]); } }
function drawDamageTexts() { push(); textAlign(CENTER); textStyle(BOLD); for (let t of damageTexts) { fill(255, 0, 0, map(t.life, 0, 40, 0, 255)); textSize(16); text(`-${t.val}`, t.x, t.y); } pop(); }
function drawCrosshair() { push(); translate(aimX, aimY); stroke(0); line(-10,0,10,0); line(0,-10,0,10); pop(); }
function drawADSEffect() { push(); noFill(); stroke(0, 20); strokeWeight(100); rect(0,0,width,height); pop(); }
function mousePressed() { if (mouseButton === RIGHT) adsMode = !adsMode; }
function keyPressed() { 
  if (key === 'q' || key === 'Q') { weaponMode = (weaponMode + 1) % 5; adsMode = false; isReloading = false; }
  if (key === 'e' || key === 'E') { weaponMode = 5; adsMode = false; }
  if ((key === 'w' || key === 'W') && jumpCount < maxJumpCount && !isDashing) { velocity = -13; jumpCount++; }
  if (key === 'r' || key === 'R') isReloading = true; 
}

function createParticles(px, py, count, col) {
  for(let i = 0; i < count; i++) {
    let angle = random(TWO_PI); let speed = random(2, 6);
    particles.push({x: px, y: py, vx: cos(angle) * speed, vy: sin(angle) * speed - random(1, 3), size: random(4, 8), color: col, life: random(20, 40)});
  }
}
function updateParticles() { for(let i = particles.length - 1; i >= 0; i--) { let p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--; if(p.life <= 0) particles.splice(i, 1); } }
function drawParticles() { push(); for(let p of particles) { fill(p.color[0], p.color[1], p.color[2], map(p.life, 0, 30, 0, 255)); noStroke(); rect(p.x, p.y, p.size, p.size); } pop(); }

function updateCasings() {
  for (let i = casings.length - 1; i >= 0; i--) {
    let c = casings[i]; c.x += c.vx; c.y += c.vy; c.vy += 0.25; c.angle += c.rotSpeed; c.life--;
    if (c.y > height - 65) { c.y = height - 65; c.vy = -c.vy * 0.4; c.vx *= 0.6; }
    if (c.life <= 0) casings.splice(i, 1);
  }
}
function drawCasings() { push(); for (let c of casings) { rectMode(CENTER); fill(218, 165, 32, map(c.life, 0, 50, 0, 255)); noStroke(); push(); translate(c.x, c.y); rotate(c.angle); rect(0, 0, 5, 2); pop(); } pop(); }
