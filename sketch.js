/**
 * [v1.38.14] 최종 통합 정리
 * - 샷건 ADS(우클릭) 모드 복구: 2발 소모, 탄속/펠릿 증가
 * - 샷건 무한 탄창 버그 수정 (음수 방지)
 * - 마법사 모자 및 모든 무기 외형 유지
 * - UI 텍스트 및 정조준 버그 수정 상태 유지
 */

// --- 1. 변수 설정 ---
let x, y, velocity = 0, gravity = 0.8;
let jumpCount = 0, maxJumpCount = 2;
let mana = 100, maxMana = 100, manaRegen = 0.2;
let playerHP = 100, maxPlayerHP = 100; 
let isInvincible = false, invincibleTimer = 0, playerFlashTimer = 0;

let weaponMode = 0; 
let weapons = [
  { name: "PISTOL", ammo: 12, magSize: 12, totalAmmo: 48, fireRate: 15, reloadTime: 60, bulletColor: [150, 150, 150], dmg: 12 }, 
  { name: "SHOTGUN", ammo: 2, magSize: 2, totalAmmo: 6, fireRate: 50, reloadTime: 120, bulletColor: [255, 100, 0], dmg: 16 }, 
  { name: "RIFLE", ammo: 1, magSize: 1, totalAmmo: 12, fireRate: 30, reloadTime: 110, bulletColor: [255, 0, 0], dmg: 0 }, 
  { name: "SMG", ammo: 30, magSize: 30, totalAmmo: 90, fireRate: 5, reloadTime: 100, bulletColor: [0, 255, 0], dmg: 5 }, 
  { name: "GUNBLADE", ammo: 10, magSize: 10, totalAmmo: 20, fireRate: 8, reloadTime: 90, bulletColor: [200, 150, 255], dmg: 3 }
];

let isReloading = false, reloadTimer = 0, fireTimer = 0;
let adsMode = false, adsScale = 1, bladeExtension = 0;
let aimX = 0, aimY = 0;

let enemyX, enemyY, enemyHealth = 200, maxEnemyHealth = 200;
let enemyAlive = true, respawnTimer = 0, enemyFlash = 0, enemySpeed = 2.8; 
let bullets = [], damageTexts = []; 

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
  
  // 조준 및 카메라 스케일
  adsScale = lerp(adsScale, (adsMode && weaponMode !== 4) ? 1.1 : 1.0, 0.1);
  bladeExtension = lerp(bladeExtension, (weaponMode === 4 && adsMode) ? 45 : 0, 0.2);
  if (adsMode && enemyAlive && weaponMode !== 4) {
    aimX = lerp(aimX, enemyX, 0.25); aimY = lerp(aimY, enemyY, 0.25);
  } else {
    aimX = mouseX; aimY = mouseY;
    if (!enemyAlive) adsMode = false;
  }

  // 플레이어 이동
  if (keyIsDown(65)) x -= 5; if (keyIsDown(68)) x += 5;
  y += velocity; velocity += gravity;
  if (y > height - 100) { y = height - 100; velocity = 0; jumpCount = 0; }

  // 적 시스템
  handleEnemySystem();
  // 무기 시스템
  handleWeaponSystem();

  for (let i = damageTexts.length - 1; i >= 0; i--) {
    damageTexts[i].y -= 1; if (--damageTexts[i].life <= 0) damageTexts.splice(i, 1);
  }
}

function handleEnemySystem() {
  if (enemyAlive) {
    enemyX += (enemyX > x ? -enemySpeed : enemySpeed);
    if (dist(enemyX, enemyY, x, y) < 45 && !isInvincible) {
      playerHP -= (weaponMode === 4 ? 7.5 : 15);
      x += (x > enemyX ? 20 : -20); velocity = -7;
      isInvincible = true; invincibleTimer = 90;
    }
  } else if (++respawnTimer > 100) {
    enemyAlive = true; enemyHealth = maxEnemyHealth; respawnTimer = 0;
    enemyX = (x < width/2) ? width + 200 : -200;
  }
  if (isInvincible && --invincibleTimer <= 0) isInvincible = false;
  if (playerHP <= 0) { playerHP = maxPlayerHP; x = 100; isInvincible = false; }
}

