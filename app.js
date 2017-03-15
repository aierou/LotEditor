var CANVAS_WIDTH = 1280;
var CANVAS_HEIGHT = 720;

var canvas;
var ctx;
var entities = [];
var root;

var SELECTION_PADDING = 3;

//Default spot parameters
var SPOT_WIDTH = 4;
var SPOT_HEIGHT = 8;
var SPOT_SCALE = 10;

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
  removeAllChildren(){
    for(var i = 0; i < entities.length; i++){
      if(entities[i].parent == this){
        entities.splice(i,1);
        i--;
      }
    }
    this.children = [];
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

    //Annotations
    ctx.save();
    ctx.resetTransform();
    this.drawAnnotations(ctx);
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
  drawAnnotations(ctx){
    //Override
  }
  hitTest(x, y){
    if(this.width && this.height){
      var test = transformPoint({x:x, y:y}, this._matrix.inverse());
      return test.x >= 0 && test.x <= this.width && test.y >= 0 && test.y <= this.height;
    }
  }
}

class Spot extends Entity{
  constructor(x, y, rotation){
    super(x, y, "Spot", rotation);
    this.selectable = true;
    this.width = SPOT_WIDTH * SPOT_SCALE;
    this.height = SPOT_HEIGHT * SPOT_SCALE;
    this.id = getId(); //auto-incrementing spot id
    this.anchor.x = this.width/2;
    this.anchor.y = this.height/2;
  }
  drawPrimitive(ctx){
    ctx.beginPath();
    ctx.moveTo(0, this.height);
    ctx.lineTo(0, 0);
    ctx.lineTo(this.width, 0);
    ctx.lineTo(this.width, this.height);
    ctx.stroke();
  }
  drawAnnotations(ctx){
    var p = this.getAnchorCanvasPosition();
    ctx.fillText(this.id, p.x, p.y);
  }
}

class SpotGroup extends Entity{
  constructor(x, y, length){
    super(x, y, "SpotGroup");
    this.selectable = true;
    this.spotWidth = SPOT_WIDTH * SPOT_SCALE;
    this.spotHeight = SPOT_HEIGHT * SPOT_SCALE;
    this.rotation = 0;
    this.length = length;

    this.anchor.y = this.spotHeight;

    this.setLength(length);
  }
  setLength(length){
    this.removeAllChildren();
    for(var i = 0; i < length; i++){
      this.addChild(new Spot(i * SPOT_WIDTH * SPOT_SCALE, 0, 180));
    }
    for(var i = 0; i < length; i++){
      this.addChild(new Spot(i * SPOT_WIDTH * SPOT_SCALE, SPOT_HEIGHT * SPOT_SCALE, 0));
    }
    this.width = length * this.spotWidth;
    this.height = 2 * this.spotHeight;
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
  canvas.addEventListener("mousedown", mouseDown);
  canvas.addEventListener("mouseup", mouseUp);
  canvas.addEventListener("mousemove", mouseMove);

  entities = [];
  root = new Entity(0, 0);
  root.selectable = false;
  root.addChild(new Spot(500, 200, 135));
  root.addChild(new SpotGroup(500, 400, 3));
  root.children[1].rotation = 45;

  tick();
}
var dragging = [];
var dragged = false;
var dragposition = null;
var mouseIsDown = false;
function startDrag(x, y){
  dragging = [];
  dragged = false;
  if(selection.length > 0){
    for(var i = 0; i < selection.length; i++){
      if(selection[i].parent && !selection[i].parent.selectable){
        dragging.push({offset:{x:x-selection[i].x, y:y-selection[i].y}, entity:selection[i]});
      }
    }
  }
}
function mouseDown(evt){
  mouseIsDown = true;
  var pos = getMousePosition(evt);
  dragposition = {x:pos.x, y:pos.y};
}
function mouseUp(evt){
  dragging = [];
  dragposition = null;
  mouseIsDown = false;
  if(dragged){
    dragged = false;
    return;
  } //If we dragged, we don't want to select on release
  var pos = getMousePosition(evt);

  selectAtPosition(pos.x, pos.y);
}
var currentMouse;
function mouseMove(evt){
  var pos = getMousePosition(evt);
  //For some reason, mousemove is called for all mouse events.
  //Here we check to see if the mouse actually moved.
  if(currentMouse != null && currentMouse.x==pos.x && currentMouse.y==pos.y){
    return;
  }
  currentMouse = pos;
  //We want to try a drag if the mouse was moved while the mouse button is being held.
  //This is done to make dragging feel better.
  if(dragposition != null){
    selectAtPosition(dragposition.x, dragposition.y, false); //Don't descend as this selection is only for dragging
    startDrag(dragposition.x, dragposition.y);
    dragposition = null;
  }
  //We want to set this even when we aren't dragging something
  //This is so select isn't called on mouse release if we dragged
  if(mouseIsDown) dragged = true;
  if(dragging.length > 0){
    for(var i = 0; i < dragging.length; i++){
      dragging[i].entity.x = pos.x-dragging[i].offset.x;
      dragging[i].entity.y = pos.y-dragging[i].offset.y;
    }
  }
}
function getMousePosition(evt){
  var rect = canvas.getBoundingClientRect();
  var x = evt.clientX - rect.left;
  var y = evt.clientY - rect.top;
  return {x:x, y:y};
}
function selectAtPosition(x, y, descend){
  if(descend == null) descend = true;
  var hit = false;
  for(var i = 0; i < entities.length; i ++){
    if(entities[i].hitTest(x, y)){
      hit = true;
      if(select(entities[i], descend)) break;
    }
  }
  if(!hit){
    selection = [];
    updateInspector();
  }
}
function selectAll(){
  selection = [];
  for(var i = 0; i < entities.length; i ++){
    selection.push(entities[i]);
  }
}

//Current selection model is to allow the selection of child elements as sub-selections.
//The active selection for inspectors should be on top of the stack e.g. selection[selection.length - 1];

var selection = [];
function select(entity, descend){
  if(descend == null) descend = true;
  if(!entity.selectable || selection.find(a => a == entity)) return false; //If entity is not selectable or is already selected, return
  if(entity.parent && entity.parent.selectable){
    if(descend && selection.find(a => a == entity.parent)){
      //deselect siblings
      deselect(entity.parent);
      selection.push(entity.parent);
      selection.push(entity);
      updateInspector();
      return true;
    }else{
      return select(entity.parent); //Search up to find root selectable entity
    }
  }else{
    selection = [];
    selection.push(entity);
    updateInspector();
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
  updateInspector();
}

var inspecting;
function updateInspector(){
  inspecting = null;
  if(selection.length > 0) inspecting = selection[selection.length - 1];
  if(inspecting){
    var src;
    switch(inspecting.type){
      case "Spot":
        src = "inspector/spot.html";
      break;
      case "SpotGroup":
        src = "inspector/spotgroup.html";
      break;
      default:
        src = "inspector/default.html";
      break;
    }
    document.getElementById("inspector").src = src;
  }else{
    document.getElementById("inspector").src = "inspector/default.html";
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
function tick(){

  //Clear buffer
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  //Start drawing from root entity
  root.draw(ctx);

  //Draw selection bounds
  for(var i = 0; i < selection.length; i++){
    selection[i].drawBounds(ctx);
  }

  window.requestAnimationFrame(tick);
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
