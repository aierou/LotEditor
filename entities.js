var SPOT_WIDTH = 4;
var SPOT_HEIGHT = 8;
var SPOT_SCALE = 10;
var SELECTION_PADDING = 3;

var classes = {};
classes["EntityManager"] = class extends Array{
  constructor(){
    super(...arguments);
    this.id = 0;
  }
  //There may be a better solution for this scoping issue that I'm running into,
  //but as of now, Entity Manager may need to store some globals.
  getId(){
    return this.id++;
  }
  push(entity){
    entity.manager = this;
    super.push(entity);
    entity.onAdd();
  }
  remove(entity){
    this.splice(this.findIndex(a => a == entity), 1);
  }
}

classes["Entity"] = class{
  constructor(x, y, type, rotation){
    this.children = [];
    this.x = x;
    this.y = y;
    this.type = type || "Entity";
    this.rotation = rotation || 0;
    this.anchor = {x:0, y:0};
    this.selectable = true;
  }
  getAnchorCanvasPosition(){ //Can return null
    return this._anchor;
  }
  clone(toParent){
    var clone = new this.constructor();
    Object.assign(clone, this);
    if(toParent != null){
      toParent.addChild(clone);
    }
    //Make sure to clone over children as well
    var oldChildren = Object.assign([], clone.children);
    clone.children = [];
    for(var i = 0; i < oldChildren.length; i++){
      oldChildren[i].clone(clone);
    }
    return clone;
  }
  addChild(child){
    child.parent = this;
    this.children.push(child);
    child.setManager(this.manager);
    return child;
  }
  setManager(manager){
    if(manager == null) return;
    manager.push(this); //Implicitly sets this.manager
    for(var i = 0; i < this.children.length; i++){
      this.children[i].setManager(manager);
    }
  }
  removeAllChildren(){
    for(var i = 0; i < this.children.length; i++){
      this.manager.remove(this.children[i]);
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
  drawBounds(ctx, color){
    color = color || "blue";
    ctx.save();
    var m = this._matrix;
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.strokeStyle = color;
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
  onAdd(){
    //Override
  }
  hitTest(x, y){
    if(this.width && this.height){
      var test = transformPoint({x:x, y:y}, this._matrix.inverse());
      return test.x >= 0 && test.x <= this.width && test.y >= 0 && test.y <= this.height;
    }
  }
}

classes["Spot"] = class extends classes["Entity"]{
  constructor(x, y, rotation){
    super(x, y, "Spot", rotation);
    this.constructorArgs = Array.from(arguments);
    this.width = SPOT_WIDTH * SPOT_SCALE;
    this.height = SPOT_HEIGHT * SPOT_SCALE;
    this.id = 0;
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
  onAdd(){
    this.id = this.manager.getId(); //Kind of hacky
  }
}

classes["SpotGroup"] = class extends classes["Entity"]{
  constructor(x, y, length){
    super(x, y, "SpotGroup");
    this.constructorArgs = Array.from(arguments);
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
classes["Label"] = class extends classes["Entity"]{
  constructor(x, y, text, width, font){
    super(x, y, "Label");
    this.constructorArgs = Array.from(arguments);
    this.text = text;
    this.width = width;
    this.height = 20;
    this.font = font;
  }
  drawPrimitive(){
    ctx.save();
    ctx.font = this.font;
    ctx.fillText(this.text, 10, 10, this.width);
    ctx.restore();
  }
}

classes["DebugPoint"] = class extends classes["Entity"]{
  constructor(x, y){
    super(x, y, "DebugPoint");
    this.selectable = false;
  }
  drawPrimitive(ctx){
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 5, 0, 0, 2 * Math.PI);
    ctx.fill();
  }
}

//Can't natively refer to classes dynamically, so we have to implement this hacky solution.
//The other solution would be a map, but I don't want to maintain a list of classes separate to their definitions
for(var className in classes){
  this[className] = classes[className];
}

//Helper functions

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