function handleWeaponSystem() {
  let curFireRate = weapons[weaponMode] ? weapons[weaponMode].fireRate : 10;
  if (weaponMode === 3 && adsMode) curFireRate = 2; 

  if (mouseIsPressed && mouseButton === LEFT && fireTimer <= 0 && !isReloading) {
    if (weaponMode === 0 && weapons[0].ammo > 0) fireNormal();
    else if (weaponMode === 1) fireShotgun(); // 샷건은 함수 내부에서 탄약 체크
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
function fireNormal() { spawnBullet(15, 0, 12, 8); weapons[0].ammo--; fireTimer = 15; }

function fireShotgun() {
  let needAmmo = adsMode ? 2 : 1;
  if (weapons[1].ammo < needAmmo) return; // 탄약 부족 시 발사 차단

  if (adsMode) {
    // [복구] ADS 모드: 탄속 빠름, 펠릿 10개
    for(let i=0; i<10; i++) spawnBullet(random(20, 24), 1, 16, 6, random(-0.25, 0.25));
    weapons[1].ammo = max(0, weapons[1].ammo - 2);
  } else {
    // 일반 모드: 탄속 보통, 펠릿 5개
    for(let i=0; i<5; i++) spawnBullet(random(10, 13), 1, 16, 6, random(-0.2, 0.2));
    weapons[1].ammo = max(0, weapons[1].ammo - 1);
  }
  fireTimer = 50;
}

function fireRifle() { spawnBullet(28, 2, 0, 8); weapons[2].ammo--; fireTimer = 30; }
function fireSMG(rate) { spawnBullet(18, 3, 5, 7); weapons[3].ammo--; fireTimer = rate; }
function fireGunblade() { spawnBullet(20, 4, 3, 7); weapons[4].ammo--; fireTimer = 8; }
function fireGunbladeDash() { let a = atan2(aimY-y, aimX-x); x += cos(a)*150; y += sin(a)*50; if(enemyAlive && dist(x,y,enemyX,enemyY)<100) applyDamage(40); fireTimer=20; }
function fireFireball() { mana -= 25; let a = atan2(aimY-y, aimX-x); bullets.push({x:x, y:y+10, vx:cos(a)*10, vy:sin(a)*10, dmg:80, type:5}); fireTimer=40; }

// --- 5. 렌더링 시스템 ---
function renderGame() {
  background(220);
  if (adsMode && weaponMode !== 4) drawADSEffect();
  push();
  translate(width/2, height/2); scale(adsScale); translate(-width/2, -height/2);
  stroke(100); line(-width, height-60, width*2, height-60); 
  if (enemyAlive) { fill(enemyFlash > 0 ? 255 : [200, 50, 50]); enemyFlash--; rect(enemyX-20, enemyY-20, 40, 40, 5); }
  drawDamageTexts();
  updateAndDrawBullets();
  playerFlashTimer++;
  drawWizard(x, y, isInvincible && floor(playerFlashTimer/5)%2===0);
  drawCrosshair();
  pop();
  drawUI();
}

function drawWizard(wx, wy, trans) {
  push(); let a = trans ? 100 : 255;
  fill(75, 0, 130, a); noStroke(); rect(wx-15, wy, 30, 40, 5); 
  fill(255, 224, 189, a); circle(wx, wy, 25);
  fill(50, 0, 100, a); triangle(wx-20, wy-10, wx+20, wy-10, wx, wy-45); // 마법 모자

  let ang = atan2(aimY - (wy+10), aimX - wx);
  translate(wx, wy+10); rotate(ang);
  if(weaponMode===0){ fill(50,a); rect(0,-3,25,8,2); rect(0,0,8,15,2); fill(100,a); rect(15,-2,10,3); }
  else if(weaponMode===1){ fill(60,a); rect(0,-5,35,10,2); fill(40,a); rect(5,-2,10,8); }
  else if(weaponMode===2){ fill(40,a); rect(-10,-3,55,7); fill(80,a); rect(10,-6,15,4); }
  else if(weaponMode===3){ fill(30,a); rect(0,-4,30,9); fill(20,a); rect(10,0,6,15); }
  else if(weaponMode===4){ fill(50,a); rect(-5,-5,30,10); fill(180,a); triangle(25,-6,55,0,25,6); if(bladeExtension>5){fill(100,200,255,150); triangle(30,-8,30+bladeExtension,0,30,8);}}
  else if(weaponMode===5){ noStroke(); fill(255,150,0,200*(a/255)); circle(15,0,15+sin(frameCount*0.2)*3); }
  pop();
}

function drawUI() {
  push(); fill(0); textSize(20); textStyle(BOLD); textAlign(LEFT);
  text(weaponMode === 5 ? "FIREBALL" : weapons[weaponMode].name, 20, 40);
  if(weaponMode < 5) { textSize(16); textStyle(NORMAL); text(`AMMO: ${weapons[weaponMode].ammo} / ${weapons[weaponMode].totalAmmo}`, 20, 65); }
  if(isReloading) { fill(255, 0, 0); text("RELOADING...", 20, 90); }
  fill(50, 50, 50, 100); rect(20, 130, 150, 15);
  fill(weaponMode === 4 ? [255, 200, 0] : [255, 50, 50]); rect(20, 130, map(playerHP, 0, maxPlayerHP, 0, 150), 15);
  fill(255); textSize(11); textAlign(CENTER, CENTER); text(`HP: ${floor(playerHP)} / ${maxPlayerHP}`, 95, 137.5);
  fill(50, 50, 50, 100); rect(20, 105, 150, 15);
  fill(0, 150, 255); rect(20, 105, map(mana, 0, maxMana, 0, 150), 15);
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
    fill(b.type === 5 ? [255,100,0] : (weapons[b.type] ? weapons[b.type].bulletColor : 0));
    noStroke(); circle(b.x, b.y, b.type === 5 ? 20 : 7);
    if (enemyAlive && dist(b.x, b.y, enemyX, enemyY) < 35) {
      let finalDmg = b.dmg;
      if (b.type === 2) finalDmg = floor(map(constrain(dist(b.startX, b.startY, b.x, b.y), 0, 700), 0, 700, 30, 100)) * (b.wasAds?2:1);
      applyDamage(finalDmg); bullets.splice(i, 1);
    } else if (b.x < -1000 || b.x > width + 1000) bullets.splice(i, 1);
  }
}

function applyDamage(dmg) { enemyHealth -= dmg; enemyFlash = 5; damageTexts.push({x: enemyX, y: enemyY - 40, val: floor(dmg), life: 40}); if (enemyHealth <= 0) enemyAlive = false; }
function drawDamageTexts() { push(); textAlign(CENTER); textStyle(BOLD); for (let t of damageTexts) { fill(255, 0, 0, map(t.life, 0, 40, 0, 255)); textSize(16); text(`-${t.val}`, t.x, t.y); } pop(); }
function drawCrosshair() { push(); translate(aimX, aimY); stroke(0); line(-10,0,10,0); line(0,-10,0,10); pop(); }
function drawADSEffect() { push(); noFill(); stroke(0, 20); strokeWeight(100); rect(0,0,width,height); pop(); }
function mousePressed() { if (mouseButton === RIGHT) adsMode = !adsMode; }
function keyPressed() { 
  if (key === 'q' || key === 'Q') { weaponMode = (weaponMode + 1) % 5; adsMode = false; isReloading = false; }
  if (key === 'e' || key === 'E') { weaponMode = 5; adsMode = false; }
  if ((key === 'w' || key === 'W') && jumpCount < maxJumpCount) { velocity = -13; jumpCount++; }
  if (key === 'r' || key === 'R') isReloading = true; 
}
