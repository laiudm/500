
// Utilities: 
// From http://stackoverflow.com/questions/3895478/does-javascript-have-a-method-like-range-to-generate-an-array-based-on-suppl
function range(start, count) {
  return Array.apply(0, Array(count))
	.map(function (element, index) { 
	  return index + start;  
  });
}

function removeFromArray(array, value) {
	return array.filter( e => (e != value) );
}

let {h, render, Component} = preact;

//  hack of linkState - https://github.com/developit/linkstate/blob/master/src/index.js
function updateState(state, key, value) {
	let path = key.split('.');
	let newState = {};
	let obj = newState;
	let i = 0;
	for ( ; i<path.length-1; i++) {
		obj = obj[path[i]] || (obj[path[i]] = !i && state[path[i]] || {});	
	}
	obj[path[i]] = value;
	
	//console.log('result is' + JSON.stringify(newState));
	return newState;
}

function updateStateReverseEng(state, key, value) {
	let path = key.split('.');
	let newState = {};
	let obj = newState;
	
	// unravel the first iteration of the loop:
	let i = 0;
	if (i<path.length-1) {
		//obj = obj[path[i]] || (obj[path[i]] = !i && state[path[i]] || {}); 	// Obj is empty so assign will give false
		//obj[path[i]] = !i && state[path[i]] || {};							// i =0 and !0 = true
		obj[path[0]] = state[path[0]] || {};									// if the property doesn't exist init it to {} 
	}
	i = 1;
	for ( ; i<path.length-1; i++) {
		//obj = obj[path[i]] || (obj[path[i]] = !i && state[path[i]] || {});	// i>0, so !i is always false
		obj = obj[path[i]] || (obj[path[i]] = {});								// if the next prop in the path doesn't exist, init it to {}
																				// But in this case obj no longer points to the next level
	}
	obj[path[i]] = value;
	
	//console.log('result is' + JSON.stringify(newState));
	return newState;
}




// 500 Card Game code starts here:

var socket = io();

// Todos:
// opacity: 0.5, -- make card being dragged semi-transparent
// Change cursor depending on status. normal, arrows if dnd source, no-entry if invalid target, drop if valid target
// -- see https://react-dnd.github.io/react-dnd/examples/tutorial 
// use ravenjs ideas to log errors & send them to the server.
// Implement touch
// mouse cursor not correct over kitty
// Client card ordering:
//
// Improve kitty and play-areas visually
// View-all-cards
// - change protocol: server sends array of cards for the opponents, not the no. of cards.
// - ? hover/click mouse over opponent & a window pops up to display opponent's cards. Just backs unless 'view all' clicked
// Give better visual feedback during drag. This would be solely local.



// Strategy
// server maintains overall state, where all the cards are. Client only maintains card order locally; everything else is refreshed from the server.
// Only card names are passed about (minus the .gif)

// Need this to deal with the server error encountered earlier
function mapCardName(card) {
	if (card == 'ad') {
		card = 'add';	// something very strange with accessing ad.gif - server error. Dirty temp hack
	}
	return card;
}

class Card extends Component {
	
	render(props, state) {
		let card = props.card;
		let name = mapCardName(card);
		return h('div', {className: 'card' 
								+ ( (props.playerID != undefined) ? ' Player' + props.playerID : '') 
								+ ( props.notDragTarget ? ' notDragTarget': '' )
								+ ( (props.offset != undefined) ? ' ' + props.offset : '' )		
						}, 
			h('img', {src: "/static/cardimages/" + name + ".gif", 
						id: props.id + '-' + card,				// very easy to put the card name here
						onmousedown: e => e.preventDefault(),	// stop the image being dragged
						})
			);	
	}
}


class Opponent extends Component {
	render(props, state) {
		return h('div', {className: 'Opponent Player' + props.opponent.playerID},
			h('div', {className: 'OpponentName'}, props.opponent.name),
			h('div', {className: 'noCards'}, '' + props.opponent.noCards + ' cards'),
			h('div', {className: 'noTricks'}, '' + props.opponent.noTricks + ' tricks'),
			)
	}
}

let playerName = 'Enter Your Name';

// me: {cards: [], tricks: 0, playerID: 0},
class Player extends Component {
	
