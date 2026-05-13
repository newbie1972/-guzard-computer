/**
 * [v1.37.1 총칼 원거리 데미지 너프 버전]
 */

let x, y, velocity = 0, gravity = 0.8;
let jumpCount = 0, maxJumpCount = 2;
let mana = 100, maxMana = 100, manaRegen = 0.2;
let playerHP = 100, maxPlayerHP = 100; 

let isInvincible = false;
let invincibleTimer = 0;
let invincibleDuration = 90; 
let playerFlashTimer = 0;

let weaponMode = 0; 
let weapons = [
  { name: "WAND", ammo: 6, magSize: 6, totalAmmo: 36, fireRate: 12, reloadTime: 90, bulletColor: [0, 200, 255], dmg: 12 }, 
  { name: "SHOTGUN", ammo: 2, magSize: 2, totalAmmo: 6, fireRate: 50, reloadTime: 120, bulletColor: [255, 100, 0], dmg: 16 }, 
  { name: "RIFLE", ammo: 1, magSize: 1, totalAmmo: 12, fireRate: 30, reloadTime: 110, bulletColor: [255, 0, 0], dmg: 0 }, 
  { name: "SMG", ammo: 30, magSize: 30, totalAmmo: 90, fireRate: 5, reloadTime: 100, bulletColor: [0, 255, 0], dmg: 5 }, 
  { name: "GUNBLADE", ammo: 10, magSize: 10, totalAmmo: 20, fireRate: 8, reloadTime: 90, bulletColor: [200, 150, 255], dmg: 3 } // 12에서 3으로 너프 완료
];

let isReloading = false, reloadTimer = 0, fireTimer = 0;
let adsMode = false, adsScale = 1, bladeExtension = 0;
let aimX = 0, aimY = 0;

let enemyX, enemyY, enemyHealth = 200, maxEnemyHealth = 200;
let enemyAlive = true, respawnTimer = 0, enemyFlash = 0;
let enemySpeed = 2.8; 
let bullets = [], damageTexts = []; 

function setup() { 
  createCanvas(windowWidth, windowHeight); 
  x = 100; y = height - 100;
  enemyX = width - 200; enemyY = height - 100;
  noCursor(); 
  document.oncontextmenu = () => false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  y = height - 100; enemyY = height - 100;
}

function draw() {
  updateLogic();
  renderGame();
}

function updateLogic() {
  if (mana < maxMana) mana += manaRegen;
  let curFireRate = weapons[weaponMode] ? weapons[weaponMode].fireRate : 10;
  if (weaponMode === 3 && adsMode) curFireRate = 2; 

  adsScale = lerp(adsScale, (adsMode && weaponMode !== 4) ? 1.1 : 1.0, 0.1);
  bladeExtension = lerp(bladeExtension, (weaponMode === 4 && adsMode) ? 45 : 0, 0.2);

  if (adsMode && enemyAlive && weaponMode !== 4) {
    aimX = lerp(aimX, enemyX, 0.25); aimY = lerp(aimY, enemyY, 0.25);
  } else {
    aimX = mouseX; aimY = mouseY;
    if (!enemyAlive) adsMode = false;
  }

  if (keyIsDown(65)) x -= 5; if (keyIsDown(68)) x += 5;
  y += velocity; velocity += gravity;
  if (y > height - 100) { y = height - 100; velocity = 0; jumpCount = 0; }

  if (enemyAlive) {
    enemyY = height - 100;
    if (enemyX > x) enemyX -= enemySpeed;
    else if (enemyX < x) enemyX += enemySpeed;
    
    let distToPlayer = dist(enemyX, enemyY, x, y);
    if (distToPlayer < 45 && !isInvincible) {
      let incomingDmg = 15;
      if (weaponMode === 4) incomingDmg *= 0.5; 
      
      playerHP -= incomingDmg;
      let knockbackDir = (x > enemyX) ? 1 : -1;
      x += knockbackDir * 20; velocity = -7;
      isInvincible = true;
      invincibleTimer = invincibleDuration;
    }
  }

  if (isInvincible) {
    invincibleTimer--;
    if (invincibleTimer <= 0) isInvincible = false;
  }

  if (playerHP <= 0) { playerHP = maxPlayerHP; x = 100; isInvincible = false; }

  if (mouseIsPressed && mouseButton === LEFT && fireTimer <= 0 && !isReloading) {
    if (weaponMode === 3 && weapons[3].ammo > 0) fireSMG(curFireRate);
    else if (weaponMode === 4 && !adsMode && weapons[4].ammo > 0) fireGunblade();
  }
  if (fireTimer > 0) fireTimer--;

  if (isReloading) {
    reloadTimer++;
    if (reloadTimer >= weapons[weaponMode].reloadTime) {
      let fill = min(weapons[weaponMode].magSize - weapons[weaponMode].ammo, weapons[weaponMode].totalAmmo);
      weapons[weaponMode].ammo += fill; weapons[weaponMode].totalAmmo -= fill;
      isReloading = false;
    }
  } else if (weaponMode < 5 && weapons[weaponMode].ammo <= 0 && weapons[weaponMode].totalAmmo > 0) {
    startReload();
  }

  if (!enemyAlive && ++respawnTimer > 100) { 
    enemyAlive = true; enemyHealth = maxEnemyHealth; respawnTimer = 0; 
    enemyX = (x < width/2) ? width + 200 : -200;
  }

  for (let i = damageTexts.length - 1; i >= 0; i--) {
    damageTexts[i].y -= 1; damageTexts[i].life--;
    if (damageTexts[i].life <= 0) damageTexts.splice(i, 1);
  }
}

