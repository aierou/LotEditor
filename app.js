var CANVAS_WIDTH = 1280;
var CANVAS_HEIGHT = 720;

var canvas;
var ctx;
var entities = [];
var root;

var SELECTION_PADDING = 3;

//Default lot parameters
var LOT_WIDTH = 4;
var LOT_HEIGHT = 8;
var LOT_SCALE = 10;

class Entity{
  constructor(x, y, type, rotation){
    this.children = [];
    this.x = x;
    this.y = y;
    this.type = type;
    this.rotation = rotation || 0;
    this.anchor = {x:0, y:0};

    entities.push(this); //Add to global entity scope
  }
  getAnchorCanvasPosition(){ //Can return null
    return this._anchor;
  }
  addChild(child){
    child.parent = this;
    this.children.push(child);
  }
  draw(ctx){
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.translate(this.anchor.x, this.anchor.y);
    ctx.rotate(this.rotation * Math.PI/180);
    ctx.translate(-this.anchor.x, -this.anchor.y);
    //Save transformation information
    this._matrix = cloneMatrix(ctx._matrix);
    this._anchor = transformPoint(this.anchor, this._matrix);
    this.drawPrimitive(ctx);
    for(var i = 0; i < this.children.length; i++){
      this.children[i].draw(ctx);
    }
    ctx.restore();
  }
  drawBounds(ctx){
    ctx.save();
    var m = this._matrix;
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.strokeStyle = "blue";
    ctx.beginPath();
    ctx.moveTo(-SELECTION_PADDING, -SELECTION_PADDING);
    ctx.lineTo(-SELECTION_PADDING, this.height + SELECTION_PADDING);
    ctx.lineTo(this.width + SELECTION_PADDING, this.height + SELECTION_PADDING);
    ctx.lineTo(this.width + SELECTION_PADDING, -SELECTION_PADDING);
    ctx.lineTo(-SELECTION_PADDING, -SELECTION_PADDING);
    ctx.stroke();
    ctx.restore();
  }
  drawPrimitive(ctx){
    //Override
  }
  hitTest(x, y){
    if(this.width && this.height){
      var test = transformPoint({x:x, y:y}, this._matrix.inverse());
      return test.x >= 0 && test.x <= this.width && test.y >= 0 && test.y <= this.height;
    }
  }
}

class Lot extends Entity{
  constructor(x, y, rotation){
    super(x, y, "Lot", rotation);
    this.selectable = true;
    this.width = LOT_WIDTH * LOT_SCALE;
    this.height = LOT_HEIGHT * LOT_SCALE;
    this.id = getId(); //auto-incrementing lot id
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
    super(x, y, "LotGroup");
    this.selectable = true;
    this.lotWidth = LOT_WIDTH * LOT_SCALE;
    this.lotHeight = LOT_HEIGHT * LOT_SCALE;
    this.width = length * this.lotWidth;
    this.height = 2 * this.lotHeight;
    this.rotation = 0;

    this.anchor.y = this.lotHeight;


    for(var i = 0; i < length; i++){
      this.addChild(new Lot(i * LOT_WIDTH * LOT_SCALE, 0, 180));
    }
    for(var i = 0; i < length; i++){
      this.addChild(new Lot(i * LOT_WIDTH * LOT_SCALE, LOT_HEIGHT * LOT_SCALE, 0));
    }
  }
}

class DebugPoint extends Entity{
  constructor(x, y){
    super(x, y, "DebugPoint");
  }
  drawPrimitive(ctx){
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 5, 0, 0, 2 * Math.PI);
    ctx.fill();
  }
}

