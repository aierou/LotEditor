var CANVAS_WIDTH = 1280;
var CANVAS_HEIGHT = 720;
var STAGE_WIDTH = 1920;
var STAGE_HEIGHT = 1080;
var SCALING_RATIO = 0.9;
var MAXIMUM_SCALE = 4;

var canvas;
var container;
var ctx;
var currentScale = 1;
var root;
var entities;
var stagePosition;
var minimumScale = 0.25;

window.onload = function(){
  canvas = document.getElementById("canvas");
  container = document.getElementById("canvas-container");
  ctx = enhanceContext(canvas.getContext("2d"));
  canvas.addEventListener("mousedown", mouseDown);
  canvas.addEventListener("mouseup", mouseUp);
  canvas.addEventListener("mousemove", mouseMove);
  canvas.addEventListener("wheel", mouseScroll);
  container.addEventListener("mousemove", containerMouseMove);

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
  scale = Math.min(MAXIMUM_SCALE, Math.max(minimumScale, scale));
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
  updateCanvasSize();
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

function updateCanvasSize(){
  var pos = transformPoint({x:CANVAS_WIDTH*(1/minimumScale) - stagePosition.x, y:CANVAS_HEIGHT*(1/minimumScale) - stagePosition.y}, ctx._matrix);
  canvas.width = pos.x;
  canvas.height = pos.y;
}


//Right; So; there was a noticeable loss of accuracy when performing a zoom.
//This loss in accuracy was largely due to the imprecision of scroll bar position,
//and so I am now performing calculations on a scroll bar position object separate
//to the live one.
var containerCurrentMouse;
var highPrecisionScrollPosition;
function containerMouseMove(evt){
  if(containerCurrentMouse && containerCurrentMouse.x == evt.clientX && containerCurrentMouse.y == evt.clientY) return;
  containerCurrentMouse = {x: evt.clientX, y: evt.clientY};
  highPrecisionScrollPosition = {left:container.scrollLeft, top:container.scrollTop};
}
function mouseScroll(evt){
  if(evt.ctrlKey) evt.preventDefault();
  if(!evt.ctrlKey || mouseIsDown) return;
  var pos1 = getTransformedMousePosition(evt);
  if(evt.deltaY > 0){
    setScale(currentScale * SCALING_RATIO);
  }else if(evt.deltaY < 0){
    setScale(currentScale * (1/SCALING_RATIO));
  }
  setOffset(stagePosition.x, stagePosition.y);
  var pos2 = getTransformedMousePosition(evt);
  var diff = {x: pos2.x - pos1.x, y: pos2.y - pos1.y};
  updateCanvasSize();
  highPrecisionScrollPosition.left -= diff.x*currentScale;
  highPrecisionScrollPosition.top -= diff.y*currentScale;
  container.scrollLeft = highPrecisionScrollPosition.left;
  container.scrollTop = highPrecisionScrollPosition.top;
}

var dragging = [];
var dragged = false;
var dragposition = null;
var mouseDownPosition = null;
var mouseIsDown = false;
var initialScrollPosition;
var containerMouseDownPosition;
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
  if(evt.buttons == 4){ //Middle click
    evt.preventDefault();
    initialScrollPosition = {top:container.scrollTop, left:container.scrollLeft};
    containerMouseDownPosition = getElementMousePosition(container, evt);
  }else{
    var pos = getMousePosition(evt);
    mouseIsDown = true;
    dragposition = {x:pos.x, y:pos.y};
    mouseDownPosition = {x:pos.x, y:pos.y};
  }
}
function mouseUp(evt){
  if(initialScrollPosition != null){ //Release middle click
    initialScrollPosition = null;
    return;
  }
  if(dragged && dragging.length == 0){ //rectangle select
    selection = [];
    var rect = pointsToRectangle(getTransformedPoint(mouseDownPosition), getTransformedMousePosition(evt));
    var entities = root.children;
    for(var i = 0; i < entities.length; i++){
      var inside = true;
      var points = entities[i].getCornerPoints();
      for(var j = 0; j < points.length; j++){
        //Transform point here for stage coordinates.
        if(!rect.containsPoint(getTransformedPoint(points[j]))){
          inside = false;
          break;
        }
      }
      if(inside)selection.push(entities[i]);
    }
    //If we only selected one entity, we can safely update the inspector.
    if(selection.length == 1) updateInspector();
  }else if(!dragged){ //point select
    var pos = getMousePosition(evt);
    selectAtPosition(pos.x, pos.y);
  }
  dragged = false;
  dragging = [];
  dragposition = null;
  mouseIsDown = false;
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

  //Holding middle click
  if(evt.buttons == 4){
    var start = containerMouseDownPosition;
    var end = getElementMousePosition(container, evt);
    var now = {x:end.x - start.x, y:end.y - start.y};
    container.scrollLeft = initialScrollPosition.left - now.x;
    container.scrollTop = initialScrollPosition.top - now.y;
  }

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
function getElementMousePosition(elem, evt){
  var rect = elem.getBoundingClientRect();
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

function drawSelector(){
  if(mouseIsDown && dragging.length == 0){
    var start = getTransformedPoint(mouseDownPosition);
    ctx.save();
    ctx.setLineDash([10, 10]); //For some reason this is leaking out of the saved context.
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(start.x, currentMouse.y);
    ctx.lineTo(currentMouse.x, currentMouse.y);
    ctx.lineTo(currentMouse.x, start.y);
    ctx.lineTo(start.x, start.y);
    ctx.stroke();
    ctx.setLineDash([0]); //This doesn't help.
    ctx.restore();
  }
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

function deselectAll(){
  selection = [];
  updateInspector();
}

var inspecting;
var inspector_current;
function updateInspector(){
  inspecting = null;
  if(selection.length > 0) inspecting = selection[selection.length - 1];
  var inspector = document.getElementById("inspector");
  var src = "inspector/default.html";
  if(inspecting){
    var src;
    switch(inspecting.type){
      case "Spot":
        src = "inspector/spot.html";
      break;
      case "SpotGroup":
        src = "inspector/spotgroup.html";
      break;
      case "Label":
        src = "inspector/label.html";
      break;
      default:
        src = "inspector/default.html";
      break;
    }
  }
  if(src != inspector_current){
    inspector.src = inspector_current = src;
  }
}

function serialize(rootEntity){
  var serializer = function(entity){
    var ret = Object.assign({}, entity);
    ret.parent = null;
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

function countSpots(){
  var spots = 0;
  var entities = root.getDescendants();
  for(var i = 0; i < entities.length; i++){
    if(entities[i].type == "Spot"){
      spots++;
    }
  }
  return spots;
}

function getImage(){
  var output = document.createElement("canvas");
  var context = enhanceContext(output.getContext("2d"));
  output.width = STAGE_WIDTH;
  output.height = STAGE_HEIGHT;
  root.draw(context);
  return output.toDataURL().split("data:image/png;base64,").join("");
}

var token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyaWQiOjEsImlhdCI6MTQ4OTc5Mjk3OCwiZXhwIjoxNDkyMzg0OTc4fQ.J_3KlxsJRTsojG94wj4G3ZiKJg6fU5eJCqdl9M-BJJI";
function save(){
  var data = {
    name: "Test",
    lat: "43.0",
    lng: "82.0",
    spots: countSpots(),
    image_data: getImage(),
    lot_data: serialize(root),
    spot_data: serializeSpots(),
    token: token
  }
  sendJSON("POST", "https://192.168.0.4/api/lot", data, function(response){
    console.log(response);
  });
}

function load(){
  var data = {
    token:token
  }
  sendJSON("POST", "https://192.168.0.4/api/account/lots", data, function(response){
    if(response.result){
      root = deserialize(response.result[0].lot_data);
    }
  });
}

function sendJSON(method, url, data, callback, error){
  var request = new XMLHttpRequest();   // new HttpRequest instance
  request.open(method, url);
  request.setRequestHeader("Content-Type", "application/json");
  request.send(JSON.stringify(data));
  request.onload = function(){
    if(this.status >= 200 && this.status < 300){
      callback(JSON.parse(this.response));
    }else{
      if(error) error(this.response);
    }
  }
  request.onerror = function(){
    //Network error
  }
}

//Fairly brute-force approach, but should make id management nicer.
function getId(){
  var taken = [];
  var entities = root.getDescendants();
  for(var i = 0; i < entities.length; i++){
    if(entities[i].type == "Spot"){
      var id = parseInt(entities[i].spotid, 10);
      if(!isNaN(id) && id >= 0) taken.push(id);
    }
  }
  taken.sort((a, b) => a - b);
  for(var i = 0; i < taken.length; i++){
    if(taken[i] != i) return i;
  }
  return taken.length;
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

  //Stage
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
  ctx.restore();

  //Start drawing from root entity
  if(root) root.draw(ctx);

  //Draw selection bounds
  for(var i = 0; i < selection.length; i++){
    selection[i].drawBounds(ctx);
  }

  //Draw rectangle select
  drawSelector();

  window.requestAnimationFrame(tick);
}
