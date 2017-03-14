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
	constructor(x, y){
		this.x = x;
		this.y = y;
	}
}

class Lot extends Entity{
	constructor(x, y, rotation){
		super(x, y);
		this.rotation = rotation;
		this.width = LOT_WIDTH * LOT_SCALE;
		this.height = LOT_HEIGHT * LOT_SCALE;
		this.id = getId();
	}
	draw(ctx){
		//Origin
		// ctx.beginPath();
		// ctx.ellipse(this.x, this.y, 5, 5, 0, 0, 2 * Math.PI);
		// ctx.fill();
		
		ctx.fillText(""+this.id, this.x, this.y);
	
		//Lines
		ctx.save();
		ctx.translate(this.x, this.y);
		ctx.rotate(this.rotation * Math.PI/180);
		ctx.beginPath();
		ctx.moveTo(-this.width/2, -this.height/2);
		ctx.lineTo(-this.width/2, this.height/2);
		ctx.lineTo(this.width/2, this.height/2);
		ctx.lineTo(this.width/2, -this.height/2);
		ctx.stroke();
		ctx.restore();
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
		
		
		this.lots = [];
		for(var i = 0; i < length; i++){
			this.lots.push(new Lot(i * LOT_WIDTH * LOT_SCALE, 0, 0));
		}
		for(var i = 0; i < length; i++){
			this.lots.push(new Lot(i * LOT_WIDTH * LOT_SCALE, LOT_HEIGHT * LOT_SCALE, 180));
		}
	}
	draw(ctx){
		
		ctx.beginPath();
		ctx.ellipse(this.x, this.y, 5, 5, 0, 0, 2 * Math.PI);
		ctx.fill();
		
		ctx.save();
		ctx.translate(this.x, this.y);
		ctx.rotate(this.rotation * Math.PI/180);
		ctx.translate(this.lotWidth/2, -this.lotHeight/2); //Anchor point
		for(var i = 0; i < this.lots.length; i++){
			this.lots[i].draw(ctx);
		}
		ctx.restore();
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
	//objects[1].rotation+=1;
	
	//Clear buffer
	ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

	for(var i = 0; i < objects.length; i++){
		objects[i].draw(ctx);
	}
	
	window.requestAnimationFrame(render);
}