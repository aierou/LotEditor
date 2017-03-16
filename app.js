var CANVAS_WIDTH = 1280;
var CANVAS_HEIGHT = 720;

var canvas;
var ctx;
var root;
var currentScale = 1;
var entities;

window.onload = function(){
  canvas = document.getElementById("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  ctx = enhanceContext(canvas.getContext("2d"));
  canvas.addEventListener("mousedown", mouseDown);
  canvas.addEventListener("mouseup", mouseUp);
  canvas.addEventListener("mousemove", mouseMove);
  canvas.addEventListener("wheel", mouseScroll);

  entities = new EntityManager();
  root = new Entity(0, 0);
  entities.push(root); //We only need to add to our manager for root objects
  root.selectable = false;
  root.addChild(new Spot(500, 200, 135));
  root.addChild(new SpotGroup(500, 400, 3));
  root.children[1].rotation = 45;

  //setScale(0.5); //For testing

  tick();
}

function setScale(scale){
  currentScale = scale;
  ctx.resetTransform();
  ctx.scale(scale, scale);
}

function setOffset(x, y){
  ctx.resetTransform();
  ctx.scale(currentScale, currentScale);
  ctx.translate(x, y);
}

function mouseScroll(evt){
  var pos1 = getTransformedMousePosition(evt);
  if(evt.deltaY > 0){
    setScale(currentScale * .9);
  }else if(evt.deltaY < 0){
    setScale(currentScale * (1/.9));
  }
  var pos2 = getTransformedMousePosition(evt);
  setOffset(pos2.x - pos1.x, pos2.y - pos1.y);
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

function serialize(){
  return JSON.stringify(entities);
}
function serializeSpots(){
  var spots = [];
  for(var i = 0; i < entities.length; i++){
    if(entities[i].type == "Spot"){
      var pos = getTransformedPoint(entities[i].getAnchorCanvasPosition());
      spots.push({x:pos.x, y:pos.y, id:entities[i].id});
    }
  }
  return JSON.stringify(spots);
}

var frame = 0;
function tick(){

  //Background
  ctx.save();
  ctx.fillStyle = "#aaaaaa";
  var start = getTransformedPoint({x:0, y:0});
  var end = getTransformedPoint({x:CANVAS_WIDTH, y:CANVAS_HEIGHT});
  ctx.fillRect(start.x, start.y, end.x-start.x, end.y-start.y);
  ctx.restore();

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
