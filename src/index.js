const express = require('express')
const http = require('http')
const path = require('path')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

io.on('connection', (socket) => {
    console.log('New WebSocket connection')

    socket.on('join',(userOptions, callback) => {
        const { error, user } = addUser({id: socket.id, ...userOptions})

        if(error) return callback(error)

        socket.join(user.room)

        socket.emit('message',generateMessage('Welcome!','System'))
        socket.broadcast.to(user.room).emit('message',generateMessage(`${user.username} has joined!`,'System'))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (msg,callback) => {
        const user = getUser(socket.id)
        const filter = new Filter()

        if(filter.isProfane(msg)) {
            return callback('Profanity is not allowed!')
        }

        io.to(user.room).emit('message', generateMessage(msg,user.username))
        callback()
    })

    socket.on('sendLocation', ({ latitude,longtitude }, callback) => {
        const user = getUser(socket.id)

        const url = `https://www.google.com/maps?q=${latitude},${longtitude}`
        io.to(user.room).emit('locationMessage', generateLocationMessage(url,user.username))
        callback('Location shared!')
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if(user) {
            io.to(user.room).emit('message',generateMessage(`A ${user.username} has left!`,'System'))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {
    console.log('Server is up on port ',port)
})