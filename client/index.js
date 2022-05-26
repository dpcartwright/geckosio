const { SnapshotInterpolation, Vault } = Snap
const SI = new SnapshotInterpolation(15) // 15 FPS

const playerVault = new Vault()

class Avatar extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, '')

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body.setSize(32, 48)
    this.setCollideWorldBounds(true)
  }
}

class MainScene extends Phaser.Scene {
  constructor() {
    super()

    this.avatars = new Map()
    this.cursors

    this.socket = io('http://localhost:3000')
    this.socket.on('connect', () => {
      console.log('id:', this.socket.id)
    })
  }

  preload() {
    this.load.image('grass_tiles', '../assets/TX Tileset Grass-extruded.png')
    this.load.image('stoneground_tiles', '../assets/TX Tileset Stone Ground-extruded.png')
    this.load.image('wall_tiles', '../assets/TX Tileset Wall-extruded.png')
    this.load.tilemapTiledJSON('tilemap', '../assets/map.json')

    this.load.atlas('alchemist', '../assets/alchemist.png', '../assets/alchemist_atlas.json')
    this.load.animation('alchemist_anim', '../assets/alchemist_anim.json')
  }

  create() {
    this.cursors = this.input.keyboard.createCursorKeys()
    const map = this.make.tilemap({ key: 'tilemap' })
    const grassTiles = map.addTilesetImage('grass_tiles', 'grass_tiles', 32, 32, 1, 2)
    const stonegroundTiles = map.addTilesetImage('stoneground_tiles', 'stoneground_tiles', 32, 32, 1, 2)
    const wallTiles = map.addTilesetImage('wall_tiles', 'wall_tiles', 32, 32, 1, 2)
    const allTiles = [grassTiles, stonegroundTiles, wallTiles]
    const groundLayer = map.createLayer('Ground', allTiles)
    const buildingLayer = map.createLayer('Buildings', allTiles)
    buildingLayer.setCollisionByProperty({ collides: true })

    this.socket.on('snapshot', snapshot => {
      SI.snapshot.add(snapshot)
    })
    
    this.input.mouse.disableContextMenu();
  }

  update() {
    const snap = SI.calcInterpolation('x y')
    if (!snap) return

    const { state } = snap
    if (!state) return

    const movement = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown
    }
    
    state.forEach(avatar => {
      const exists = this.avatars.has(avatar.id)

      if (!exists) {
        const _avatar = this.physics.add.sprite(avatar.x, avatar.y, 'alchemist')
        this.avatars.set(avatar.id, { avatar: _avatar })
        if (avatar.id == this.socket.id) {
          let camera = this.cameras.main
          camera.zoom = 3
          camera.startFollow(_avatar)
          camera.setLerp(0.1, 0.1)
          camera.setBounds(0, 0, 1280, 960)
        }
      } else {
        if (avatar.id != this.socket.id) {
          const _avatar = this.avatars.get(avatar.id).avatar
          _avatar.setX(avatar.x)
          _avatar.setY(avatar.y)
        } 
      }
    })

    this.clientPrediction(movement)
    this.serverReconciliation(movement)
    
    this.socket.emit('movement', movement)
  }
  
serverReconciliation = (movement) => {
  const { left, up, right, down } = movement
  const player = this.avatars.get(this.socket.id).avatar

  if (player) {
    // get the latest snapshot from the server
    const serverSnapshot = SI.vault.get()

    // get the closest player snapshot that matches the server snapshot time
    const playerSnapshot = playerVault.get(serverSnapshot.time, true)

    if (serverSnapshot && playerSnapshot) {
      // get the current player position on the server
      const serverPos = serverSnapshot.state.filter(s => s.id === this.socket.id)[0]

      // calculate the offset between server and client
      const offsetX = playerSnapshot.state[0].x - serverPos.x
      const offsetY = playerSnapshot.state[0].y - serverPos.y

      // check if the player is currently on the move
      const isMoving = left || up || right || down

      // we correct the position faster if the player moves
      const correction = isMoving ? 60 : 180

      // apply a step by step correction of the player's position
      player.x -= offsetX / correction
      player.y -= offsetY / correction
    }
  }
}

clientPrediction = (movement) => {
  const { left, up, right, down } = movement
  const speed = 160
  const player = this.avatars.get(this.socket.id).avatar

  if (player) {
    if (movement.left) player.setVelocityX(-speed)
    else if (movement.right) player.setVelocityX(speed)
    else player.setVelocityX(0)

    if (movement.up) player.setVelocityY(-speed)
    else if (movement.down) player.setVelocityY(speed)
    else player.setVelocityY(0)
    playerVault.add(
      SI.snapshot.create([{ id: this.socket.id, x: player.x, y: player.y }])
    )
  }
}
}

const config = {
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 720,
    zoom: 1
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 }
    }
  },
  scene: [MainScene]
}

window.addEventListener('load', () => {
  const game = new Phaser.Game(config)
})
