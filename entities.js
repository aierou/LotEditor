var SPOT_WIDTH = 4;
var SPOT_HEIGHT = 8;
var SPOT_SCALE = 10;
var SELECTION_PADDING = 5;

var classes = {};
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
  getCornerPoints(){
    var points = [
      {x: 0, y: 0},
      {x: 0, y: this.height},
      {x: this.width, y: this.height},
      {x: this.width, y: 0},
    ];
    for(var i = 0; i < points.length; i++){
      points[i] = transformPoint(points[i], this._matrix);
    }
    return points;
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
  addChild(entity){
    entity.parent = this;
    this.children.push(entity);
    entity.onAdd();
    return entity;
  }
  removeChild(entity){
    this.children.splice(this.children.findIndex(a => a == entity), 1);
  }
  getDescendants(){
    var ret = [];
    for(var i = 0; i < this.children.length; i++){
      ret.push(this.children[i]);
      ret = ret.concat(this.children[i].getDescendants());
    }
    return ret;
  }
  removeAllChildren(){
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
    this.anchor.x = this.width/2;
    this.anchor.y = this.height/2;

    if(typeof(getId) != "undefined"){
      if(!this.spotid) this.spotid = getId();
    }else{
      this.spotid = "";
    }
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
    ctx.fillText(this.spotid, p.x, p.y);
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
    this.mirrored = true;

    this.anchor.y = this.spotHeight;
  }
  setLength(length){
    this.length = length;
    this.removeAllChildren();

    for(var i = 0; i < length; i++){
      this.addChild(new Spot(i * SPOT_WIDTH * SPOT_SCALE, 0, 180));
    }
    if(this.mirrored){
      for(var i = 0; i < length; i++){
        this.addChild(new Spot(i * SPOT_WIDTH * SPOT_SCALE, SPOT_HEIGHT * SPOT_SCALE, 0));
      }
    }
    this.width = length * this.spotWidth;
    this.height = this.spotHeight;
    if(this.mirrored) this.height *= 2;
  }
  onAdd(){
    // We call this here because if the group was just created, it needs
    // to be attached to root to generate spots that have proper ids.
    // This managed spot id thing is starting to become a pain to deal with.
    if(this.children.length == 0) this.setLength(this.length);
  }
}
classes["Label"] = class extends classes["Entity"]{
  constructor(x, y, text, size){
    super(x, y, "Label");
    this.constructorArgs = Array.from(arguments);
    this._text = text;
    this.setSize(size);
  }
  setText(val){
    this._text = val;
    this.setSize(this.size);
  }
  setSize(size){
    this.size = size;
    this.font = size + "px sans-serif";
    var c = document.createElement("canvas");
    var ct = c.getContext("2d");
    ct.font = this.font;
    var dim1 = ct.measureText(this._text);
    //So measureText does not give us text height. What.
    //Hack solution is using capital M width as an approximation of height.
    var dim2 = ct.measureText("M");

    this.width = dim1.width;
    this.height = dim2.width;

    //Make sure resizing is relative to anchor position
    this.x += this.anchor.x - (this.width/2);
    this.y += this.anchor.y - (this.height/2);

    this.anchor = {x:this.width/2, y:this.height/2};
  }
  drawPrimitive(ctx){
    ctx.save();
    ctx.font = this.font;
    ctx.fillText(this._text, 0, this.height);
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

class Rectangle{
  constructor(left, top, right, bottom){
    this.left = left;
    this.top = top;
    this.right = right;
    this.bottom = bottom;
  }
  containsPoint(p){
    return (p.x >= this.left && p.x <= this.right && p.y >= this.top && p.y <= this.bottom);
  }
}

function pointsToRectangle(pos1, pos2){
  var left = pos1.x < pos2.x ? pos1.x : pos2.x;
  var top = pos1.y < pos2.y ? pos1.y : pos2.y;
  var right = pos1.x > pos2.x ? pos1.x : pos2.x;
  var bottom = pos1.y > pos2.y ? pos1.y : pos2.y;
  return new Rectangle(left, top, right, bottom);
}

function getAbsoluteRect(el) {
  el = el.getBoundingClientRect();
  var ret = {
    left: el.left + window.scrollX,
    top: el.top + window.scrollY
  }
  ret.right = ret.left + el.width;
  ret.bottom = ret.top + el.height;
  return ret;
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