	render(props, state) {
		return h('div', {className: 'player Player' + props.me.playerID}, 
			h('input', {className: 'nameEntry', value: playerName,
				oninput: e => {	// such a dirty hack! Should ideally keep the name as a state & pass upward, but hey!
					playerName = e.target.value; 
					socket.emit('name', {playerName})
				},
				onfocus: e => {	e.target.select(); },		// highlight all the text when clicking on the input box
			}),
			h('div', {className: 'cards'}, 
				props.me.cards.map( (c, i) => (h(Card, {card: c, playerID: props.me.playerID, id: 'drag-P' + i }))),		// id is for drag targets
			),
			h('div', {className: 'noTricks'}, '' + props.me.noTricks + ' tricks'),
			h('div', null, h('button', {id: 'button-claimTrick'}, "claim trick")),
		);
	}
}

class Kitty extends Component {

	render(props, state) {
		return h('div', { className: 'kitty', id: 'drag-kitty'},	
				h('div', {className: 'heading'}, 'Kitty'),
				h('div', {className: 'kittyCards'}, ( props.kitty.length > 0
					? props.kitty.map( (c, i) => h(Card, {card: c, notDragTarget: false, offset: 'offset'+i}) )
					: h(Card, {card: 'nocard', notDragTarget: true})
					)
				),
			)
	}
}
	
class ActionsArea extends Component {
	
	render(props, state) {
		return h('div', {className: 'actionsarea', id: 'actionsarea'},
					h('div', {className: 'actionsHeader'}, 'Actions'),
					props.actions.map( action => ( h('div', {className: 'action'}, action)) ),
				);
	}
}	

class PlayArea extends Component {
	
	// http://jsfiddle.net/wUrdM/ relative positioning
	// https://stackoverflow.com/questions/11143273/position-div-relative-to-another-div
	render(props, state) {
		return h('div', {className: "centreArea"},
			//h('div', {className: 'helpText'}, 
			//	h('div', {className: 'helpLine'}, 'Help Text Here'),
			//	//h('div', {className: 'helpLine'}, 'Lowest to Highest:'),
			//	//h('div', {className: 'helpLine'}, '- Spades Clubs Diamonds Hearts No-Trumps'),
			//	//h('div', {className: 'helpLine'}, '    40     60     80      100     120'),
			//	//h('div', {className: 'helpLine'}, ' Joker Right-Bower Left-Bower Ace King Queen 10'),
			//),
			h(Kitty, {kitty: props.kitty}),
			h('div', {className: 'playCards'},
				h('div', {className: 'heading'}, 'Play Area'),
				h('div', {className: 'playedCards', id: 'drag-play'}, (props.played.length > 0
					? props.played.map( (c, i) => h(Card, {card: c.card, playerID: c.player, notDragTarget: true, offset: 'playoffset'+i}) )
					: h(Card, {card: 'nocard', notDragTarget: true})
					)
				),
			),

			h('div', {className: 'buttons'}, 
				h('div', {className: 'helpText'}, '\u2660 \u2663 \u2666 \u2665'),
				h('div', null, h('button', {id: 'button-shuffle'}, "Shuffle")),
				h('div', null, h('button', {id: 'button-showKitty'}, "Show Kitty")),
				//h('div', null, h('button', {id: 'button-showCards'}, "Show Cards")),
				h('div', null, h('button', {id: 'button-undo'}, "undo")),
			),
			h(ActionsArea, {actions: props.actions}),
			
		)
	}
}

class DraggedCard extends Component {
	// to render a div at an arbitrary location: http://jsfiddle.net/f5EMT/1/, https://stackoverflow.com/questions/24050738/javascript-how-to-dynamically-move-div-by-clicking-and-dragging
	//http://jsfiddle.net/f5EMT/1/ mouse draggable element // https://blog.bitsrc.io/5-ways-to-style-react-components-in-2019-30f1ccc2b5b
	
	render (props, state) {
		// Just render the dragged card (if any). Rely on browser to display curror.
		
		return (props.card != '') 
			? h('img', {src: '/static/cardimages/' + mapCardName(props.card) + '.gif', 
				className: 'card draggable ',
				style: {left: props.x, top: props.y, },
				onmousedown: (e => e.preventDefault()),	// stop the image being highlighted when dragged
				})
			: null
	}
}

