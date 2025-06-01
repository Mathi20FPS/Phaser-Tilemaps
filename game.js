class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.currentLevel = 1;
    this.fireballsCollected = 0;
    this.startedOnce = false;
  }

  preload() {
    this.load.image('tiles', 'assets/tilesets/tiles.png');
    this.load.tilemapTiledJSON('level1', 'assets/tilemaps/level1.json');
    this.load.tilemapTiledJSON('level2', 'assets/tilemaps/level2.json');
    this.load.tilemapTiledJSON('level3', 'assets/tilemaps/level3.json');
    this.load.image('player', 'assets/sprites/player.png');
    this.load.image('fireball', 'assets/sprites/fireball.png');
    this.load.image('enemy', 'assets/sprites/enemy.png');
  }

  create() {
    if (!this.startedOnce) {
      this.currentLevel = 1;
      this.fireballsCollected = 0;
      this.startedOnce = true;
    }

    this.loadLevel(this.currentLevel);
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  loadLevel(level) {
    // ✅ Antes de destruir el mapa viejo, destruí colliders
    this.physics.world.colliders.destroy();

    if (this.map) this.map.destroy();

    this.map = this.make.tilemap({ key: `level${level}` });
    const tileset = this.map.addTilesetImage('tiles');
    this.groundLayer = this.map.createLayer('tileLayer', tileset);
    this.groundLayer.setCollisionByProperty({ collide: true });

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    if (this.player) this.player.destroy();

    this.enemies = this.physics.add.group();
    this.fireballs = this.physics.add.staticGroup();

    const objects = this.map.getObjectLayer('objects')['objects'];
    objects.forEach(obj => {
      const { x, y, type, properties } = obj;
      if (type === 'spawn') {
        this.player = this.physics.add.sprite(x, y, 'player').setOrigin(0.5, 0.5);
        this.player.setCollideWorldBounds(true);
      } else if (type === 'fireball') {
        this.fireballs.create(x, y, 'fireball').setOrigin(0.5, 0.5);
      } else if (type === 'enemy') {
        const enemy = this.enemies.create(x, y, 'enemy').setOrigin(0.5, 0.5);
        if (properties && properties.length > 0) {
          const prop = properties.find(p => p.name === 'move');
          if (prop) enemy.moveDir = prop.value;
        }
        enemy.startX = x;
        enemy.startY = y;
        enemy.speed = 30;
        enemy.setCollideWorldBounds(true);
      } else if (type === 'exit' && level < 3) {
        this.exitZone = this.physics.add.staticSprite(x, y, null).setSize(16, 16).setVisible(false);
      } else if (type === 'final' && level === 3) {
        this.finalZone = this.physics.add.staticSprite(x, y, null).setSize(16, 16).setVisible(false);
      }
    });

    this.physics.add.collider(this.player, this.groundLayer);
    this.physics.add.collider(this.enemies, this.groundLayer);
    this.physics.add.overlap(this.player, this.fireballs, this.collectFireball, null, this);
    this.physics.add.collider(this.player, this.enemies, this.hitEnemy, null, this);

    if (this.exitZone) {
      this.physics.add.overlap(this.player, this.exitZone, this.reachExit, null, this);
    }
    if (this.finalZone) {
      this.physics.add.overlap(this.player, this.finalZone, this.reachFinal, null, this);
    }

    this.enemies.children.iterate(enemy => {
      if (enemy.moveDir === 'horizontal') {
        enemy.setVelocityX(enemy.speed);
      } else if (enemy.moveDir === 'vertical') {
        enemy.setVelocityY(enemy.speed);
      }
    });

    if (level === 2 || level === 3) {
      this.cameras.main.startFollow(this.player);
      this.cameras.main.setZoom(1.5);
    } else {
      this.cameras.main.stopFollow();
      this.cameras.main.setZoom(1);
    }
  }

  collectFireball(player, fireball) {
    fireball.destroy();
    this.fireballsCollected++;
  }

  hitEnemy(player, enemy) {
    this.fireballsCollected = 0;
    this.currentLevel = 1;

    this.physics.world.colliders.destroy();
    this.cameras.main.stopFollow();
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);

    this.scene.restart();
  }

  reachExit() {
    if (this.fireballsCollected >= 5) {
      this.currentLevel++;
      this.loadLevel(this.currentLevel);
    }
  }

  reachFinal() {
    if (this.fireballsCollected >= 5) {
      this.physics.pause();
      let counter = 5;

      this.winText = this.add.text(this.sys.game.config.width / 2, this.sys.game.config.height / 2,
        '¡GANASTE!\nReiniciando en: 5', {
          fontSize: '24px',
          fill: '#fff',
          align: 'center'
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10);

      this.time.addEvent({
        delay: 1000,
        repeat: 5,
        callback: () => {
          counter--;
          this.winText.setText('¡GANASTE!\nReiniciando en: ' + counter);
          if (counter <= 0) {
            this.physics.world.colliders.destroy();
            this.winText.destroy();
            this.physics.resume();
            this.currentLevel = 1;
            this.fireballsCollected = 0;
            this.cameras.main.stopFollow();
            this.cameras.main.setZoom(1);
            this.cameras.main.setScroll(0, 0);
            this.scene.restart();
          }
        }
      });
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

    this.enemies.children.iterate(enemy => {
      if (!enemy.body) return;
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);

      if (distance < 120) {
        this.physics.moveToObject(enemy, this.player, 40);
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