function renderGame() {
  background(220);
  if (adsMode && weaponMode !== 4) drawADSEffect();
  push();
  translate(width / 2, height / 2); scale(adsScale); translate(-width / 2, -height / 2);
  stroke(100); strokeWeight(2); line(-width*5, height-60, width*5, height-60); 
  if (enemyAlive) drawEnemy();
  drawDamageTexts(); 
  updateAndDrawBullets();
  
  if (isInvincible && floor(playerFlashTimer / 5) % 2 === 0) {
    playerFlashTimer++; drawWizard(x, y, true);
  } else {
    playerFlashTimer++; drawWizard(x, y, false);
  }
  
  drawCrosshair(); pop(); drawUI();
}

function spawnBullet(spd, type, dmg, sz, spread = 0) { 
  let tX = (aimX - width/2) / adsScale + width/2; 
  let tY = (aimY - height/2) / adsScale + height/2; 
  let angle = atan2(tY - (y + 10), tX - x) + spread; 
  bullets.push({x:x, y:y+10, startX:x, startY:y+10, vx:cos(angle)*spd, vy:sin(angle)*spd, dmg:dmg, type:type, size:sz, wasAds:adsMode}); 
}

function applyDamage(dmg) {
  enemyHealth -= dmg; enemyFlash = 5;
  damageTexts.push({ x: enemyX + random(-20, 20), y: enemyY - 40, val: dmg, life: 40 });
  if (enemyHealth <= 0) enemyAlive = false;
}

function drawDamageTexts() {
  push(); textAlign(CENTER); textStyle(BOLD);
  for (let t of damageTexts) { fill(255, 0, 0, map(t.life, 0, 40, 0, 255)); textSize(16); text(`-${t.val}`, t.x, t.y); }
  pop();
}

function drawEnemy() {
  push(); fill(enemyFlash > 0 ? 255 : [200, 50, 50]); enemyFlash--;
  rect(enemyX-20, enemyY-20, 40, 40, 5);
  fill(50, 50, 50, 150); rect(enemyX-60, enemyY-60, 120, 15); 
  fill(255, 0, 0); rect(enemyX-60, enemyY-60, map(max(0, enemyHealth), 0, maxEnemyHealth, 0, 120), 15); 
  fill(255); textSize(10); textAlign(CENTER, CENTER);
  text(`${floor(max(0, enemyHealth))} / ${maxEnemyHealth}`, enemyX, enemyY-52.5);
  pop();
}

