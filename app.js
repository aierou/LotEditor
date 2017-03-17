var CANVAS_WIDTH = 1280;
var CANVAS_HEIGHT = 720;
var STAGE_WIDTH = 1920;
var STAGE_HEIGHT = 1080;
var SCALING_RATIO = 0.9;

var canvas;
var container;
var ctx;
var currentScale = 1;
var root;
var entities;
var stagePosition;
var minimumScale;

window.onload = function(){
  canvas = document.getElementById("canvas");
  container = document.getElementById("canvas-container");
  ctx = enhanceContext(canvas.getContext("2d"));
  canvas.addEventListener("mousedown", mouseDown);
  canvas.addEventListener("mouseup", mouseUp);
  canvas.addEventListener("mousemove", mouseMove);
  canvas.addEventListener("wheel", mouseScroll);

  root = new Entity(0, 0);
  root.selectable = false;
  root.addChild(new Spot(500, 200, 135));
  root.addChild(new SpotGroup(500, 400, 3));
  root.children[1].rotation = 45;

  setScale(0.5);
  setMinimumScale(0.25);

  tick();
}

function setScale(scale){
  if(scale < minimumScale) scale = minimumScale;
  currentScale = scale;
  ctx.resetTransform();
  ctx.scale(scale, scale);
}
function setMinimumScale(scale){
  minimumScale = scale;
  stagePosition = {};
  stagePosition.x = (1/minimumScale*CANVAS_WIDTH/2)-(STAGE_WIDTH/2);
  stagePosition.y = (1/minimumScale*CANVAS_HEIGHT/2)-(STAGE_HEIGHT/2);
  setOffset(stagePosition.x, stagePosition.y);
  var pos = transformPoint({x:CANVAS_WIDTH*(1/minimumScale) - stagePosition.x, y:CANVAS_HEIGHT*(1/minimumScale) - stagePosition.y}, ctx._matrix);
  canvas.width = pos.x;
  canvas.height = pos.y;
  var maxScrollLeft = container.scrollWidth - container.clientWidth;
  var maxScrollTop = container.scrollHeight - container.clientHeight;
  container.scrollLeft = maxScrollLeft / 2;
  container.scrollTop = maxScrollTop / 2;
}

function setOffset(x, y){
  ctx.resetTransform();
  ctx.scale(currentScale, currentScale);
  ctx.translate(x, y);
}

function mouseScroll(evt){
  if(!evt.ctrlKey) return;
  evt.preventDefault();
  var pos1 = getTransformedMousePosition(evt);
  if(evt.deltaY > 0){
    setScale(currentScale * SCALING_RATIO);
  }else if(evt.deltaY < 0){
    setScale(currentScale * (1/SCALING_RATIO));
  }
  setOffset(stagePosition.x, stagePosition.y);
  var pos2 = getTransformedMousePosition(evt);
  var diff = {x: pos2.x - pos1.x, y: pos2.y - pos1.y};

  var pos = transformPoint({x:CANVAS_WIDTH*(1/minimumScale) - stagePosition.x, y:CANVAS_HEIGHT*(1/minimumScale) - stagePosition.y}, ctx._matrix);
  canvas.width = pos.x;
  canvas.height = pos.y;
  container.scrollLeft -= diff.x*currentScale;
  container.scrollTop -= diff.y*currentScale;
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
  var pos = getTransformedMousePosition(evt);
  //For some reason, mousemove is called for all mouse events.
  //Here we check to see if the mouse actually moved.
  if(currentMouse != null && currentMouse.x==pos.x && currentMouse.y==pos.y){
    return;
  }
  currentMouse = pos;
  //We want to try a drag if the mouse was moved while the mouse button is being held.
  //This is done to make dragging feel better.
  if(dragposition != null){
    //Don't descend as this selection is only for dragging
    //Also, hitTest transforms the testing point, so we want raw input there whereas
    //we want scaled input for startDrag.
    selectAtPosition(dragposition.x, dragposition.y, false);
    var scaledDragPosition = getTransformedPoint(dragposition);
    startDrag(scaledDragPosition.x, scaledDragPosition.y);
    dragposition = null;
  }
  //We want to set dragged even when we aren't dragging something
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
function getTransformedMousePosition(evt){
  var pos = getMousePosition(evt);
  return transformPoint(pos, ctx._matrix.inverse());
}
function getTransformedPoint(p){
  return transformPoint(p, ctx._matrix.inverse());
}
function selectAtPosition(x, y, descend){
  if(descend == null) descend = true;
  var hit = false;
  var entities = root.getDescendants();
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
  var entities = root.getDescendants();
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

function serialize(rootEntity){
  var serializer = function(entity){
    var ret = Object.assign({}, entity);
    ret.parent = null;
    ret.manager = null;
    if(ret.children.length != 0){
      var oldChildren = Object.assign([], ret.children);
      ret.children = [];
      for(var i = 0; i < oldChildren.length; i++){
        ret.children.push(serializer(oldChildren[i]));
      }
    }
    return ret;
  }
  return JSON.stringify(serializer(rootEntity));
}
function deserialize(data){
  var rootEntity = JSON.parse(data);
  var deserializer = function(entity){
    //Create entity with saved values.
    var ret = Object.assign(new classes[entity.type](), entity);

    //Add children
    if(ret.children.length != 0){
      var oldChildren = Object.assign([], ret.children);
      ret.children = [];
      for(var i = 0; i < oldChildren.length; i++){
        ret.addChild(deserializer(oldChildren[i]));
      }
    }
    return ret;
  }
  return deserializer(rootEntity);
}
function serializeSpots(){
  var spots = [];
  var entities = root.getDescendants();
  for(var i = 0; i < entities.length; i++){
    if(entities[i].type == "Spot"){
      var pos = getTransformedPoint(entities[i].getAnchorCanvasPosition());
      spots.push({x:pos.x, y:pos.y, id:entities[i].spotid});
    }
  }
  return JSON.stringify(spots);
}

var currentId = 0;
function getId(){
  return currentId++;
}

var frame = 0;
function tick(){

  //Background
  ctx.save();
  ctx.fillStyle = "#aaaaaa";
  var start = getTransformedPoint({x:0, y:0});
  var end = getTransformedPoint({x:canvas.width, y:canvas.height});
  ctx.fillRect(start.x, start.y, end.x-start.x, end.y-start.y);
  ctx.restore();

  //Clear buffer
  ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  //Start drawing from root entity
  if(root) root.draw(ctx);

  //Draw selection bounds
  for(var i = 0; i < selection.length; i++){
    selection[i].drawBounds(ctx);
  }

  window.requestAnimationFrame(tick);
}
