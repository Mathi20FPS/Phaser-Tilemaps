
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.currentLevel = 1;
    this.coinsCollected = 0;
    this.fireballsCollected = 0; // 👈 agregamos contador de fireballs
    this.startedOnce = false;
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
    if (!this.startedOnce) {
      this.currentLevel = 1;
      this.coinsCollected = 0;
      this.fireballsCollected = 0;
      this.startedOnce = true;
    }

    this.physics.world.createDebugGraphic();
    this.physics.world.drawDebug = true;

    // 🟩 HUD: Contadores
    this.coinText = this.add.text(10, 10, 'Coins: 0', {
      fontSize: '16px',
      fill: '#fff'
    }).setScrollFactor(0).setDepth(2);

    this.fireballIcon = this.add.image(this.sys.game.config.width - 70, 20, 'fireball')
      .setScrollFactor(0)
      .setScale(0.8)
      .setDepth(2);
    this.fireballText = this.add.text(this.sys.game.config.width - 50, 12, '0', {
      fontSize: '16px',
      fill: '#fff'
    }).setScrollFactor(0).setDepth(2);

    this.loadLevel(this.currentLevel);
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  loadLevel(level) {
    if (this.map) this.map.destroy();

    this.map = this.make.tilemap({ key: `level${level}` });
    const tileset = this.map.addTilesetImage('tiles');
    this.groundLayer = this.map.createLayer('tileLayer', tileset);
    this.groundLayer.setCollisionByProperty({ collide: true });

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    if (this.player) this.player.destroy();
    if (this.enemies) this.enemies.clear(true, true);

    const objects = this.map.getObjectLayer('objects')['objects'];
    this.coins = this.physics.add.staticGroup();
    this.fireballs = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();

    objects.forEach(obj => {
  const { x, y, type, properties } = obj;
  if (type === 'spawn') {
    this.player = this.physics.add.sprite(x, y, 'player');
    this.player.setDepth(1).setOrigin(0.5, 0.5);
    this.player.setCollideWorldBounds(true);
  } else if (type === 'coins') {
    const coin = this.coins.create(x, y, 'coin').setOrigin(0.5, 0.5).setDepth(1);
  } else if (type === 'fireball') {
    const fireball = this.fireballs.create(x, y, 'fireball').setOrigin(0.5, 0.5).setDepth(1);
  } else if (type === 'enemy') {
    const enemy = this.enemies.create(x, y, 'enemy').setOrigin(0.5, 0.5).setDepth(1);
    if (properties && properties.length > 0) {
      const prop = properties.find(p => p.name === 'move');
      if (prop) {
        enemy.moveDir = prop.value;
      }
    }
    enemy.startX = x;
    enemy.startY = y;
    enemy.speed = 30;
    enemy.setCollideWorldBounds(true);
  }
});


    this.physics.add.collider(this.player, this.groundLayer);
    this.physics.add.collider(this.enemies, this.groundLayer);
    this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this);
    this.physics.add.overlap(this.player, this.fireballs, this.collectFireball, null, this);
    this.physics.add.collider(this.player, this.enemies, this.hitEnemy, null, this);

    this.enemies.children.iterate(enemy => {
      if (enemy.moveDir === 'horizontal') {
        enemy.setVelocityX(enemy.speed);
      } else if (enemy.moveDir === 'vertical') {
        enemy.setVelocityY(enemy.speed);
      }
    });

    if (level === 3) {
      this.cameras.main.startFollow(this.player);
    } else {
      this.cameras.main.stopFollow();
    }
  }

  collectCoin(player, coin) {
    coin.destroy();
    this.coinsCollected++;
    this.coinText.setText('Coins: ' + this.coinsCollected); // 👈 actualiza el texto
  }

  collectFireball(player, fireball) {
    fireball.destroy();
    this.fireballsCollected++;
    this.fireballText.setText(this.fireballsCollected); // 👈 actualiza el contador
  }

  hitEnemy(player, enemy) {
  // Reiniciamos los contadores
  this.coinsCollected = 0;
  this.fireballsCollected = 0;

  // Actualizamos los textos en pantalla
  this.coinText.setText('Coins: 0');
  this.fireballText.setText('0');

  // Recargamos el nivel
  this.loadLevel(this.currentLevel);
}


  reachExit() {
    if (this.coinsCollected >= 5) {
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

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed);
    }

    if (this.cursors.up.isDown) {
      this.player.setVelocityY(-speed);
    } else if (this.cursors.down.isDown) {
      this.player.setVelocityY(speed);
    }

    // Enemigos persiguen si ven al jugador
    this.enemies.children.iterate(enemy => {
      if (!enemy.body) return;
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);

      if (distance < 120) { // 🔥 menor distancia de detección
        this.physics.moveToObject(enemy, this.player, 40); // 🔥 velocidad de persecución menor
      } else {
        if (enemy.moveDir === 'horizontal') {
          if (enemy.body.blocked.left || enemy.body.blocked.right) {
            enemy.speed *= -1;
            enemy.setVelocityX(enemy.speed);
          }
        } else if (enemy.moveDir === 'vertical') {
          if (enemy.body.blocked.up || enemy.body.blocked.down) {
            enemy.speed *= -1;
            enemy.setVelocityY(enemy.speed);
          }
        }
      }
    });
  }
}

