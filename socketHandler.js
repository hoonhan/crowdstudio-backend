// SOCKET LOGIC AND HANDLER
const messageData = require('./schemas/messageData')

var currUserID = 0

var connections = {}
var messagePool = {}

var groupID = "default"

module.exports = (server) => {

	// START SOCKET
	const io = require('socket.io').listen(server)

	// CONNECTION HANDLER
	io.on("connection", socket => {
		socket.userID = currUserID
		connections[socket.userID] = {socket: socket, toVoteList: []}
		messagePool[socket.userID] = null
		currUserID += 1

		socket.join("group-" + groupID)

		socket.on('message', (msg) => {
			let data = new messageData();
			data.userID = socket.userID
			data.text = msg.text
			data.isSpecial = msg.isSpecial

			data.save((err) => {
				if(err) {
					console.log("socket/message: " , err)
				}else {
					msg.userID = socket.userID
					io.to("group-" + groupID).emit("message", msg)
				}
			})

			if(msg.isSpecial) {
				addToPool(msg.text, socket.userID)
			}
		})

		socket.on("request vote", () => {
			var nextToVote = socket.toVoteList.shift()
			while(nextToVote && !messagePool[nextToVote])
				nextToVote = socket.toVoteList.shift()
			if(nextToVote){
				var msg = messagePool[nextToVote]
				socket.emit("vote message", {userID: nextToVote, text: msg.text})
			}else{
				socket.emit("vote message", {message: false})
			}
		})

		socket.on("vote response", (data) => {
			if(messagePool[data.userID]){
				messagePool[data.userID].shown += 1
				messagePool[data.userID].missingRes -= 1 
				messagePool[data.userID].upvotes += (data.isUpvoted ? 1 : 0)
				messagePool[data.userID].shownUsers.push(socket.userID)
				evolveMessage(data.userID)
			}
		})

		socket.on("delete special", () => {
			messagePool[socket.userID] = null
		})
 
		// DISCONNECT
		socket.on("disconnect", () => {
			console.log("client disconnected")
		})
	})

	setInterval(() => {
		var connectionIDs = Object.keys(connections)
		var rankList = getRankList()
		for(var i = 0; i < connectionIDs.length; i++){
			var client = connections[connectionIDs[i]].socket
			client.emit("rank list update", rankList)
			client.emit("message status", messagePool[client.userID])
		}
	}, 1000)

}

function getRankList(){
	var messageList = Object.keys(messagePool).filter((id) => {
		return !!messagePool[id]
	}).map(id => {
		var message = messagePool[id]
		message.userID = id
		return message
	})
	return messageList
}

function addToPool(message, userID) {
	if(messagePool[userID])
		return false

	var obj = {text: message, circleSize: (connections.length >= 3 ? 2 : connections.length - 1), shownUsers: 0, upvotes: 0, missingRes: 0, shownUsers: []}
	messagePool[userID] = obj
	spreadMessage(userID)
}

function spreadMessage(userID){
	var circleSize = messagePool[userID].circleSize
	var shownUsers = messagePool[userID].shownUsers
	var allUsers = shuffle(Object.keys(messagePool))
	var added = 0
	var index = 0
	while(added < circleSize){
		if(shownUsers.includes(allUsers[index]) || allUsers[index] == userID)
			index += 1
		else{
			connections[allUsers[index]].toVoteList.push(userID)
			added += 1
			index += 1
		}
	}
	messagePool[userID].missingRes += circleSize
}

function evolveMessage(userID) {
	var message = messagePool[userID]
	if(message.upvotes >= (message.shownUsers + message.missingRes)/2){
		// when grow
		if(messagePool[userID].circleSize * 2 > connections.length)
			messagePool[userID].circleSize *= 2
		else
			messagePool[userID].circleSize = connections.length - 1 - message.shownUsers
		spreadMessage(userID)
	}else if(message.upvotes + message.missingRes < (message.shownUsers + message.missingRes)/2){
		// when die
		messagePool[userID] = null
	}
}

function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}