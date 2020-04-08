// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
var util = require('util');

// Possibly slightly cleaner startup code here: https://socket.io/get-started/chat/
var app = express();
var server = http.Server(app);
var io = socketIO(server);
app.set('port', 5002);
app.use('/static', express.static(__dirname + '/static'));// Routing
app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, 'index.html'));
});// Start the server.

server.listen(5002, function() {
  console.log('Starting server on port 5002');
});

// Utilities
function range(start, count) {
  return Array.apply(0, Array(count))
	.map(function (element, index) { 
	  return index + start;  
  });
}

function fillArrayWithRange(start, n) {	// https://2ality.com/2013/11/initializing-arrays.html, https://2ality.com/2012/07/apply-tricks.html
	var arr = Array.apply(null, Array(n));
	return arr.map(function (x, i) { return i+start });
}

function removeFromArray(array, value) {
	return array.filter( e => (e != value) );
}

function removeMultipleFromArray(array, values) {
	return array.filter( e => (!values.includes(e)) );
}

// 500 Game Code

// Connection Management
var players = {};		// each client connection, keyed by the socket.id. Hard coded for 5 players currently.
var playerIDs = fillArrayWithRange(0, 5);	// allocated ids from this 'stack', and return them when the connection closes

var playerNames = ['nc', 'nc', 'nc', 'nc', 'nc', ];	// don't undo play name changes

var actions = [];	// don't undo actions; instead log the undo operation

// State Management - do/undo:
// Current State - able to be undone with undo button:
var cards = [];		// cards currently held by each player
var kitty = [];		// cards that have been discarded
var played = [];	// the cards played towards the current trick
var playerTricks = [];	// 
var showAllCards = false;	// true when the game is over
var showKitty = false;

var stateHistory = [];	// where state changes are saved and restored from

function saveState() {
	while (stateHistory.length > 10) {
		stateHistory.shift();
	};
	stateHistory.push( {
		cards:        JSON.parse(JSON.stringify(cards)),	//take a deep copy. Dirty hack
		kitty:        JSON.parse(JSON.stringify(kitty)),
		played:       JSON.parse(JSON.stringify(played)),
		playerTricks: JSON.parse(JSON.stringify(playerTricks)),
		showAllCards: showAllCards,
		showKitty:    showKitty,
	});
	//console.log(`saving. history is now ${stateHistory.length} long`);
}

function restoreState() {
	if (stateHistory.length > 0) {
		lastState = stateHistory.pop();
		console.log(`restoring. history is now ${stateHistory.length} long`);
		cards = lastState.cards;
		kitty = lastState.kitty;
		played = lastState.played;
		playerTricks = lastState.playerTricks;
		showAllCards = lastState.showAllCards;
		showKitty = lastState.showKitty;
	}
}
		
	

function addAction(action) {
	while (actions.length > 10) {	// remove oldest first
		actions.shift();
	};
	actions.push(action);
}

function mapCardToName(card) {
	let name = "";
	if (card == 52) {	// joker
		name = 'j';
	}else {
		let no = card % 13;
		let suit = Math.floor(card / 13);
		name = ['a', '2', '3', '4', '5', '6', '7', '8', '9', 't', 'j', 'q', 'k'][no] + ['s', 'c', 'd', 'h'][suit];
	}
	return name;
}

function shuffleDeck(deck) {	// in-place shuffle
	for (let i=0; i<deck.length; i++) {
		let cardsRemaining = deck.length -i;
		let j = i + Math.floor(Math.random() * cardsRemaining);
		let temp = deck[i];
		deck[i] = deck[j];
		deck[j] = temp;
	}
	return deck;
}

function shuffle() {
	showAllCards = false;
	let cardDeck = fillArrayWithRange(0, 53).map( c => (mapCardToName(c)));	// cards start at no. 1, joker is included
	
	// if 4 are playing, remove some cards
	//cardDeck = removeMultipleFromArray(cardDeck, ['2s','3s','4s', '2c', '3c', '4c', '2d', '3d', '2h', '3h']);
	cardDeck = shuffleDeck(cardDeck);
	cards = range(0, 5).map( c => 
		(range(0, 10).map( e => (cardDeck.pop()) ) ) 
		);

	kitty = range(0, 3).map( e => (cardDeck.pop()) );

	if (cardDeck.length != 0) {
		console.log('Oops - card deck wrong: ' + util.inspect(cardDeck));
	}
	played = [];	// {card: 'ah', player: 1}, {card: 'ad', player: 0}, {card: 'ac', player: 0}
	playerTricks = [0, 0, 0, 0, 0];
	
	//console.log('Hands dealt: ' + JSON.stringify(cards));
}

shuffle();

var count = 10;