function drawUI() {
  push(); fill(0); textSize(20); textStyle(BOLD);
  let name = (weaponMode === 5) ? "FIREBALL" : weapons[weaponMode].name;
  text(name, 20, 40);
  
  fill(50, 50, 50, 100); rect(20, 130, 150, 15);
  fill(weaponMode === 4 ? [255, 200, 0] : [255, 50, 50]); 
  rect(20, 130, map(playerHP, 0, maxPlayerHP, 0, 150), 15);
  fill(255); textSize(11); textAlign(CENTER, CENTER);
  text(`HP: ${floor(playerHP)} / ${maxPlayerHP} ${weaponMode === 4 ? '(DEF UP)' : ''}`, 95, 137.5);

  fill(0); textAlign(LEFT); textSize(16); textStyle(NORMAL);
  if (weaponMode < 5) text(`AMMO: ${weapons[weaponMode].ammo} / ${weapons[weaponMode].totalAmmo}`, 20, 65);
  if (isReloading) fill(255,0,0), text("RELOADING...", 20, 90);
  fill(50, 50, 50, 100); rect(20, 105, 150, 15);
  fill(0, 150, 255); rect(20, 105, map(mana, 0, maxMana, 0, 150), 15);
  fill(255); textSize(11); textAlign(CENTER, CENTER);
  text(`MP: ${floor(mana)} / ${maxMana}`, 95, 112.5);
  pop();
}

function drawWizard(wx, wy, transparent) {
  push(); let alpha = transparent ? 100 : 255;
  fill(75, 0, 130, alpha); noStroke(); rect(wx-15, wy, 30, 40, 5); 
  fill(255, 224, 189, alpha); circle(wx, wy, 25); 
  fill(50, 0, 100, alpha); triangle(wx-20, wy-10, wx+20, wy-10, wx, wy-45); 
  let tX = (aimX - width/2) / adsScale + width/2;
  let tY = (aimY - height/2) / adsScale + height/2;
  let angle = atan2(tY - (wy + 10), tX - wx);
  translate(wx, wy + 10); rotate(angle);
  if (weaponMode === 0) { stroke(101, 67, 33, alpha); fill(139, 69, 19, alpha); rect(0,-2,45,4); fill(0,200,255, alpha); noStroke(); circle(45,0,8); } 
  else if (weaponMode === 1) { fill(60, alpha); rect(0,-5,35,10,2); fill(40, alpha); rect(0,-3,38,3); rect(0,0,38,3); } 
  else if (weaponMode === 2) { fill(40, alpha); rect(-10,-3,55,7); rect(-12,0,15,12); fill(80, alpha); rect(10,-6,15,4); } 
  else if (weaponMode === 3) { fill(30, alpha); rect(0,-4,30,9); fill(20, alpha); rect(10,0,6,15); } 
  else if (weaponMode === 4) { fill(50, alpha); rect(-5,-5,30,10); fill(180, alpha); triangle(25,-6,55,0,25,6); if(bladeExtension>5){fill(100,200,255, 150 * (alpha/255)); triangle(30,-8,30+bladeExtension,0,30,8);}} 
  else if (weaponMode === 5) { noStroke(); fill(255,100,0,200 * (alpha/255)); for(let i=0;i<3;i++) circle(20+random(5),random(-5,5),15+sin(frameCount*0.2)*5); }
  pop();
}

