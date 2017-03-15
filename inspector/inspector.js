class ValueSetter{
  constructor(id, callback, label){
    this.id = id;
    this.label = label || id;
    this.callback = callback;
  }
  getElement(){
    return `<td>${this.label}: </td>
            <td><input id="${this.id}"></input><td>
            <td><input type="button" id="${this.id}_button" value="Set"></input></td>`;
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
      document.getElementById(id + "_button").onclick = function(){
        var val = parseInt(document.getElementById(id).value, 10);
        document.getElementById(id).value = "";
        callback(val);
      }
    }
  }
}
