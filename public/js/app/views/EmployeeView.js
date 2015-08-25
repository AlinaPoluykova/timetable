define( [ 'App', 'backbone', 'marionette', 'underscore', 'models/EmployeeModel', 'text!templates/employee.html', 'stickit', 'material', 'ripples',
    'bootstrapTable', 'velocity', "collections/EmployeeCollection", 'xeditable'],
    function( App, Backbone, Marionette, _, Model, template, stickit, material, ripples,
              bootstrapTable, velocity, EmployeeCollection, xeditable) {
        return Marionette.ItemView.extend( {

            template: _.template(template),

            model: new Model(),

            collection: new EmployeeCollection(),

            map: undefined,

            //биндинг элементов формы к полям модели (осуществляется через вызов stickit())
            bindings: {
                "#nameInput": "name",
                "#phoneInput": "phone",
                "#timeInput": "timeStart",
                "#dinnerCheckbox": "notifyOnBreak",
                "#finishCheckbox": "notifyOnEnd"
            },

            ui: {
                newEmployeeButton: "#newEmployeeButton",
                deleteSelectedButton: "#deleteSelectedButton",
                createButton: "#createButton",
                cancelButton: "#cancelButton",
                table: ".employee-table",
                // tableTd: "#work-table td",
                tableContainer: ".table-container"
            },

            initialize: function(){
            },

            events: {
                'click @ui.newEmployeeButton': 'newEmployeeButtonClick',
                'click @ui.deleteSelectedButton': 'deleteSelectedButtonClick',
                'click @ui.createButton': 'createButtonClick',
                'click @ui.cancelButton': 'cancelButtonClick'
            },

            onRender: function () {
                this.stickit();
            },

            onAttach: function () {
                var that = this;
                this.createTable();

                this.collection.fetch({
                    success: function(collection){
                        that.showEmployees(collection.models)
                    }
                });

                this.$el.find('.search input').addClass('floating-label').attr('placeholder', "Поиск");//TODO fix
                $.material.init();
            },

            createTable: function(){
                var data = [];
                this.ui.table.bootstrapTable({
                    data: data,
                    pagination: true,
                    striped: true,
                    search: true,
                    height: this.ui.tableContainer.height(),
                    sidePagination: "client",
                    toolbar: "#toolbar",
                    pageSize: 20,
                    "columns": [
                        {"field": "checked", "title": "User Id", checkbox: true},
                        {"field": "name", "title": "Фамилия", width: "40%"},
                        {"field": "timeStart", "title": "Начало смены", width: "30%"},
                        {"field": "phone", "title": "Телефон", width: "30%"}
                    ]
                });

            },



            showEmployees: function(models){
                var data = [];
                $.each(models, function(index, employee){
                    data.push(employee.toJSON());
                });
                this.ui.table.bootstrapTable("load", data);
            },

            newEmployeeButtonClick: function() {
                this.showForm();
            },

            deleteSelectedButtonClick: function() {
                var that = this;
                var employeesToDelete = this.ui.table.bootstrapTable("getSelections");
                $.each(employeesToDelete, function(index, employee){
                    that.collection.remove(employee);
                    App.db.remove(employee);
                });
                this.showEmployees(this.collection.models);
            },

            createButtonClick: function() {
                this.model.set("_id", this.model.get("name"));
                this.collection.create(this.model);
                this.ui.table.bootstrapTable("append", this.model.toJSON());
                this.resetFields();
                this.hideForm();
            },

            cancelButtonClick: function() {
                this.model.clear().set(Model.defaults);
                this.hideForm();
            },

            resetFields: function() {
                this.model = new Model({type: "employee"});
                this.stickit();
            },

            showForm: function(){
                //TODO перевести все на velocity (убрать вызов show())
                $('.overlay').show().velocity({opacity: 0.8});
                $('.new-employee-container').velocity("fadeIn");
            },

            hideForm: function(){
                //TODO перевести все на velocity (убрать вызов hide())
                $('.overlay').velocity({opacity: 0}).hide();
                $('.new-employee-container').velocity("fadeOut");
            }
        });
    });