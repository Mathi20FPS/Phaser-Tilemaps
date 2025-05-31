
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.currentLevel = 1;
    this.coinsCollected = 0;
    this.fireballsCollected = 0;
    this.totalScore = 0;
  }

  preload() {
    this.load.image('tiles', 'assets/tilesets/tiles.png');
    this.load.tilemapTiledJSON('level1', 'assets/tilemaps/level1.json');
    this.load.tilemapTiledJSON('level2', 'assets/tilemaps/level2.json');
    this.load.tilemapTiledJSON('level3', 'assets/tilemaps/level3.json');
    this.load.image('player', 'assets/sprites/player.png');
    this.load.image('coin', 'assets/sprites/coins.png');
    this.load.image('fireball', 'assets/sprites/fireball.png');
    this.load.image('enemy', 'assets/sprites/enemy.png');
  }

  create() {
    this.physics.world.createDebugGraphic();
    this.physics.world.drawDebug = true;

    this.createHUD();
    this.loadLevel(this.currentLevel);

    this.cursors = this.input.keyboard.createCursorKeys();
  }

  createHUD() {
    // 🟩 HUD: Contadores (creados una sola vez)
    this.coinText = this.add.text(10, 10, 'Coins: 0', { fontSize: '16px', fill: '#fff' })
      .setScrollFactor(0).setDepth(2);

    this.scoreText = this.add.text(this.sys.game.config.width / 2, 10, 'Score: 0', { fontSize: '16px', fill: '#fff' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(2);

    this.fireballIcon = this.add.image(this.sys.game.config.width - 70, 20, 'fireball')
      .setScrollFactor(0).setScale(0.8).setDepth(2);

    this.fireballText = this.add.text(this.sys.game.config.width - 50, 12, '0', { fontSize: '16px', fill: '#fff' })
      .setScrollFactor(0).setDepth(2);
  }

  loadLevel(level) {
    // Limpieza de entidades
    if (this.coins) this.coins.clear(true, true);
    if (this.fireballs) this.fireballs.clear(true, true);
    if (this.enemies) this.enemies.clear(true, true);
    if (this.map) this.map.destroy();

    this.map = this.make.tilemap({ key: `level${level}` });
    const tileset = this.map.addTilesetImage('tiles');
    this.groundLayer = this.map.createLayer('tileLayer', tileset);
    this.groundLayer.setCollisionByProperty({ collide: true });

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    if (this.player) this.player.destroy();

    const objects = this.map.getObjectLayer('objects')['objects'];
    this.coins = this.physics.add.staticGroup();
    this.fireballs = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();

    objects.forEach(obj => {
      const { x, y, type, properties } = obj;
      if (type === 'spawn') {
        this.player = this.physics.add.sprite(x, y, 'player')
          .setDepth(1).setOrigin(0.5, 0.5).setCollideWorldBounds(true);
      } else if (type === 'coins') {
        this.coins.create(x, y, 'coin').setOrigin(0.5, 0.5).setDepth(1);
      } else if (type === 'fireball') {
        this.fireballs.create(x, y, 'fireball').setOrigin(0.5, 0.5).setDepth(1);
      } else if (type === 'enemy') {
        const enemy = this.enemies.create(x, y, 'enemy').setOrigin(0.5, 0.5).setDepth(1);
        enemy.moveDir = properties?.find(p => p.name === 'move')?.value || 'horizontal';
        enemy.startX = x;
        enemy.startY = y;
        enemy.speed = 30;
        enemy.setCollideWorldBounds(true);
      }
    });

    // Zona de salida
    const exitObj = this.map.findObject('objects', obj => obj.type === 'exit');
    if (exitObj) {
      this.exitZone = this.physics.add.staticSprite(exitObj.x, exitObj.y, null)
        .setSize(16, 16).setVisible(false);
      this.physics.add.overlap(this.player, this.exitZone, this.tryReachExit, null, this);
    }

    // Colliders y overlaps
    this.physics.add.collider(this.player, this.groundLayer);
    this.physics.add.collider(this.enemies, this.groundLayer);
    this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this);
    this.physics.add.overlap(this.player, this.fireballs, this.collectFireball, null, this);
    this.physics.add.collider(this.player, this.enemies, this.hitEnemy, null, this);

    // Patrulla enemigos
    this.enemies.children.iterate(enemy => {
      if (enemy.moveDir === 'horizontal') enemy.setVelocityX(enemy.speed);
      else if (enemy.moveDir === 'vertical') enemy.setVelocityY(enemy.speed);
    });

    // Cámara y zoom
    if (level === 2 || level === 3) {
      this.cameras.main.startFollow(this.player);
      this.cameras.main.setZoom(1.5);
    } else {
      this.cameras.main.stopFollow();
      this.cameras.main.setZoom(1);
    }
  }

  collectCoin(player, coin) {
    coin.destroy();
    this.coinsCollected++;
    this.totalScore += 100;
    this.coinText.setText('Coins: ' + this.coinsCollected);
    this.scoreText.setText('Score: ' + this.totalScore);
  }

  collectFireball(player, fireball) {
    fireball.destroy();
    this.fireballsCollected++;
    this.fireballText.setText(this.fireballsCollected);
  }

  hitEnemy(player, enemy) {
    this.coinsCollected = 0;
    this.fireballsCollected = 0;
    this.totalScore = 0;

    this.coinText.setText('Coins: 0');
    this.fireballText.setText('0');
    this.scoreText.setText('Score: 0');

    this.currentLevel = 1;
    this.cameras.main.stopFollow();
    this.cameras.main.setScroll(0, 0);
    this.loadLevel(this.currentLevel);
  }

  tryReachExit() {
    if (this.fireballsCollected >= 5) {
      if (this.currentLevel < 3) {
        this.currentLevel++;
        this.loadLevel(this.currentLevel);
      } else {
        this.scene.restart();
      }
    }
  }

  update() {
    if (!this.player) return;

    const speed = 150;
    this.player.setVelocity(0);

    if (this.cursors.left.isDown) this.player.setVelocityX(-speed);
    else if (this.cursors.right.isDown) this.player.setVelocityX(speed);

    if (this.cursors.up.isDown) this.player.setVelocityY(-speed);
    else if (this.cursors.down.isDown) this.player.setVelocityY(speed);

    // Enemigos persiguen si ven al jugador
    this.enemies.children.iterate(enemy => {
      if (!enemy.body) return;
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);

      if (distance < 120) {
        this.physics.moveToObject(enemy, this.player, 40);
      } else {
        if (enemy.moveDir === 'horizontal' && (enemy.body.blocked.left || enemy.body.blocked.right)) {
          enemy.speed *= -1;
          enemy.setVelocityX(enemy.speed);
        } else if (enemy.moveDir === 'vertical' && (enemy.body.blocked.up || enemy.body.blocked.down)) {
          enemy.speed *= -1;
          enemy.setVelocityY(enemy.speed);
        }
      }
    });
  }
}


