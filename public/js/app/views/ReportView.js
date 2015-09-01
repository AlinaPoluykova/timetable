define([
    'App',
    'marionette',
    'underscore',
    'text!templates/report.html',
    'material',
    'ripples',
    'bootstrapTable',
    'velocity', 'moment',
    'collections/TimeCollection',
    'collections/EmployeeCollection',
    'text!templates/reportTable.html',
], function(App, Marionette, _, template, material, ripples, bootstrapTable, velocity, moment, TimeCollection, EmployeeCollection, ReportTable) {

        return Marionette.ItemView.extend( {

            template: _.template(template),

            timeCollection: undefined,

            employeeCollection: undefined,

            info: {},

            ui: {
                reportButton: "#reportButton",
                inputFrom: "#inputFrom",
                inputTo: "#inputTo",
                reportTableContainer: ".report-container"
            },

            initialize: function(){
                this.employeeCollection = new EmployeeCollection();
                this.employeeCollection.fetch();
            },

            events: {
                'click @ui.reportButton': 'reportButtonClick',
            },

            onAttach: function () {
                $.material.init();
                // this.ui.inputFrom.val(moment().format("YYYY-MM-DD"));
                // this.ui.inputTo.val(moment().format("YYYY-MM-DD"));
                this.ui.inputFrom.datetimepicker();
                this.ui.inputTo.datetimepicker();
            },

            reportButtonClick: function(){

                var that = this;
                var timeFrom = moment(this.ui.inputFrom.val()).startOf('day');
                var timeTo = moment(this.ui.inputTo.val()).endOf('day');

                this.timeCollection = new TimeCollection({
                        from: timeFrom.unix(),
                        to: timeTo.unix()
                    }
                );

                //TODO вынести в отдельный хелпер
                function pad(num, size) {
                    return ('000000000' + num).substr(-size);
                }
                this.timeCollection.fetch({
                    success: function(collection){

                        $.each(that.employeeCollection.models, function(index, employee){
                            
                            console.log(index, employee);
                            that.info[employee.get("_id")] = {
                                work: 0,
                                dinner: 0,
                                late: 0

                            };
                        });
                       
                        var tmp = {};
                        var tmp2 = {};

                        $.each(collection.models, function (index, time) {
                            console.log(index, time);
                            var employeeId = time.get("employeeId");
                            if(!that.info[employeeId]){
                                return;
                            }

                            if(time.get('mode') === 'work'){
                                if (tmp[employeeId] == null) {
                                    tmp[employeeId] = []
                                }
                                var date = new Date(time.get('start') * 1000);
                                var year = date.getFullYear();
                                var month = date.getMonth() + 1 ;
                                var day = date.getDate();
                                date = year.toString() + '-' +  month.toString() + '-' + day.toString();
                                if (tmp[employeeId].indexOf(date) === -1) {
                                    tmp[employeeId].push(date);
                                }
                                
                            }

                            if(time.get("mode") === 'work' && time.has("start")){
                                if(tmp2[employeeId] == null){
                                    tmp2[employeeId] = {};
                                }
                                var date = new Date(time.get('start') * 1000);
                                var year = date.getFullYear();
                                var month = date.getMonth() + 1;
                                var day = date.getDate();
                                workDay = year.toString() + '-' +  month.toString() + '-' + day.toString();
                                if(tmp2[employeeId][workDay] == null) {
                                    tmp2[employeeId][workDay] = [];
                                }
                                tmp2[employeeId][workDay].push(time.get('start'));
                            }


                            if (time.get("mode") === 'work' && time.has("start")) {
                                var end = moment().unix();
                                if (time.has("end")) {
                                   end = time.get("end");
                                }
                                var period = end - time.get("start");
                                that.info[time.get("employeeId")].work += period;
                                if (time.has("late")) {
                                    that.info[time.get("employeeId")].late++;
                                }

                            } else if (time.get("mode") === 'break' && time.has("start")) {
                                var end = moment().unix();
                                if (time.has("end")) {
                                    end = time.get("end");
                                }
                                var period = end - time.get("start");
                                that.info[time.get("employeeId")].dinner += period;
                            }



                        });


                        var data = [];

                        $.each(that.info, function(employeeId, info){

                            // Бегаем по всем дням одного работника и выбираем самое раннее время начала дня, перезаписываем его
                            var employeeDays = tmp2[employeeId];
                            if (employeeDays != null) {
                                for(var dayKey in employeeDays){
                                    employeeDays[dayKey] = Math.min.apply(null, employeeDays[dayKey]);
                                }
                            }
                            
                            // debugger;
                            // Пробегаемся и считаем среднее минимальное за каждый день
                            var allStartHours = 0; 
                            var allStartMinutes = 0; 
                            if (tmp2[employeeId] != null) {
                                for (var startTime in tmp2[employeeId]){
                                    var minutesFromDayStart = new Date(tmp2[employeeId][startTime] * 1000).getHours() * 60 + new Date(tmp2[employeeId][startTime] * 1000).getMinutes();
                                    allStartMinutes += minutesFromDayStart;
                                }
                            }
                            var name = that.employeeCollection.get(employeeId).get("name");
                            var timeWork = Math.floor(info.work / 60 / 60) + ":" + pad(Math.floor(info.work / 60 % 60), 2);
                            var timeBreak = Math.floor(info.dinner / 60 / 60) + ":" + pad(Math.floor(info.dinner / 60 % 60), 2);
                            if (tmp[employeeId] != null) {
                                var workDays = tmp[employeeId].length;
                            } else {
                                var workDays = 0;
                            }
                            

                            if (workDays > 0) {
                                var middleHoursPerDay = pad(Math.round(info.work / 60 / 60 / workDays), 2) + ":" +  pad(Math.round(info.work / 60 % 60 / workDays), 2);
                            } else {
                                var middleHoursPerDay = '00:00';
                            }
                            

                            // console.log(employeeId , allStartTimes, workDays, allStartTimes / workDays);
                            // debugger;


                            if (workDays > 0) {
                                var middleStartMinutes = Math.floor(allStartMinutes / workDays);
                                var middleStartHours = Math.floor(middleStartMinutes / 60);
                                middleStartMinutes = Math.floor(middleStartMinutes % 60);
                            } else {
                                var middleStartHours = 0;
                                var middleStartMinutes = 0;
                            }
                            var middleStartTime = middleStartHours + ':' +  middleStartMinutes;


                            data.push({
                                name:name,
                                work: timeWork,
                                dinner: timeBreak,
                                late: info.late,
                                workDays: workDays,
                                middleHoursPerDay: middleHoursPerDay,
                                middleStartTime: middleStartTime

                            });
                        });
                        console.log(data);


                        that.ui.reportTableContainer.html(_.template(ReportTable)({data: data}));
                    }
                })

            }

        });
    });