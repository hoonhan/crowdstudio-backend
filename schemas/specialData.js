// /backend/specialData.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// data for special messages after they have died/delivered
const SpecialSchema = new Schema(
  {
  	userID: String,
  	text: String,
  	number_liked: Number,
  	number_shown: Number,
  	result: Number // -1: if user left/deleted / 0 : if died / 1: if delivered
  },
  { timestamps: true}
);

// export the new Schema so we could modify it using Node.js
module.exports = mongoose.model("Special", SpecialSchema);