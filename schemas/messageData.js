// /backend/messageData.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// data for all messages
const MessageSchema = new Schema(
  {
  	userID: String,
  	text: String,
  	isSpecial: Boolean
  },
  { timestamps: true}
);

// export the new Schema so we could modify it using Node.js
module.exports = mongoose.model("Message", MessageSchema);