function drawCrosshair() { push(); translate(aimX, aimY); noFill(); strokeWeight(2); if (weaponMode === 0) { stroke(0,200,255); ellipse(0,0,20,20); line(-10,-10,10,10); } else if (weaponMode === 1) { stroke(100); rect(-15,-15,30,30); } else if (weaponMode === 2) { stroke(255,0,0); line(-20,0,20,0); line(0,-20,0,20); point(0,0); } else if (weaponMode === 3) { stroke(0,200,0); arc(-10,0,15,25,HALF_PI,-HALF_PI); arc(10,0,15,25,-HALF_PI,HALF_PI); } else if (weaponMode === 4) { stroke(100,100,250); triangle(-10,5,0,-15,10,5); } else { stroke(255,100,0); ellipse(0,0,30,30); } pop(); }
function updateAndDrawBullets() { for (let i = bullets.length - 1; i >= 0; i--) { let b = bullets[i]; b.x += b.vx; b.y += b.vy; let c = (b.type === 5) ? [255,100,0] : (weapons[b.type] ? weapons[b.type].bulletColor : 0); fill(c); noStroke(); circle(b.x, b.y, b.type === 5 ? 20 : 7); if (enemyAlive && dist(b.x, b.y, enemyX, enemyY) < 35) { let fDmg = b.dmg; if (b.type === 2) { let d = dist(b.startX, b.startY, b.x, b.y); fDmg = floor(map(constrain(d, 0, 700), 0, 700, 30, 100)); if (b.wasAds) fDmg *= 2; } applyDamage(fDmg); bullets.splice(i, 1); } else if (b.x < -1000 || b.x > width + 1000 || b.y < -1000 || b.y > height + 1000) bullets.splice(i, 1); } }
function fireNormal() { spawnBullet(15, 0, weapons[0].dmg, 8); weapons[0].ammo--; fireTimer=12; }
function fireShotgun() { if (adsMode && weapons[1].ammo >= 2) { for(let i=0; i<10; i++) spawnBullet(random(10,14), 1, weapons[1].dmg * 0.9, 6, random(-0.3, 0.3)); weapons[1].ammo -= 2; } else if (weapons[1].ammo >= 1) { for(let i=0; i<5; i++) spawnBullet(random(10,13), 1, weapons[1].dmg, 6, random(-0.2, 0.2)); weapons[1].ammo--; } fireTimer = 50; }
function fireRifle() { spawnBullet(28, 2, 0, 8); weapons[2].ammo--; fireTimer=30; }
function fireSMG(rate) { spawnBullet(18, 3, weapons[3].dmg, 7); weapons[3].ammo--; fireTimer = rate; }
function fireGunblade() { spawnBullet(20, 4, weapons[4].dmg, 7); weapons[4].ammo--; fireTimer=8; }
function fireGunbladeDash() { let tX = (aimX - width/2) / adsScale + width/2; let tY = (aimY - height/2) / adsScale + height/2; let a = atan2(tY - y, tX - x); x += cos(a) * 150; y += sin(a) * 50; if (enemyAlive && dist(x, y, enemyX, enemyY) < 100) { applyDamage(40); } fireTimer = 20; }
function fireFireball() { mana -= 25; let tX = (aimX - width/2) / adsScale + width/2; let tY = (aimY - height/2) / adsScale + height/2; let a = atan2(tY - y, tX - x); bullets.push({x:x, y:y+10, vx:cos(a)*10, vy:sin(a)*10, dmg:80, type:5}); fireTimer=40; }
function drawADSEffect() { push(); resetMatrix(); noFill(); for (let i = 0; i < 5; i++) { stroke(0, map(i, 0, 5, 60, 0)); strokeWeight(map(i, 0, 5, 100, 10)); rect(0, 0, width, height); } pop(); }
function startReload() { isReloading = true; reloadTimer = 0; }
function mousePressed() { if (mouseButton === LEFT && fireTimer <= 0 && !isReloading) { if (weaponMode === 0 && weapons[0].ammo > 0) fireNormal(); else if (weaponMode === 1 && weapons[1].ammo > 0) fireShotgun(); else if (weaponMode === 2 && weapons[2].ammo > 0) fireRifle(); else if (weaponMode === 4 && adsMode) fireGunbladeDash(); else if (weaponMode === 5 && mana >= 25) fireFireball(); } if (mouseButton === RIGHT) adsMode = !adsMode; }
function keyPressed() { if (key === 'q' || key === 'Q') { weaponMode = (weaponMode + 1) % 5; adsMode = false; isReloading = false; } if (key === 'e' || key === 'E') { weaponMode = 5; adsMode = false; } if ((key === 'w' || key === 'W') && jumpCount < maxJumpCount) { velocity = -13; jumpCount++; } if (key === 'r' || key === 'R') startReload(); }
