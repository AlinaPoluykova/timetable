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
                'click @ui.reportButton': 'reportButtonClick'
            },

            onAttach: function () {
                $.material.init();
                this.ui.inputFrom.val(moment().subtract(1, 'day').startOf('month').format("YYYY-MM-DD"));
                this.ui.inputTo.val(moment().subtract(1, 'day').format("YYYY-MM-DD"));
                this.ui.inputFrom.datetimepicker({format : "YYYY-MM-DD"});
                this.ui.inputTo.datetimepicker({format : "YYYY-MM-DD"});
            },

            reportButtonClick: function(){

                var that = this;
                var timeFrom = moment(this.ui.inputFrom.val()).startOf('day');
                var timeTo = moment(this.ui.inputTo.val()).endOf('day');

                if(timeTo > moment().startOf('day')){
                    timeTo = moment().subtract(1, 'day').endOf('day');
                    this.ui.inputTo.val(timeTo.format("YYYY-MM-DD"));
                }

                this.timeCollection = new TimeCollection([],{
                        from: timeFrom.unix(),
                        to: timeTo.unix()
                    }
                );

                this.timeCollection.fetch({
                    success: function(collection){

                        //для каждого сотрудника создаём структуру данных для отчёта
                        $.each(that.employeeCollection.models, function(index, employee){
                            that.info[employee.get("_id")] = {
                                lateDays: [], //дни
                                workingDays: [], //строки с днями
                                startTimes: [],//секунды с начала дня
                                workingLengths: [],//секунды
                                dinnerLengths: []//секунды
                            };
                        });

                        var info = collection.models.map(function(data, index){
                            var info = {};
                            info["day"] = moment.unix(data.get("start")).startOf("day").format("DD.MM.YYYY");
                            info["employeeId"] = data.get("employeeId");
                            info["mode"] = data.get("mode");
                            info["late"] = data.get("late");
                            info["length"] = data.get("end") - data.get("start");
                            info["startFromBeginning"] = data.get("start") - moment.unix(data.get("start")).startOf("day").unix();
                            info["key"] = info["employeeId"] + "-" + info["day"] + "-" + info["mode"];
                            return info;
                        });

                        var groupedInfo = _.groupBy(info, "key");
                        var arr = _.values(groupedInfo).map(function(data, index){
                            var result = data[0];
                            if(data.length > 1){
                               $.each(data, function(index, elem){
                                   if(elem["startFromBeginning"] < result["startFromBeginning"]){
                                       result["startFromBeginning"] = elem["startFromBeginning"];
                                   }
                                   result["length"] += elem["length"];
                               });
                            }
                            return result
                        });

                        $.each(arr, function(index, elem){
                            if(!that.info[elem.employeeId])return;
                            if(elem.mode == "work"){
                                that.info[elem.employeeId].workingDays.push(elem.day);
                                that.info[elem.employeeId].startTimes.push(elem.startFromBeginning);
                                that.info[elem.employeeId].workingLengths.push(elem.length);
                            } else {
                                that.info[elem.employeeId].dinnerLengths.push(elem.length);
                            }
                            if(elem.late){
                                that.info[elem.employeeId].lateDays.push(elem.day);
                            }
                        });

                        var data = [];


                        function sum(arr){
                            return _.reduce(arr, function(sum, el) {
                                return sum + el
                            }, 0);
                        }

                        function average(arr){
                            return _.reduce(arr, function(memo, num) {
                                    return memo + num;
                                }, 0) / (arr.length === 0 ? 1 : arr.length);
                        }

                        function sec2time(sec){
                            return moment().startOf("day").add(sec,"seconds").format("HH:mm");
                        }

                        for (property in that.info) {
                            data.push({
                                name: property,
                                work: (sum(that.info[property]["workingLengths"])/3600).toFixed(2),
                                dinner: (sum(that.info[property]["dinnerLengths"])/3600).toFixed(2),
                                late: that.info[property]["lateDays"].length,
                                workDays: that.info[property]["workingDays"].length,
                                middleStartTime: sec2time(average(that.info[property]["startTimes"])),
                                middleHoursPerDay: (average(that.info[property]["workingLengths"])/3600).toFixed(2)
                            });

                        }

                        that.ui.reportTableContainer.html(_.template(ReportTable)({data: data}));

                    }
                })

            }

        });
    });