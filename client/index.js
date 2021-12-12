const { SnapshotInterpolation } = Snap
const SI = new SnapshotInterpolation(30) // 30 FPS

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
    this.load.atlas('alchemist', 'assets/alchemist.png', 'assets/alchemist_atlas.json');
    this.load.animation('alchemist_anim', 'assets/alchemist_anim.json');
  }

  create() {
    this.cursors = this.input.keyboard.createCursorKeys()

    this.socket.on('snapshot', snapshot => {
      SI.snapshot.add(snapshot)
    })
  }

  update() {
    const snap = SI.calcInterpolation('x y')
    if (!snap) return

    const { state } = snap
    if (!state) return

    state.forEach(avatar => {
      const exists = this.avatars.has(avatar.id)

      if (!exists) {
        const _avatar = this.add.sprite(avatar.x, avatar.y, 'alchemist')
        this.avatars.set(avatar.id, { avatar: _avatar })
        if (avatar.id == this.socket.id) {
          let camera = this.cameras.main
          camera.zoom = 3
          camera.startFollow(_avatar)
          camera.setLerp(0.1, 0.1)
          camera.setBounds(0, 0, 1280, 960)
        }
      } else {
        const _avatar = this.avatars.get(avatar.id).avatar
        _avatar.setX(avatar.x)
        _avatar.setY(avatar.y)
      }
    })

    const movement = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown
    }

    this.socket.emit('movement', movement)
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
  scene: [MainScene]
}

window.addEventListener('load', () => {
  const game = new Phaser.Game(config)
})
