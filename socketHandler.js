// SOCKET LOGIC AND HANDLER
const messageData = require('./schemas/messageData')
const specialData = require('./schemas/specialData')
const voteData = require('./schemas/voteData')

var currUserID = 0

var connections = {}
var messagePool = {}

var groupID = "default"

var adminIDs = ["admin-jh", "admin-sh", "admin-dh", "admin-ts", "streamer"]
var animalIDs = ["Dog", "Cat", "Giraffe", "Ostrich", "Horse", "Iguana", "Sheep", "Snake", "Rhino", "Squid", "Polar Bear", "Deer", "Frog", "Shark", "Gorilla", "Crocodile", 
				"Fox", "Hoon", "Juho"]

var streamerSocket = null

// userID: ["Axolotl", "Orangutan", "Toad", "Beetle", "Boar", "Pangolin", "Armadillo", "Eagle", "Hawk", "Anaconda", "Butterfly"]

module.exports = (server) => {

	// START SOCKET
	const io = require('socket.io').listen(server)

	// CONNECTION HANDLER
	io.on("connection", socket => {
		socket.join("group-" + groupID)

		socket.on("register", userID => {
			socket.userID = userID
			if(!adminIDs.includes(userID)){
				connections[userID] = {socket: socket, toVoteList: []}
				messagePool[userID] = null
			}else{
				streamerSocket = socket
			}
		})

		socket.on('message', (msg) => {
			let data = new messageData();
			data.userID = socket.userID
			if(adminIDs.includes(socket.userID))
				data.userID = "ADMIN"

			data.text = msg.text
			data.isSpecial = msg.isSpecial
			
			msg.userID = socket.userID
			if(adminIDs.includes(msg.userID))
				msg.userID = animalIDs[Math.floor(Math.random() * animalIDs.length)]
			io.in("group-" + groupID).emit("message", msg)

			data.save((err) => {
				if(err)
					console.log("socket/message: " , err)
			})

			if(msg.isSpecial && !adminIDs.includes(socket.userID)) {
				addToPool(msg.text, socket.userID)
			}
		})

		socket.on("request vote", () => {
			if(connections[socket.userID]){
				var nextToVote = connections[socket.userID].toVoteList.shift()
				while(nextToVote && !messagePool[nextToVote])
					nextToVote = connections[socket.userID].toVoteList.shift()
				if(nextToVote != undefined){
					var msg = messagePool[nextToVote]
					socket.emit("vote message", {userID: nextToVote, text: msg.text})
				}else{
					socket.emit("vote message", false)
				}
			}
		})

		socket.on("vote response", (data) => {
			if(messagePool[data.userID] && !messagePool[data.userID].shownUsers.includes(socket.userID)){
				messagePool[data.userID].currentResponses += 1 
				messagePool[data.userID].shownUsers.push(socket.userID)
				if(data.isUpvoted){
					messagePool[data.userID].likedUsers.push(socket.userID)
					messagePool[data.userID].currentUpvotes += 1
				}
				
				let store = new voteData()
				store.voterID = socket.userID
				store.creatorID = data.userID
				store.message = data.message
				store.isUpvoted = data.isUpvoted

				store.save((err) => {
					if(err)
						console.log("socket/vote response: ", err)
				})

				if(messagePool[data.userID].currentResponses == messagePool[data.userID].circleSize)
					evolveMessage(data.userID, io)
			}
		})

		socket.on("delete special", () => {
			storeMessageSpecial(socket.userID, -1)
			messagePool[socket.userID] = null
		})
 
		// DISCONNECT
		socket.on("disconnect", () => {
			if(messagePool[socket.userID]){
				storeMessageSpecial(socket.userID, -1)
				messagePool[socket.userID] = null
			}
			if(connections[socket.userID])
				delete connections[socket.userID]
			console.log("client disconnected")
		})
	})

	setInterval(() => {
		var connectionIDs = Object.keys(connections)
		var rankList = getRankList()
		if(rankList.length > 0)
			console.log(rankList)
		io.in("group-" + groupID).emit("rank list update", rankList)
		io.in("group-" + groupID).emit("view count update", connectionIDs.length)
		for(var i = 0; i < connectionIDs.length; i++){
			var client = connections[connectionIDs[i]].socket
			if(messagePool[client.userID]){
				var rank = rankList.findIndex((msg) => msg.userID === client.userID)
				client.emit("msg status update", {content: messagePool[client.userID].text, rank: rank+1, 
												  numLiked: messagePool[client.userID].likedUsers.length, numShown: messagePool[client.userID].shownUsers.length})
			}else{
				client.emit("msg status update", null)
			}
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
	}).sort((a, b) => b.likedUsers.length - a.likedUsers.length)
	return messageList
}

function addToPool(message, userID) {
	if(messagePool[userID])
		return false

	var numberUsers = Object.keys(connections).length
	var obj = {text: message, circleSize: (numberUsers > 4 ? 4 : numberUsers - 1), currentUpvotes: 0, currentResponses: 0, shownUsers: [], likedUsers: []}
	messagePool[userID] = obj
	spreadMessage(userID)
}

function spreadMessage(userID){
	var circleSize = messagePool[userID].circleSize
	var shownUsers = messagePool[userID].shownUsers
	var allUsers = Object.keys(connections).sort((a, b) => {
		return connections[a].toVoteList.length - connections[b].toVoteList.length
	})
	var added = 0
	var index = 0
	messagePool[userID].currentUpvotes = 0
	messagePool[userID].currentResponses = 0
	while(added < circleSize){
		if(shownUsers.includes(allUsers[index]) || allUsers[index] == userID)
			index += 1
		else{
			connections[allUsers[index]].toVoteList.push(userID)
			added += 1
			index += 1
		}
	}
}

function evolveMessage(userID, io) {
	var message = messagePool[userID]
	var totalUpvotes = message.likedUsers.length
	var totalShown = message.shownUsers.length
	if(message.currentUpvotes/message.currentResponses >= 0.5){
		// when grow
		var numberUsers = Object.keys(connections).length
		if(message.currentUpvotes*2 + totalShown < numberUsers)
			messagePool[userID].circleSize = message.currentUpvotes*2
		else
			messagePool[userID].circleSize = numberUsers - 1 - totalShown
		
		if(totalUpvotes/(numberUsers - 1) >= 0.7)
			soundMessage(userID, io)
		else
			spreadMessage(userID)
	}else{
		// when die
		storeMessageSpecial(userID, 0)
		messagePool[userID] = null
		connections[userID].socket.emit("message died")
	}
}

function soundMessage(userID, io) {
	var message = messagePool[userID]
	if(streamerSocket){
		streamerSocket.emit("sound message", message)
	}
	connections[userID].socket.emit("message chosen")
	storeMessageSpecial(userID, 1)
	messagePool[userID] = null
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

function storeMessageSpecial(userID, result) {
	var msg = messagePool[userID]
	let data = new specialData()
	data.userID = userID
	data.text = msg.text
	data.number_liked = msg.likedUsers.length
	data.number_shown = msg.shownUsers.length
	data.result = result
	data.save((err) => {
		if(err)
			console.log("storing special: ", err)
	})
}