// messages server -> client:
// state: holds all state info. Sent only infrequently when a user moves a card or clicks a button.
// - me: list of cards in my hand, no. of tricks I've won, my player-id (need to display correct border colours)
// - opponents[] { no of cards in their hand: , no of tricks they've won: , their player-ids: their player-names}
// - played[] cards played: {card: 'ad', player: 0}
// - kitty[] (either back of card or face-value after clicking 'show cards')
// - actions[] list of messages describing what's happened (Dave played ad; Anne clicked 'show cards', etc.)

// messages client -> server
// - button click - one of 'shuffle', 'show cards', 'show kitty', 'my trick', 'un-do'
// - card drag  from hand - {face-value, location: 'play-area', kitty'}
// - card drag to hand - drag from kitty
// - update my name

class FiveHundred extends Component {
	constructor() {
		super();
		// initial setup
		let opponent1 = { name: 'player One',   noCards: 1, noTricks: 2, playerID: 1};	//{ no of cards in their hand: , no of tricks they've won: , their player-ids: their player-names}
		let opponent2 = { name: 'player Two',   noCards: 2, noTricks: 3, playerID: 2};
		let opponent3 = { name: 'player Three', noCards: 3, noTricks: 4, playerID: 3};
		let opponent4 = { name: 'player Four',  noCards: 4, noTricks: 6, playerID: 4};
		this.state = {
			server: {
					// - me: list of cards in my hand, no. of tricks I've won, my player-id (to display correct border colours)
				me: {cards: ['j', '4h', '5h', '2c', '3c', '4c', '5c', '6c', '7c', '8c', '9c', 'tc', 'jc'], tricks: 3, playerID: 0},	    
				opponents: [opponent1, opponent2, opponent3, opponent4],	// - opponents[] 
				played: [{card: 'ah', player: 1}, {card: 'ad', player: 0}, {card: 'ac', player: 0}, 
						{card: 'as', player: 0}, {card: '2s', player: 0}],	// - played[] cards played: {name: 'ad', player: 0}
				kitty: ['b', 'b', 'b'],										// - (either back of card or face-value after clicking 'show cards')
				actions: ['Dave played ad', 'Anne clicked "show cards"'],	// - list of messages describing what's happened recently
			},
			mouse: {x: 0, y: 0, buttons: 0, },
			dragSource: '',			// some indicator of what the source is.
			dragCard:	'',			// which card to display. '' if none
			lastID: '',				// id of the latest element the mouse is over
		};
		
		this.lastID = '';		// generate the equivalent of mouseout messages 
		
		// mouse tracking
		this.mouse = {x: 0, y:0, buttons: 0};
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseUp   = this.onMouseUp.bind(this);
		this.onTouchStart= this.onTouchStart.bind(this);
		this.onTouchEnd  = this.onTouchEnd.bind(this);
		this.onTouchMove = this.onTouchMove.bind(this);

		// message from the server
		socket.on('state', (server) => {
			// be careful about updating the server.me.cards[] portion
			// if old has cards not in new, remove them.
			// if new has cards not in old, add them at the end.
			let oldCards = this.state.server.me.cards;
			let newCards = server.me.cards;
			
			let remCards = oldCards.filter( c => (newCards.includes(c)) );	// remove any cards not in new
			let addCards = newCards.filter( c => (!remCards.includes(c)) );	// the list of new cards not in old
			remCards.push(...addCards);		//add the new cards at the end
			
			server.me.cards = remCards;
			this.setState( {server: server} );
		});
	}
	
	getIndexFrom(id) {
		id = id.slice(6);	// but it may contain the trailing card-name
		let ids = id.split('-');// this sure is hacky
		return parseInt(ids[0]);
	}
	
	getCardFromId(id) {	// id is of form 'drag-Pxx'
		let parts = id.split('-');
		let card = parts[2];	// find what the card is
		return card;
	}
	
