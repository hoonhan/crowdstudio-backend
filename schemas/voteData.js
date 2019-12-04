// /backend/voteData.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const VoteSchema = new Schema(
  {
  	voterID: String,
  	creatorID: String,
  	message: String,
  	isUpvoted: Boolean
  },
  { timestamps: true}
);

// export the new Schema so we could modify it using Node.js
module.exports = mongoose.model("Vote", VoteSchema);