function sendState() {
	// quick hack
	//let opponent1 = { name: 'server One',   noCards: count, noTricks: 2, playerID: 1};	//{ no of cards in their hand: , no of tricks they've won: , their player-ids: their player-names}
	//let opponent2 = { name: 'player Two',   noCards: 2, noTricks: 3, playerID: 2};
	//let opponent3 = { name: 'player Three', noCards: 3, noTricks: 4, playerID: 3};
	//let opponent4 = { name: 'player Four',  noCards: 40, noTricks: 60, playerID: 4};
	let server = {
		me: {}, 			// {cards: ['th', '4h', '5h', '2c', '3c', '4c', '5c', '6c', '7c', '8c', '9c', 'tc', 'jc'], noTricks: 3, playerID: 0},	    
		opponents: [],		// - opponents[] 
		played: [],			// - played[] cards played: {name: 'ad', player: 0}
		kitty: [], 			// ['b', 'b', 'b'],	// - (either back of card or face-value after clicking 'show cards')
		actions: [],		//['Dave played ad', 'Anne clicked "show cards"'],	// - list of messages describing what's happened recently
	};

	// send state information for each connected client
	for (let [_, p] of Object.entries(players)) {
		//console.log('p: ' + util.inspect(p) );
		let playerID = p.id;
		
		server.me = {cards: cards[playerID], noTricks: playerTricks[playerID], playerID: playerID};
		server.kitty = kitty.map( c => ( showKitty ? c : 'b'));
		server.opponents = [];
		for (let i=1; i<5; i++) {
			let offset = (playerID + i) % 5;
			let opponent = {name: playerNames[offset], noCards: cards[offset].length, noTricks: playerTricks[offset], playerID: offset};
			server.opponents.push(opponent);
		}
		
		server.played = played;
		server.actions = actions;
		
		//console.log(`server: ${util.inspect(server)}`);
		
		p.socket.emit('state', server);
	};
	count++;
}

// https://socket.io/docs/server-api/ 

io.on('connection', function(socket) {
	let addr = socket.handshake.address;
	console.log("New connection, id is " + socket.id + ', ip addr: ' + addr);
	
	// configure the new connection.
	playerIDs.sort();					// allocate the lowest id first
	let playerID = playerIDs.shift();	// allocated the first available playerid. // todo check that an id is available.
	
    players[socket.id] = {
		id: playerID,
		socket: socket,
    };
	
	playerNames[playerID] = 'player ' + playerID;
	addAction(`New player joined. id: ${playerID}, ${addr}`);
	sendState();
	
	//for (let skt in players) {	// players is keyed by socket.id
	//	console.log(`socket: ${skt}, playerID: ${players[skt].id}`);
	//}
	
  socket.on('disconnect', function(data) {
	var player = players[socket.id]; 
	console.log(`player ${playerNames[player.id]} disconnected - id ${socket.id}`);
	addAction(`Player ${playerNames[player.id]} gone. id: ${playerID}, ${addr}`);
	playerIDs.unshift(player.id);	// return the player id for re-use.
	playerNames[player.id] = 'nc';
	delete players[socket.id];
	sendState();
  });
  
  socket.on('name', function(update) {
	var player = players[socket.id] || {}; 
	playerNames[player.id] = update.playerName;
	//console.log(`name: ${update.playerName}. playerNames: ${util.inspect(playerNames)}` );
	sendState();
  });
  

  socket.on('button', function(target) {
	var player = players[socket.id] || {};
	// button pushed - take appropriate action
	count++;
	if (target == 'button-shuffle') {
		saveState();
		showKitty = false;
		showAllCards = false;
		shuffle();
		addAction(`${playerNames[player.id]} shuffled`);

	}
	if (target == 'button-showKitty') {
		addAction(`${playerNames[player.id]} showed Kitty`);
		saveState();
		showKitty = !showKitty;
	}
	if (target == 'button-showCards') {
		addAction(`${playerNames[player.id]} showed Cards`);
		saveState();
		showAllCards = true;
	}
	if (target == 'button-claimTrick') {
		//
		addAction(`${playerNames[player.id]} claimed the trick`);
		saveState();
		playerTricks[player.id]++;
		played = [];	// {card: 'j', player: 1}
		//console.log(`playerTricks: ${util.inspect(playerTricks)}`);

	}
	if (target == 'button-undo') {
		addAction(`${playerNames[player.id]} clicked undo`);
		restoreState();;
	}

	// now trigger send of state to all players
	console.log('button: ' + target);
	sendState();
  });
  
  socket.on('drag', function(drag) {
	var player = players[socket.id] || {};
	let src = drag.src;
	let dest = drag.dest;
	
	console.log(`drag from ${src} to ${dest}`);
	
	if (src == 'drag-kitty') {
		// drag from kitty -  to the current player.
		saveState();
		kitty.forEach( c => ( cards[player.id].push(c) ) );
		kitty = [];
		addAction(`${playerNames[player.id]} took kitty`);
	}
	
	if (src.startsWith('drag-P') ) {
		// drag from the player to either kitty 'drag-kitty' or the play area 'drag-play'
		let parts = src.split('-');
		card = parts[2];
		// should check that the card is actually in this player's hand.
		let index = cards[player.id].indexOf(card);
		if (index >= 0) {
			// it's a valid card, remove it
			saveState();
			cards[player.id] = removeFromArray( cards[player.id], card);
			// add it the dest.
			if (dest == 'drag-kitty') {
				kitty.push(card);
				addAction(`${playerNames[player.id]} returned a card to kitty`);
			} else if (dest == 'drag-play') {
				played.push( {card: card, player: player.id} );
				addAction(`${playerNames[player.id]} played ${card}`);
			} else {
			// errors
			}
		} else {
			// error
		}
	}

	sendState();

  });
  
});