window.onload = function(){
  canvas = document.getElementById("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  ctx = enhanceContext(canvas.getContext("2d"));
  canvas.addEventListener("click", click);

  entities = [];
  root = new Entity(0, 0);
  root.selectable = false;
  root.addChild(new Lot(500, 200, 135));
  root.addChild(new LotGroup(500, 400, 3));
  root.children[1].rotation = 45;

  render();
}

function click(evt){
  var rect = canvas.getBoundingClientRect();
    var x = evt.clientX - rect.left;
    var y = evt.clientY - rect.top;

  var hit = false;
  for(var i = 0; i < entities.length; i ++){
    if(entities[i].hitTest(x, y)){
      hit = true;
      if(select(entities[i])) break;
    }
  }
  if(!hit) selection = [];
}

//Current selection model is to allow the selection of child elements as sub-selections.
//The active selection for inspectors should be on top of the stack e.g. selection[selection.length - 1];

var selection = [];
function select(entity){
  if(!entity.selectable || selection.find(a => a == entity)) return false; //If entity is not selectable or is already selected, return
  if(entity.parent && entity.parent.selectable){
    if(selection.find(a => a == entity.parent)){
      //deselect siblings
      deselect(entity.parent);
      selection.push(entity.parent);
      selection.push(entity);
      return true;
    }else{
      return select(entity.parent); //Search up to find root selectable entity
    }
  }else{
    selection = [];
    selection.push(entity);
    return true;
  }
}

function deselect(entity){
  var index = selection.findIndex(a => a == entity);
  if(index == null) return;
  selection.splice(index, 1);
  for(var i = 0; i < selection.length; i++){ //deselect children
    if(selection[i].parent == entity){
      deselect(selection[i]);
    }
  }
}

var currentId = 0;
function getId(){
  return currentId++;
}

//Input: {x, y}, SVGMatrix
function transformPoint(point, matrix){
  return { x: (point.x * matrix.a) + (point.y * matrix.c) + matrix.e,
       y: (point.x * matrix.b) + (point.y * matrix.d) + matrix.f };
}

function cloneMatrix(m){
  var n = createMatrix();
  n.a = m.a;
  n.b = m.b;
  n.c = m.c;
  n.d = m.d;
  n.e = m.e;
  n.f = m.f;

  return n;
}

var frame = 0;
function render(){

  //Clear buffer
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  //Wheeeeee
  //TODO: remove
  for(var i = 1; i < entities.length; i++){
    entities[i].rotation+=1;
  }

  //Start drawing from root entity
  root.draw(ctx);

  //Draw selection bounds
  for(var i = 0; i < selection.length; i++){
    selection[i].drawBounds(ctx);
  }

  window.requestAnimationFrame(render);
}

//http://stackoverflow.com/a/7397026
//in theory, SVGMatrix will be used by the Canvas API in the future;
//in practice, we can borrow an SVG matrix today!
var createMatrix = function() {
  var svgNamespace = "http://www.w3.org/2000/svg";
  return document.createElementNS(svgNamespace, "g").getCTM();
}

//`enhanceContext` takes a 2d canvas context and wraps its matrix-changing
//functions so that `context._matrix` should always correspond to its
//current transformation matrix.
//Call `enhanceContext` on a freshly-fetched 2d canvas context for best
//results.
var enhanceContext = function(context) {
  var m = createMatrix();
  context._matrix = m;

  //the stack of saved matrices
  context._savedMatrices = [m];

  var super_ = context.__proto__;
  context.__proto__ = ({

    //helper for manually forcing the canvas transformation matrix to
    //match the stored matrix.
    _setMatrix: function() {
      var m = this._matrix;
      super_.setTransform.call(this, m.a, m.b, m.c, m.d, m.e, m.f);
    },

    save: function() {
      this._savedMatrices.push(this._matrix);
      super_.save.call(this);
    },

    //if the stack of matrices we're managing doesn't have a saved matrix,
    //we won't even call the context's original `restore` method.
    restore: function() {
      if(this._savedMatrices.length == 0)
        return;
      super_.restore.call(this);
      this._matrix = this._savedMatrices.pop();
      this._setMatrix();
    },

    scale: function(x, y) {
      this._matrix = this._matrix.scaleNonUniform(x, y);
      super_.scale.call(this, x, y);
    },

    rotate: function(theta) {
      //canvas `rotate` uses radians, SVGMatrix uses degrees.
      this._matrix = this._matrix.rotate(theta * 180 / Math.PI);
      super_.rotate.call(this, theta);
    },

    translate: function(x, y) {
      this._matrix = this._matrix.translate(x, y);
      super_.translate.call(this, x, y);
    },

    transform: function(a, b, c, d, e, f) {
      var rhs = createMatrix();
      //2x2 scale-skew matrix
      rhs.a = a; rhs.b = b;
      rhs.c = c; rhs.d = d;

      //translation vector
      rhs.e = e; rhs.f = f;
      this._matrix = this._matrix.multiply(rhs);
      super_.transform.call(this, a, b, c, d, e, f);
    },

    //warning: `resetTransform` is not implemented in at least some browsers
    //and this is _not_ a shim.
    resetTransform: function() {
      this._matrix = createMatrix();
      super_.resetTransform.call(this);
    },

    __proto__: super_
  });

  return context;
};
