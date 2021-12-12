// imports for server
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const path = require('path')

// imports for  phaser
require('@geckos.io/phaser-on-nodejs')
const { SnapshotInterpolation } = require('@geckos.io/snapshot-interpolation')
const SI = new SnapshotInterpolation()
const Phaser = require('phaser')

class Avatar extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, '')

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body.setSize(32, 48)
    this.setCollideWorldBounds(true)
  }
}

class ServerScene extends Phaser.Scene {
  constructor() {
    super()
    this.tick = 0
    this.players = new Map()
  }

  create() {
    this.physics.world.setBounds(0, 0, 1280, 720)

    io.on('connection', socket => {
      const x = Math.random() * 1200 + 40
      const avatar = new Avatar(this, x, 200)

      this.players.set(socket.id, {
        socket,
        avatar
      })

      socket.on('movement', movement => {
        const { left, right, up, down } = movement
        const speed = 160

        if (left) avatar.setVelocityX(-speed)
        else if (right) avatar.setVelocityX(speed)
        else avatar.setVelocityX(0)

        if (up) avatar.setVelocityY(-speed)
        else if (down) avatar.setVelocityY(speed)
        else avatar.setVelocityY(0)

      })

      socket.on('disconnect', reason => {
        const player = this.players.get(socket.id)
        player.avatar.destroy()
        this.players.delete(socket.id)
      })
    })
  }

  update() {
    this.tick++

    // only send the update to the client at 30 FPS (save bandwidth)
    if (this.tick % 2 !== 0) return

    // get an array of all avatars
    const avatars = []
    this.players.forEach(player => {
      const { socket, avatar } = player
      avatars.push({ id: socket.id, x: avatar.x, y: avatar.y })
    })

    const snapshot = SI.snapshot.create(avatars)

    // send all avatars to all players
    this.players.forEach(player => {
      const { socket } = player
      socket.emit('snapshot', snapshot)
    })
  }
}

const config = {
  type: Phaser.HEADLESS,
  width: 960,
  height: 720,
  banner: false,
  audio: false,
  scene: [ServerScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 }
    }
  }
}

new Phaser.Game(config)

app.use('/', express.static(path.join(__dirname, '../client')))

server.listen(3000)
