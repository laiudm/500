let {h, render, Component} = preact;
const { useState, useReducer, useLayoutEffect, useRef, useEffect } = preactHooks;

/////////////////////////////////////////////
// dnd start
//////////////////////////////////////////////

// simple broadcase mechanism. Every message is sent to all listeners
let listeners = [];

// todo: refactor these 3x broadcasters into one.
// Might be able to use .reduce() - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce

// returns true if any of the elements returns true 
function broadcastMouseMove(msg) {
	return listeners.reduce( (acc, l) => acc | (l && l.mouseMove && l.mouseMove(msg)), false );	// must be a logical or, because still need to call all listeners
}

function broadcastMouseDown(msg) {
	let found = listeners.find( l => l && l.mouseDown && l.mouseDown(msg) );	// mouseDown returns true if the mouse is over this element (todo: and it's valid)
	//console.log('found one: ' + found);
	return found;
}

function broadcastMouseUp(msg, src) {				// send to all, but only affects drag-source and drag-target
	listeners.forEach( l => l && l.mouseUp && l.mouseUp(msg, src) );
}

function listen(l) {
	if ( !listeners.includes(l) ) listeners.push(l);
}

function unlisten(l) {
	if (l) {
		listeners.splice(listeners.indexOf(l) >>> 0, 1);
	}
}

// dnd state - currently global; fix this later
isDragging = false;
dragSource = null;	// the associated listener
draggedType = null;		// the type of the item being dragged

// dnd utilities

function isMouseOver(x, y, ref) {
	if (ref) {	// on first call may not be initialised
		let bounding = ref.getBoundingClientRect();
		return (bounding.left < x && bounding.right > x) && (bounding.top < y && bounding.bottom > y);
	}
	return false;
}

function useDrag(spec) {
	let [mouse, setMouse] = useState( {} );	// offset from mouse-down
	let [mouseOffset, setMouseOffset] = useState( {x: 0, y: 0});
	let [isOver, setOver] = useState(false);
	let [isDragging, setDragging] = useState(false);
	const element = useRef(null);
	useEffect( () => {
		let interfaces = {
			mouseMove: (msg) => {
				setMouse({x: msg.x - mouseOffset.x, y: msg.y - mouseOffset.y});
				let over = isMouseOver(msg.x, msg.y, element.current);
				setOver(over);
				return over;
			},
			mouseDown: (msg) => {
				setMouseOffset(msg);
				setMouse({x: 0, y: 0}); 	
				let over = isMouseOver(msg.x, msg.y, element.current);
				setOver(over);
				return over
			},
			getType: () => spec.item.type,
			getItem: () => spec.getItem ? spec.getItem() : null,
				
			setDragging: (f) => {console.log('dragging: ' + f + ' ' + spec.getItem().card); setDragging(f)},
		};
		listen(interfaces);
		return () => unlisten(interfaces);
		
	}, [mouse, mouseOffset, spec.getItem]);	
	
	return [{isOver: isOver}, element, isDragging, mouse];	// hardwired collected props
}

//todo - some dupl calcs here. Instead save raw values & have functions that encapsulate the calcs. & are called only when needed?
function useDrop(spec) {
	let [mouse, setMouse] = useState( {} );
	let [isOver, setOver] = useState( false );
	const element = useRef(null);
	useEffect( () => {
		let interfaces = {
			mouseMove: (msg) =>  {
				setMouse(msg);
				let over = isDragging && isMouseOver(msg.x, msg.y, element.current)&& (spec.accept == draggedType);
				setOver(over);
				return over && (spec.canDrop ? spec.canDrop() : true);	// if canDrop() isn't specified, assume true
			},
			mouseUp:   (msg, src) => {
				setMouse(msg);
				let over = isMouseOver(msg.x, msg.y, element.current);
				setOver(isDragging && over);
				if (isDragging && over && (spec.accept == draggedType)) {
					spec && spec.drop && spec.drop(src);	// callback to the app on a drop action
				}
			},
		}
		listen(interfaces);
		return () => unlisten(interfaces);
		
	}, [mouse, isOver]);
	return [ {isOver: isOver, isDragging: isDragging && (spec.accept == draggedType)}, element ];	// hardwired collected props.
}

function DragPreview( {isDragging, mouse, children} ) {
	return (isDragging 
				? h('div', { style: {position: 'absolute', left: mouse.x, top: mouse.y, 'z-index':100, opacity: '0.5'}}, children )
				: null
	)
}

class DnDProvider extends Component {
	constructor() {
		super();
		// mouse tracking
		this.mouse = {x: 0, y:0, buttons: 0};
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseUp   = this.onMouseUp.bind(this);
		this.onTouchStart= this.onTouchStart.bind(this);
		this.onTouchEnd  = this.onTouchEnd.bind(this);
		this.onTouchMove = this.onTouchMove.bind(this);
	}
	
