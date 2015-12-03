var mongoose = require('mongoose');
var autoIncrement = require('mongoose-auto-increment');

var ServerSchema = new mongoose.Schema({
	key: { type: String, index: true, unique: true},
	ip : {
		v4: { type: [String] },
		v6: { type: [String] }
	},
	port: { type: Number},
	name: { type: String },
	dedicated: { type: Boolean },
	requiresPassword: { type: Boolean },
	description: { type: String },
	version: { type: String },
	players: { type: Number },
	maxPlayers: { type: Number },
	supportsIPv4: { type: Boolean, default: false},
	supportsIPv6: { type: Boolean, default: false},
	gameInfo: {
		mapSize: {type: Number},
		guests: {type: Number},
		day: {type: Number},
		month: {type: Number},
		parkValue: {type: Number},
		cash: {type: Number}
	},
	provider: {
		name: { type: String },
		email: { type: String },
		website: { type: String }
	},
	updated_at: { type: Date, default: Date.now }
});

ServerSchema.plugin(autoIncrement.plugin, { model: 'Server', field: 'serverId' });

module.exports = mongoose.model('Server', ServerSchema);