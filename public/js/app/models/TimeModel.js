define(["jquery", "backbone", "moment"],
    function ($, Backbone, moment) {
        // Creates a new Backbone Model class object
        var Model = Backbone.Model.extend({
            initialize:function () {
                this.set("type", this.defaults.type);

            },

            defaults:{
                _id: undefined,//идентификатор
                employeeId: undefined,//идинтификатор сотрудника
                start: undefined,//начало периода
                end: undefined,//конец периода
                mode: undefined,//тип периода: "work" - работа, "break" - обед
                type: "time",//тип записи - временной период
                photoStart: undefined,//фотка для начала периода(только для рабочих периодов) в Base64
                photoEnd: undefined,//фотка для конца периода(только для рабочих периодов) в Base64
                active: undefined,//флаг активности периода
                late: undefined//если период первый в текущем дне, то сюда пишется информация об опоздании (пока в виде строки "00:23", переделать на минуты)


            },

            validate:function (attrs) {

            },

            //преобразуем модель в item для DataSet от vis.js
            toItem: function(){
                var item = {
                    id: this.get("_id"),
                    group: this.get("employeeId"),
                    start: moment.unix(this.get("start")),
                    end: this.get("end") ? moment.unix(this.get("end")) : moment(),
                    type: 'background',
                    className: this.get("mode") + ' id' + this.get("_id")
                };
                if (!this.has("end")) {
                    item.className += ' active';
                }
                return item;
            }

        });
        return Model;
    }
);