	onMouseMove(e) {
		let active = broadcastMouseMove( { x: e.clientX, y: e.clientY, button: e.buttons} ); // broadcast to all registered components.
		if (isDragging) {
			document.body.style.cursor = active ? 'move' : 'no-drop';
			console.log('dragging');
			//e.preventDefault();
		} else {
			document.body.style.cursor = active ? 'zoom-in' : 'default';		// move grab default
		}
	}
	
	onMouseDown(e) {	// find if it's the start of a valid drag
		let ds;
		//document.body.style.cursor = 'move';
		if (ds = broadcastMouseDown( { x: e.clientX, y: e.clientY, button: e.buttons} )) {
			isDragging = true;
			dragSource = ds;
			draggedType = ds.getType();
			dragSource.setDragging(true);
			document.body.style.cursor = "move";
			e.preventDefault();	// only do this if it's the start of a drag action.
		}
		
	}
	
	onMouseUp(e) {
		document.body.style.cursor = "default";
		broadcastMouseUp( { x: e.clientX, y: e.clientY, button: e.buttons}, dragSource );
		if (isDragging) {
			e.preventDefault();	// only if it's related to a drag operation.
		}
		isDragging = false;
		dragSource && dragSource.setDragging(false);
		dragSource = null;
		
	}
	
	onTouchStart(e) {
		
	}
	
	onTouchEnd(e) {
		
	}
	
	onTouchMove(e) {
		
	}
	
	render ({children}) {
		return h('div', { 
				style: {position: 'relative'},
				onmousemove: e => this.onMouseMove(e), 
				onmousedown: e => this.onMouseDown(e), 
				onmouseup:   e => this.onMouseUp(e), 
				ontouchmove: e => this.onTouchMove(e),
				ontouchstart:e => this.onTouchStart(e),
				ontouchend:  e => this.onTouchEnd(e),
				},
			children,
		)
	}
}
/////////////////////////////////////////////
// dnd end
//////////////////////////////////////////////


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

// Todos:
// Give better visual feedback during drag. This would be solely local.
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




// Strategy
// server maintains overall state, where all the cards are. Client only maintains card order locally; everything else is refreshed from the server.
// Only card names are passed about (minus the .gif)

const ItemTypes = { KITTYSOURCE: 'KittySource', PLAYERCARD: 'PlayerCard' };

var socket = io();

function ActiveButton({name, msg}) {
	return h('button', {onclick: () => socket.emit('button', msg)}, name);
}

function CardImage ( {card}) {
	let name = card == 'ad' ? 'add' : card;
	return h('img', {src: "/static/cardimages/" + name + ".gif",});
}

function BorderedCard( {card, playerID}) {
	return h('div', {className: 'card Player' + playerID, style: {'pointer-events': 'none'}},
		h(CardImage, {card: card})
	);
}

function WithOffset( {offset, children}) {
	return h('div', {className: offset}, children);
}

function Draggable({type, getItem, children}) {
	let [ {isOver}, dragElement, isDragging, mouse] = useDrag({
		item: {type: type},
		getItem: () => { return getItem },
	});
	return h('div', {style: {display: 'inline-block', position: 'relative'}},
		h(DragPreview, {isDragging: isDragging, mouse: mouse}, children),
		h('div', {ref:dragElement, style: {display: 'inline-block', 'pointer-events': 'none'}}, children),
	);
}

function Opponent ({opponent}) {
	return h('div', {className: 'Opponent Player' + opponent.playerID},
		h('div', {className: 'OpponentName'}, opponent.name),
		h('div', {className: 'noCards'}, '' + opponent.noCards + ' cards'),
		h('div', {className: 'noTricks'}, '' + opponent.noTricks + ' tricks'),
		)
}

let playerName = 'Enter Your Name';

function nameEntry() {
	return h('input', {className: 'nameEntry', value: playerName,
			oninput: e => {	
				playerName = e.target.value; 		// Ideally keep the name as a state & pass upward, but hey!
				socket.emit('name', {playerName})
			},
			onfocus: e => {	e.target.select(); },		// highlight all the text when clicking on the input box
		});
}

function DnDPlayerCard({card, index, updateCardOrder}) {
	let [ {isOver, isDragging}, dragElement] = useDrop( {
		accept: ItemTypes.PLAYERCARD,
		drop:(src) => updateCardOrder(src.getItem().index, index),
	});
	return h('div', {ref: dragElement, style: {display: 'inline-block'}}, 
		h(Draggable, {type: ItemTypes.PLAYERCARD, getItem: {card: card, index: index}}, 
			h(CardImage, {card: card})
		)
	);
}
	
