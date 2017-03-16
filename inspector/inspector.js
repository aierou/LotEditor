class ValueSetter{
  constructor(id, callback, label){
    this.id = id;
    this.label = label || id;
    this.callback = callback;
  }
  getElement(){
    return `<div id="${this.id}">
            <td>${this.label}: </td>
            <td><input type="text" id="${this.id}_input"></input><td>
            <td><input type="submit" id="${this.id}_button" value="Set"></input></td>
            </div>`;
  }
}

class Inspector{
  constructor(entity, elem){
    this.entity = entity;
    this.elem = elem;
    this.accessors = [];
  }
  addAccessor(accessor){
    this.accessors.push(accessor);
  }
  getStructure(){
    var ret = "<table>";
    for(var i = 0; i < this.accessors.length; i++){
      ret+=`<tr>${this.accessors[i].getElement()}</tr>`;
    }
    ret+="</table>"
    return ret;
  }
  build(){
    this.elem.innerHTML = this.getStructure();

    for(var i = 0; i < this.accessors.length; i++){
      let id = this.accessors[i].id;
      let callback = this.accessors[i].callback;
      let handler = function(){
        var val = document.getElementById(id + "_input").value;
        document.getElementById(id + "_input").value = "";
        callback(val);
      }
      document.getElementById(id + "_button").onclick=handler;
      document.getElementById(id + "_input").onkeypress=function(e){ //Handle enter key press
        if(e && e.keyCode != 13) return;
        handler();
      }
    }
  }
}
