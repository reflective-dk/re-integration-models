define([
  'common/promise', 'models/situ', 'utils', 'views/ro/role-admin'
], function(promise, situ, utils, roleAdminView) {

setup();

  var form = {
    data: {},
    situ: situ, //TODO other name? client?

    getInputs: function () {
      var inputs = [];
      // this.data contain modified snapshots, as key/value => id/snapshot
      Object.keys(form.data).forEach(function(id) {
        var input = form.data[id];
        input.id = id;
        inputs.push(input);
      });

       // Wrap data in object metadata, using vt as validity from
      return inputs;
    },
    render: function (args) {
      this.roleAdminView = roleAdminView({ form: form });
      this.roleAdminView.add(args.view).then(function () {
        createRoleResponsibiliesTree().then(form.roleAdminView.setTreeData);
//        createResponsibiliesOptions().then(form.roleAdminView.setResponsibilityOptions);
      });

      return promise.resolve();
    } // render
  };

  return form;

  // Transform query response to webix tree data, where the snapshot is added/stored in the thee items
  function createRoleResponsibiliesTree() {

    return promise.all([form.situ.getRoles(),form.situ.getResponsibilities()])
    .then(function (result) {
      var roles = result[0];
      var responsibilites = result[1];

      var allObjects = utils.asObject(roles.objects.concat(responsibilites.objects));

      var rolesRoot = {id: "roles", value: "Roller", open:true, data:[]};
      var responsibilitiesRoot = {id: "responsibilities", value: "Ansvar", open:true, data:[]};

      // Add roles
      roles.objects.forEach(function(role) {
        var item = allObjects[role.id];
        item.type = 'role';
        if (role.snapshot.responsibilities) {
          Object.keys(role.snapshot.responsibilities).forEach(function(key) {
            var ref = role.snapshot.responsibilities[key];
            var responsibilityItem = Object.assign({},allObjects[ref.id]);
            delete responsibilityItem.id; // cannot use same id in a tree more than once
            item.data.push(responsibilityItem);
          });
        }
        item.data = item.data.sort(function(a,b) {return a.value > b.value ? 1 : -1});
        rolesRoot.data.push(item);
      });
      rolesRoot.data = rolesRoot.data.sort(function(a,b) {return a.value > b.value ? 1 : -1});

      responsibilites.objects.forEach(function(responsibility) {
        var item = allObjects[responsibility.id];
        item.type = 'responsibility';
        responsibilitiesRoot.data.push(item);
      });
      responsibilitiesRoot.data = responsibilitiesRoot.data.sort(function(a,b) {return a.value > b.value ? 1 : -1});

      return promise.resolve([rolesRoot,responsibilitiesRoot]);
    });
  }
});









// New controls ---

function setup() {
    // Define multitext popup type
    webix.editors.$popup.multiselect = {
      view:"popup",
      body:{
        rows:[
          { view:"text", hidden:true}, // InputNode
          { view:"form", borderless:true, elements: [
          ]}
        ]
      }
    };

    webix.editors.multiselect = webix.extend({
      popupType: "multiselect",
      focus:function(){},
      setValue:function(value) {
console.log("DEBUG: setValue() value=",value);
        var formView = this.getFormView();
        var exclusive = this.config.Rexclusive;

        // Create values (id) of selected responsibilities
        var values = [];
        Object.keys(value).forEach(function(key) {
          var responsibility = value[key];
          values.push(responsibility.id);
        });

        this.config.css=''; // clear required marking

        // Remove existing views
        var ids = [];
        formView.getChildViews().forEach(function(view) {ids.push(view.config.id);});
        ids.forEach(function(id) {formView.removeView(id);});

        // setup multitext lines from property field value
        formView.addView(
          {cols:[ {view:"label",label:this.config.label,width: 90}, {name: 'select0', view:"select", disabled: exclusive && values.length > 0, options: this.config.Roptions, width:230, value: values.length ? values[0] : "" },
         {view:"button", type:"icon", icon: "plus-circle", width:28, on: {onItemClick:webix.editors.multiselect._addLine(this.config.Roptions, exclusive)} }]}
        );
        for (var i = 1; i < values.length; i++) {
          this.getFormView().addView(
            {cols:[ {width: 90}, {name: 'select'+i, view:"select", disabled: exclusive, options: this.config.Roptions, width:230, value: values[i].trim() },
            {view:"button", type:"icon", icon: "minus-circle", width:28, on: {onItemClick:webix.editors.multiselect._removeLine} }]}
          );
        }
        this._is_string = this.config.stringResult || (value && typeof value == "string");
        webix.editors.popup.setValue.call(this, value);
      },
      getValue:function(){
        var result = {};
        var options = this.config.Roptions;
        var formView = this.getFormView();
        var cnt = 0;
        formView.getChildViews().forEach(function(view) {
          var selectView = view.getChildViews()[1];
          var v = selectView.getValue();

          result[cnt++] = {id:v,name:options.filter(o => o.id === v)[0].value}
        });
console.log("DEBUG: multiselect getValue() result=",result);
        return result;
      },
      popupInit:function(popup) {
      },
      getInputNode:function() {
        return this.getPopup().getBody().getChildViews()[0];
      },
      getFormView:function() {
        return this.getPopup().getBody().getChildViews()[1];
      },
      _removeLine:function(id){
        var lineId = webix.$$(id).getParentView().config.id;
        this.getFormView().removeView(lineId);
      },
      _addLine:function(Roptions,exclusive){
        return function(id) {
          var options = Object.assign(Roptions);

          // filter out options already in use and disable all selects except latest
          if (exclusive) {
            this.getFormView().getChildViews().forEach(function(view) {
              var selectView = view.getChildViews()[1];
              selectView.disable();
              var v = selectView.getValue();

              // remove values from options if exclusive
              if (exclusive) {
                options = options.filter(o => o.id !== v);
              }
            });
          }
          // if last option then disable [+] button
          if (options.length === 1) {
            // Label, select, [+] button
            this.getFormView().getChildViews()[0].getChildViews()[2].disable();
          } else {
            this.getFormView().getChildViews()[0].getChildViews()[2].enable();
          }

          var view =
            {cols:[ {width: 90}, {name: id, view:"select", width:230, options: options, value: "" },
            {view:"button", type:"icon", icon: "minus-circle", width:28, on: {onItemClick:webix.editors.multiselect._removeLine} }]};
          this.getFormView().addView(view);
        };
      }
    }, webix.editors.popup);
}