	// https://www.w3schools.com/jsref/obj_mouseevent.asp
	// https://www.w3schools.com/jsref/dom_obj_event.asp the different events available
	onMouseMove(e) {	// called whenever the mouse moves, whether mouse button is clicked or not
		e.preventDefault(); 	 		// stops the mouse-drag selecting other elements.
		//console.log(`move ( ${e.clientX}, ${e.clientY}) buttons: ${e.buttons}`);
		
		let id = document.elementFromPoint(e.clientX, e.clientY).id;	// see which element the mouse is over
		if (this.lastID != id) {	// log change only, otherwise it happens on each movement
			this.lastID = id;
			if (id != null) {
				console.log('mouse is over ' + id);
				}
		}
		
		// Game logic here:

		// I might have started a re-order operation & so have a 'no-card' inserted. Remove it here & re-add it if needed below.
		let cards = removeFromArray(this.state.server.me.cards, 'nocard');	// remove any filler card if it's there
		
		// the following is only relevant if the mouse button is down, creating a drag operation
		if (e.buttons == 1) {

			if (this.state.dragSource.startsWith('drag-P') && id.startsWith('drag-P') ) {
				
				// I'm dragging my card over one of my cards with the mouse button down. See if I should insert the emtpy card
				let srcIndex = this.getIndexFrom(this.state.dragSource);
				let targIndex = this.getIndexFrom(id);
				if (srcIndex != targIndex) {	// so it's being dragged to a different location. Put an empty card there
					cards.splice(targIndex, 0, 'nocard');
				}
			}
			
			// todo: give visual feedback when a card being dragged and is over a valid drop target
			
		} else {
			//console.log('button up during move');
			// mouse isn't down, maybe because the mouse was taken outside the window. Make sure any drag event is cancelled
			this.setState( {dragCard: '', dragSource: ''} );
		}
		
		// always update the mouse position
		this.setState({mouse: {x: e.clientX, y: e.clientY, buttons: e.buttons}} );	// this should capture all state info.	
		this.setState({lastID: id});	// don't detect what the element is on mousedown, so need to update in real time. Fix this?		
		
		// update the state. Horrible...
		//let server = JSON.parse(JSON.stringify(this.state.server));
		//server.me.cards = cards;
		//this.setState({server: server});
		
		let newState = updateState(this.state, 'server.me.cards', cards);
		this.setState(newState);

	};
	
	onMouseDown(e) {
		//console.log('mouse down');
		
		// Game logic here:
		
		// Is the mouse over a valid drag source? If so, display drag card.
		// valid drag sources are: kitty, or a card in my hand
		let id = this.state.lastID;
		let validDrag = false;
		let dragCard = 'b';
		
		if (id.startsWith('drag-') && (id != 'drag-play')) {
			validDrag = true;
			if (id.startsWith('drag-P')) {
				dragCard = this.getCardFromId(id);
			}
		}

		// should display the card that's been selected if it's from the player's hand
		
		this.setState( {mouse: {x: e.clientX, y: e.clientY, buttons: e.buttons}} );
		this.setState({dragCard: (validDrag? dragCard : '')});
		this.setState({dragSource: id});	// remember what I'm dragging
	}
	
