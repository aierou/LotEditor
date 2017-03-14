var CANVAS_WIDTH = 1280;
var CANVAS_HEIGHT = 720;

var canvas;
var ctx;
var objects = [];


//Default lot parameters
var LOT_WIDTH = 4;
var LOT_HEIGHT = 8;
var LOT_SCALE = 10;

class Entity{
	constructor(x, y, rotation){
		this.x = x;
		this.y = y;
		this.anchor = {x:0, y:0};
		this.rotation = rotation || 0;
	}
	draw(ctx){
		ctx.beginPath();
		ctx.ellipse(this.x, this.y, 5, 5, 0, 0, 2 * Math.PI);
		ctx.fill();
		
		ctx.save();
		ctx.translate(this.x, this.y);
		ctx.translate(this.anchor.x, this.anchor.y);
		ctx.rotate(this.rotation * Math.PI/180);
		ctx.translate(-this.anchor.x, -this.anchor.y);
		this.drawPrimitive(ctx);
		ctx.restore();
	}
}

class Lot extends Entity{
	constructor(x, y, rotation){
		super(x, y, rotation);
		this.width = LOT_WIDTH * LOT_SCALE;
		this.height = LOT_HEIGHT * LOT_SCALE;
		this.id = getId();
		this.anchor.x = this.width/2;
		this.anchor.y = this.height/2;
	}
	drawPrimitive(ctx){
		ctx.fillText(this.id, this.anchor.x, this.anchor.y);
		
		ctx.beginPath();
		ctx.moveTo(0, this.height);
		ctx.lineTo(0, 0);
		ctx.lineTo(this.width, 0);
		ctx.lineTo(this.width, this.height);
		ctx.stroke();
	}
}

class LotGroup extends Entity{
	constructor(x, y, length){
		super(x, y);
		
		this.lotWidth = LOT_WIDTH * LOT_SCALE;
		this.lotHeight = LOT_HEIGHT * LOT_SCALE;
		this.width = length * this.lotWidth;
		this.height = 2 * this.lotHeight;
		this.rotation = 0;
		
		this.anchor.y = this.lotHeight;
		
		
		this.lots = [];
		for(var i = 0; i < length; i++){
			this.lots.push(new Lot(i * LOT_WIDTH * LOT_SCALE, 0, 180));
		}
		for(var i = 0; i < length; i++){
			this.lots.push(new Lot(i * LOT_WIDTH * LOT_SCALE, LOT_HEIGHT * LOT_SCALE, 0));
		}
	}
	drawPrimitive(ctx){
		for(var i = 0; i < this.lots.length; i++){
			this.lots[i].draw(ctx);
		}
	}
}

window.onload = function(){
	canvas = document.getElementById("canvas");
	canvas.width = CANVAS_WIDTH;
	canvas.height = CANVAS_HEIGHT;
	ctx = canvas.getContext("2d");
	
	objects = [];
	objects.push(new Lot(500, 200, 180));
	objects.push(new LotGroup(500, 400, 3));
	
	render();
}


var currentId = 0;
function getId(){
	return currentId++;
}

var frame = 0;
function render(){
	objects[0].rotation+=1;
	objects[1].rotation+=2;
	
	//Clear buffer
	ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

	for(var i = 0; i < objects.length; i++){
		objects[i].draw(ctx);
	}
	
	window.requestAnimationFrame(render);
}