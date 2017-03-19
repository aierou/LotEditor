class ValueSetter{
  constructor(id, callback, label){
    this.id = id;
    this.label = label || id;
    this.callback = callback;
  }
  getElement(){
    return `<div id="${this.id}">
            <span style="width:100px; display: inline-block; overflow: hidden;">${this.label}:</span>
            <input type="text" id="${this.id}_input"></input>
            <input type="submit" id="${this.id}_button" value="Set"></input>
            </div>`;
  }
  register(){
    let id = this.id;
    let callback = this.callback;

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

class Button{
  constructor(id, callback, label){
    this.id = id;
    this.label = label || id;
    this.callback = callback;
  }
  getElement(){
    return `<input type="button" id="${this.id}" value="${this.label}"></input>`;
  }
  register(){
    document.getElementById(this.id).onclick = this.callback;
  }
}

class Checkbox{
  constructor(id, callback, label, checked){
    this.id = id;
    this.label = label || id;
    this.callback = callback;
    this.checked = checked;
  }
  getElement(){
    return `<input type="checkbox" id="${this.id}" ${this.checked ? "checked" : ""}></input>
            <label for="${this.id}">${this.label}</label>`;
  }
  register(){
    var self = this;
    document.getElementById(this.id).onclick = function(){
      var val = document.getElementById(self.id).checked;
      self.callback(val);
    };
  }
}

class AdvancedViewer{
  constructor(object){
    this.object = object;
    this.id = "AdvancedViewer";
  }
  getElement(){
    return `<input type="checkbox" id="${this.id}_checkbox"></input>
            <label for="${this.id}_checkbox">Show hidden values</label>
            <div id="${this.id}" style="visibility:hidden;">${this.getValues()}</div>`;
  }
  getValues(){
    var ret = "";
    for(var value in this.object){
      if(typeof this.object[value] == "object") continue;
      ret += value + ": " + this.object[value] + "<br>";
    }
    return ret;
  }
  register(){
    //NOTE: Setting global boolean here
    var self = this;
    var handler = function(){
      var cb = document.getElementById(self.id + "_checkbox");
      var elem = document.getElementById(self.id);
      if(cb.checked){
        parent.window.showHiddenValues = true;
        elem.style='';
      }else{
        parent.window.showHiddenValues = false;
        elem.style='visibility:hidden;';
      }
    }
    document.getElementById(this.id + "_checkbox").onclick = handler;
    if(parent.window.showHiddenValues === true){
      document.getElementById(this.id + "_checkbox").checked = true;
      handler();
    }
    setInterval(function(){
      document.getElementById(self.id).innerHTML = self.getValues();
    },100);
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
      ret+=`<tr><td>${this.accessors[i].getElement()}</td></tr>`;
    }
    ret+="</table>"
    return ret;
  }
  build(){
    this.accessors.push(new AdvancedViewer(this.entity));
    this.elem.innerHTML = this.getStructure();

    for(var i = 0; i < this.accessors.length; i++){
      this.accessors[i].register();
    }
  }
}