	onMouseUp(e) {
		//console.log('mouse up');
		
		// game logic here:
		
		let target = this.state.lastID;
		let dragSource = this.state.dragSource;
		
		// Is the mouse over a button? If so, tell the server.
		if (target.startsWith('button-')) {
			console.log(`Button press: ${target}`);
			socket.emit('button', target);
		}
		
		// Have we been dragging, and now over a drag target? If so, update the display and tell the server.
		let validDrag = false;
		
		if (dragSource == 'drag-kitty' && target.startsWith('drag-P')) {
			// drag from kitty to player card is valid, assuming there's a card in kitty
			validDrag = true;
		}
		
		if ( dragSource.startsWith('drag-P') ) {
			
			if (target == 'drag-kitty' || target == 'drag-play') {
				// drag from player card to kitty is valid, assuming kitty isn't already 3
				validDrag = true;
			}
			
			if(target.startsWith('drag-P')) {
				// dragging to re-arrange cards within my hand
				
				if (this.getCardFromId(target) == 'nocard') {
					let srcIndex =  this.getIndexFrom(dragSource);
					let targIndex = this.getIndexFrom(target);
					let card = this.getCardFromId(dragSource);	// find what the card is
					
					// update the state. Horrible...
					//let server = JSON.parse(JSON.stringify(this.state.server));
					//server.me.cards[targIndex] = card;	// overwrite the empty card with the dragged one
					//server.me.cards.splice( (srcIndex < targIndex ? srcIndex : 1+srcIndex), 1);	// remove the card from its original location
					//this.setState({server: server});
					
					// Update the state.
					let cards = JSON.parse(JSON.stringify(this.state.server.me.cards));	// only clone what's changing
					cards[targIndex] = card;	// overwrite the empty card with the dragged one
					cards.splice( (srcIndex < targIndex ? srcIndex : 1+srcIndex), 1);	// remove the card from its original location
					this.setState(updateState(this.state, 'server.me.cards', cards));
					
				}
					
			}
		}
		
		this.setState( {mouse: {x: e.clientX, y: e.clientY, buttons: e.buttons}} );
		this.setState({dragCard: ''});	// don't show a dragged card any more
		
		if (validDrag) {
			console.log(`valid drag fromm ${dragSource} to ${target}`);
			socket.emit('drag', {src: dragSource, dest: target});
		}
	}
	
	onTouchStart(e) {	//dcm need to be calling setState 
		//e.preventDefault();
		let touch = e.targetTouches[0];
		this.mouse.x = touch.clientX;
		this.mouse.y = touch.clientY;
		this.mouse.buttons = 1;	// simulate the left-mouse button down. But I don't use this anywhere anyway
		
		let id = document.elementFromPoint(touch.clientX, touch.clientY).id;	// see which element the touch is over
		this.lastID = id;	// for touch, the 'cursor' is already over the item
		if (id != null) {
			console.log('mouse is over ' + id);
			socket.emit('mouseover', id);
			
			if (id == 'snaparea') {					// touch equivalent of hitting the spacebar
				socket.emit('snap', 'touch');		// inform the server
			}
		}
		socket.emit('mousedown', this.mouse);
	}
	
	onTouchEnd(e) {
		e.preventDefault();
		let touch = e.changedTouches[0];
		this.mouse.x = touch.clientX;
		this.mouse.y = touch.clientY;
		this.mouse.buttons = 0;	// simulate the left-mouse button up. But I don't use this anywhere anyway
		socket.emit('mouseup', this.mouse);
		this.lastID = '';	// reset the element recognition
	}

	onTouchMove(e) {
		e.preventDefault();
		let touch = e.targetTouches[0];
		this.mouse.x = touch.clientX;
		this.mouse.y = touch.clientY;
		this.mouse.buttons = 1;	// simulate the left-mouse button down.But I don't use this anywhere anyway
		let id = document.elementFromPoint(touch.clientX, touch.clientY).id;	// see which element the touch is over
		if (this.lastID != id) {	// only process on change, otherwise it happens on each movement
			this.lastID = id;
			if (id != null) {
				console.log('mouse is over ' + id);
				socket.emit('mouseover', id);
			}
		}
		socket.emit('mousemove', this.mouse);
	}
		
	render({children}, state) {
	
		return h('div', { className: "C500", 
						onmousemove: e => this.onMouseMove(e), 
						onmousedown: e => this.onMouseDown(e), 
						onmouseup:   e => this.onMouseUp(e), 
						ontouchmove: e => this.onTouchMove(e),
						ontouchstart:e => this.onTouchStart(e),
						ontouchend:  e => this.onTouchEnd(e),
						},
			h('h1', null, '500'),
			h('div', {className: 'opponents'}, 
				state.server.opponents.map( (c) => h(Opponent, {opponent: c}))
			),
			h(PlayArea, {played: state.server.played, kitty: state.server.kitty, actions: state.server.actions }),
			h('div', {className: 'bottomArea'}, 
				h(Player, {me: state.server.me}),
			),
			h(DraggedCard, {x: this.state.mouse.x-20, y: this.state.mouse.y-20, card: this.state.dragCard}),
		);
	}		
}

class App extends Component {
	
	render(props, state) {
		return	h(FiveHundred);
	}
}

render(h(App), document.body);


