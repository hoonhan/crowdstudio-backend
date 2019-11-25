// SOCKET LOGIC AND HANDLER
const messageData = require('./schemas/messageData')

var currUserID = 0

var connections = {}
var messagePool = {}

var groupID = "default"

var soundMsgTimer;

module.exports = (server) => {

	// START SOCKET
	const io = require('socket.io').listen(server)

	// CONNECTION HANDLER
	io.on("connection", socket => {
		socket.join("group-" + groupID)

		socket.on("register", userID => {
			socket.userID = userID
			connections[userID] = {socket: socket, toVoteList: []}
			messagePool[userID] = null
		})

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
					io.in("group-" + groupID).emit("message", msg)
				}
			})

			if(msg.isSpecial) {
				addToPool(msg.text, socket.userID)
			}
		})

		socket.on("request vote", () => {
			var nextToVote = connections[socket.userID].toVoteList.shift()
			while(nextToVote && !messagePool[nextToVote])
				nextToVote = connections[socket.userID].toVoteList.shift()
			if(nextToVote != undefined){
				var msg = messagePool[nextToVote]
				socket.emit("vote message", {userID: nextToVote, text: msg.text})
			}else{
				socket.emit("vote message", false)
			}
		})

		socket.on("vote response", (data) => {
			if(messagePool[data.userID]){
				messagePool[data.userID].currentResponses += 1 
				messagePool[data.userID].currentUpvotes += (data.isUpvoted ? 1 : 0)
				messagePool[data.userID].shownUsers.push(socket.userID)
				if(messagePool[data.userID].currentResponses == messagePool[data.userID].circleSize)
					evolveMessage(data.userID)
			}
		})

		socket.on("delete special", () => {
			messagePool[socket.userID] = null
		})
 
		// DISCONNECT
		socket.on("disconnect", () => {
			messagePool[socket.userID] = null
			delete connections[socket.userID]
			console.log("client disconnected")
		})
	})

	setInterval(() => {
		var connectionIDs = Object.keys(connections)
		var rankList = getRankList()
		console.log(rankList)
		io.in("group-" + groupID).emit("rank list update", rankList)
		io.in("group-" + groupID).emit("view count update", connectionIDs.length)
		for(var i = 0; i < connectionIDs.length; i++){
			var client = connections[connectionIDs[i]].socket
			client.emit("msg status update", messagePool[client.userID])
		}
	}, 1000)

	soundMsgTimer = setInterval(() => soundTop(io), 60000)
}

function getRankList(){
	var messageList = Object.keys(messagePool).filter((id) => {
		return !!messagePool[id]
	}).map(id => {
		var message = messagePool[id]
		message.userID = id
		message.score = getAvgPercentage(id)
		if(Number.isNaN(message.score))
			message.score = 0
		return message
	}).sort((a, b) => b.score - a.score)
	return messageList
}

function addToPool(message, userID) {
	if(messagePool[userID])
		return false

	var numberUsers = Object.keys(connections).length
	var obj = {text: message, circleSize: (numberUsers > 4 ? 4 : numberUsers - 1), currentUpvotes: 0, currentResponses: 0, shownUsers: [], roundHistory: []}
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
	var totalUpvotes = message.roundHistory.reduce((a, b) => a + b[0], 0)
	var totalShown = message.roundHistory.reduce((a, b) => a + b[1], 0)
	if(totalUpvotes/totalShown > 0.5){
		// when grow
		var numberUsers = Object.keys(connections).length
		if(message.currentUpvotes*2 + totalShown <= numberUsers)
			messagePool[userID].circleSize = message.currentUpvotes*2
		else
			messagePool[userID].circleSize = numberUsers - 1 - totalShown
		messagePool[userID].roundHistory.push([message.currentUpvotes, message.currentResponses])
		
		if(getAvgPercentage(userID) > 0.8 && message.roundHistory.length >= 2)
			soundMessage(true, userID, io)
		else
			spreadMessage(userID)
	}else{
		// when die
		messagePool[userID] = null
	}
}

function getAvgPercentage(userID) {
	var message = messagePool[userID]
	var totalPercentage = message.roundHistory.reduce((a, b) => a + b[0]/b[1], 0)
	return totalPercentage / message.roundHistory.length
}

function soundMessage(isQuick, userID, io) {
	if(isQuick)
		clearInterval(soundMsgTimer)

	var message = messagePool[userID]
	messagePool[userID] = null
	io.to("group-" + groupID).emit("sound message", message)

	soundMsgTimer = setInterval(() => soundTop(io), 6000)
}

function soundTop(io) {
	var rankList = getRankList()
	var message = rankList[0]
	if(message)
		soundMessage(false, message.userID, io)
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