function Player ({me, updateCardOrder}) {
	let [ {isOver, isDragging}, dragElement] = useDrop( {
		accept: ItemTypes.KITTYSOURCE,
		drop:() => socket.emit('drag', {src: 'drag-kitty', dest: ''}),
	});
	
	return h('div', {className: 'player Player' + me.playerID, ref: dragElement}, 
		h(nameEntry),
		h('div', null, 
			me.cards.map( (c, i) => (h(DnDPlayerCard, {card: c, index: i, updateCardOrder: updateCardOrder})) ),
		),
		h('div', {className: 'noTricks'}, '' + me.noTricks + ' tricks'),
		h('div', null, h(ActiveButton, {name: 'claim trick', msg: 'button-claimTrick'})),
	);
}

function KittyCards({kitty}) {
	return kitty.map( (c, i) => 
		h(WithOffset, {offset: 'playoffset'+i}, (i == (kitty.length-1)
			? h(Draggable,{type: ItemTypes.KITTYSOURCE, getItem: {card: 'b', index: 0}}, h(CardImage, {card: c}) )	// only make last card draggable
			: h(CardImage, {card: c})
			)
		)
	)
}

function Kitty ({kitty}) {
	let [ {isOverDrop, isDraggingDest}, dropElement] = useDrop( {
		accept: ItemTypes.PLAYERCARD,
		drop:(src) => {
			socket.emit('drag', {src: 'drag-P0-' + src.getItem().card, dest: 'drag-kitty'});
		},
	});
	return h('div', { className: 'kitty', style: {position: 'relative'}},	
			h('div', {className: 'heading'}, 'Kitty'),
			h('div', {className: 'kittyCards', ref: dropElement}, kitty.length > 0 
				? h(KittyCards, {kitty: kitty})
				: h(CardImage, {card: 'nocard'})
				)
		)
}
	
function ActionsArea({actions}) {
	return h('div', {className: 'actionsarea'},
				h('div', {className: 'actionsHeader'}, 'Actions'),
				actions.map( action => ( h('div', {className: 'action'}, action)) ),
			);
}	

// http://jsfiddle.net/wUrdM/ relative positioning
// https://stackoverflow.com/questions/11143273/position-div-relative-to-another-div
function PlayArea({kitty, played, actions}) {
		
	let [ {isOver, isDragging}, element] = useDrop( {
		accept: ItemTypes.PLAYERCARD,
		drop:(src) => {
			socket.emit('drag', {src: 'drag-P0-' + src.getItem().card, dest: 'drag-play'});
		},
	});
	return h('div', {className: "centreArea"},
		h(Kitty, {kitty: kitty}),
		h('div', {className: 'playCards', ref: element},
			h('div', {className: 'heading'}, 'Play Area'),
			h('div', {className: 'playedCards'}, (played.length > 0
				? played.map( (c, i) => h(WithOffset, {offset: 'playoffset'+i},  h(BorderedCard, {card: c.card, playerID: c.player }) ))
				: h(CardImage, {card: 'nocard'})
				)
			),
		),
	
		h('div', {className: 'buttons'}, 
			h('div', {className: 'helpText'}, '\u2660 \u2663 \u2666 \u2665'),		// Spades Clubs Diamonds Hearts
			h('div', null, h(ActiveButton, {name: 'shuffle',    msg: 'button-shuffle'})),
			h('div', null, h(ActiveButton, {name: 'Show Kitty', msg: 'button-showKitty'})),
			h('div', null, h(ActiveButton, {name: 'undo',       msg: 'button-undo'})),
		),
		h(ActionsArea, {actions: actions}),
	)
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
		};
		
		this.updateCardOrder = this.updateCardOrder.bind(this);
		
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
	
	updateCardOrder(from, to) {
		// console.log(`dnd from ${from} to ${to}`);
		if (from != to) {
			let cards = JSON.parse(JSON.stringify(this.state.server.me.cards));	// only clone what's changing
			let card = cards[from];
			cards.splice( (from > to ? to     : to + 1), 0, card);	// insert the card in its new location
			cards.splice( (from > to ? from+1 : from  ), 1);	// remove the card from its original location
			this.setState(updateState(this.state, 'server.me.cards', cards));
		}
	}
		
	render({children}, {server}) {
		return h('div', { className: "C500",},
			h('h1', null, '500'),
			h('div', {className: 'opponents'}, 
				server.opponents.map( (c) => h(Opponent, {opponent: c}))
			),
			h(PlayArea, {played: server.played, kitty: server.kitty, actions: server.actions }),
			h('div', {className: 'bottomArea'}, 
				h(Player, {me: server.me, updateCardOrder: this.updateCardOrder}),
			),
		);
	}		
}

//render(h(DnDProvider, null, h(FiveHundred)), document.getElementById('root'));	//document.body
render(h(DnDProvider, null, h(FiveHundred)), document.body);	//document.body


